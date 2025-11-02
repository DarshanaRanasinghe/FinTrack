import os
import oracledb
from dotenv import load_dotenv

load_dotenv()

db_config = {
    "user": os.getenv("DB_USER", "system"),
    "password": os.getenv("DB_PASSWORD", "123"),
    "dsn": f"{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '1521')}/{os.getenv('DB_SID', 'xe')}"
}

connection = None

async def init_database():
    global connection
    try:
        connection = oracledb.connect(**db_config)
        print("Connected to Oracle Database")
        
        # Create sequences
        await create_sequence_if_not_exists("USERS_SEQ")
        await create_sequence_if_not_exists("TRANSACTIONS_SEQ")
        await create_sequence_if_not_exists("GOALS_SEQ")
        
        # Check and create tables
        await check_and_create_users_table()
        await check_and_create_transactions_table()
        await check_and_create_goals_table()
        
        # Create stored procedures for reports
        await create_report_procedures()
        
        print("Database initialized successfully")
        return connection
    except Exception as error:
        print(f"Database initialization error: {error}")
        raise error

async def create_sequence_if_not_exists(seq_name):
    cursor = connection.cursor()
    try:
        cursor.execute(f"""
            BEGIN
                EXECUTE IMMEDIATE 'CREATE SEQUENCE {seq_name} START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE';
            EXCEPTION
                WHEN OTHERS THEN
                    IF SQLCODE != -955 THEN
                        RAISE;
                    END IF;
            END;
        """)
        connection.commit()
    finally:
        cursor.close()

async def create_report_procedures():
    cursor = connection.cursor()
    try:
        # Procedure 1: Monthly Expenditure Analysis
        cursor.execute("""
            CREATE OR REPLACE PROCEDURE get_monthly_expenditure_analysis(
                p_user_id IN NUMBER,
                p_month IN NUMBER,
                p_year IN NUMBER,
                p_result OUT SYS_REFCURSOR
            ) AS
            BEGIN
                OPEN p_result FOR
                SELECT 
                    category,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_amount,
                    ROUND(AVG(amount), 2) as avg_amount,
                    ROUND((SUM(amount) / (SELECT SUM(amount) FROM transactions 
                         WHERE user_id = p_user_id 
                         AND EXTRACT(MONTH FROM transaction_date) = p_month 
                         AND EXTRACT(YEAR FROM transaction_date) = p_year 
                         AND type = 'expense')) * 100, 2) as percentage
                FROM transactions 
                WHERE user_id = p_user_id 
                    AND type = 'expense'
                    AND EXTRACT(MONTH FROM transaction_date) = p_month 
                    AND EXTRACT(YEAR FROM transaction_date) = p_year 
                GROUP BY category
                ORDER BY total_amount DESC;
            END;
        """)

        # Procedure 2: Goal Adherence Tracking
        cursor.execute("""
            CREATE OR REPLACE PROCEDURE get_goal_adherence_tracking(
                p_user_id IN NUMBER,
                p_year IN NUMBER,
                p_result OUT SYS_REFCURSOR
            ) AS
            BEGIN
                OPEN p_result FOR
                WITH monthly_net AS (
                    SELECT 
                        EXTRACT(MONTH FROM transaction_date) as month,
                        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net_income
                    FROM transactions 
                    WHERE user_id = p_user_id 
                        AND EXTRACT(YEAR FROM transaction_date) = p_year
                    GROUP BY EXTRACT(MONTH FROM transaction_date)
                )
                SELECT 
                    g.target_month,
                    g.target_year,
                    g.target_amount,
                    COALESCE(m.net_income, 0) as actual_savings,
                    CASE 
                        WHEN COALESCE(m.net_income, 0) >= g.target_amount THEN 'ACHIEVED'
                        WHEN COALESCE(m.net_income, 0) >= g.target_amount * 0.7 THEN 'NEAR_TARGET'
                        ELSE 'BELOW_TARGET'
                    END as status,
                    ROUND((COALESCE(m.net_income, 0) / g.target_amount) * 100, 2) as achievement_rate
                FROM goals g
                LEFT JOIN monthly_net m ON g.target_month = m.month
                WHERE g.user_id = p_user_id 
                    AND g.target_year = p_year
                ORDER BY g.target_month;
            END;
        """)

        # Procedure 3: Savings Goal Progress
        cursor.execute("""
            CREATE OR REPLACE PROCEDURE get_savings_goal_progress(
                p_user_id IN NUMBER,
                p_result OUT SYS_REFCURSOR
            ) AS
                v_total_income NUMBER;
                v_total_expense NUMBER;
                v_net_savings NUMBER;
            BEGIN
                -- Get current month totals
                SELECT 
                    NVL(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
                    NVL(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
                INTO v_total_income, v_total_expense
                FROM transactions 
                WHERE user_id = p_user_id 
                    AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM SYSDATE)
                    AND EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM SYSDATE);
                
                v_net_savings := v_total_income - v_total_expense;
                
                OPEN p_result FOR
                SELECT 
                    g.target_month,
                    g.target_year,
                    g.target_amount,
                    v_net_savings as current_savings,
                    ROUND((v_net_savings / g.target_amount) * 100, 2) as progress_percentage,
                    CASE 
                        WHEN v_net_savings >= g.target_amount THEN 'ACHIEVED'
                        WHEN (SYSDATE - TRUNC(SYSDATE, 'MONTH')) / EXTRACT(DAY FROM LAST_DAY(SYSDATE)) > 0.7 
                             AND v_net_savings < g.target_amount * 0.7 THEN 'AT_RISK'
                        ELSE 'ON_TRACK'
                    END as status
                FROM goals g
                WHERE g.user_id = p_user_id 
                    AND g.target_month = EXTRACT(MONTH FROM SYSDATE)
                    AND g.target_year = EXTRACT(YEAR FROM SYSDATE);
            END;
        """)

        # Procedure 4: Category Expense Distribution
        cursor.execute("""
            CREATE OR REPLACE PROCEDURE get_category_expense_distribution(
                p_user_id IN NUMBER,
                p_start_date IN VARCHAR2,
                p_end_date IN VARCHAR2,
                p_result OUT SYS_REFCURSOR
            ) AS
                v_total_expenses NUMBER;
            BEGIN
                SELECT SUM(amount) INTO v_total_expenses
                FROM transactions 
                WHERE user_id = p_user_id 
                    AND type = 'expense'
                    AND transaction_date BETWEEN TO_DATE(p_start_date, 'YYYY-MM-DD') 
                    AND TO_DATE(p_end_date, 'YYYY-MM-DD');
                
                OPEN p_result FOR
                SELECT 
                    category,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_amount,
                    ROUND(AVG(amount), 2) as avg_amount,
                    ROUND((SUM(amount) / v_total_expenses) * 100, 2) as percentage
                FROM transactions 
                WHERE user_id = p_user_id 
                    AND type = 'expense'
                    AND transaction_date BETWEEN TO_DATE(p_start_date, 'YYYY-MM-DD') 
                    AND TO_DATE(p_end_date, 'YYYY-MM-DD')
                GROUP BY category
                ORDER BY total_amount DESC;
            END;
        """)

        # Procedure 5: Financial Health Status
        cursor.execute("""
            CREATE OR REPLACE PROCEDURE get_financial_health_status(
                p_user_id IN NUMBER,
                p_result OUT SYS_REFCURSOR
            ) AS
                v_total_income NUMBER;
                v_total_expenses NUMBER;
                v_net_income NUMBER;
                v_savings_rate NUMBER;
                v_goal_achievement_rate NUMBER;
                v_health_score NUMBER;
            BEGIN
                -- Calculate total income and expenses for current year
                SELECT 
                    NVL(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
                    NVL(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
                INTO v_total_income, v_total_expenses
                FROM transactions 
                WHERE user_id = p_user_id 
                    AND EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM SYSDATE);
                
                v_net_income := v_total_income - v_total_expenses;
                v_savings_rate := CASE WHEN v_total_income > 0 THEN (v_net_income / v_total_income) * 100 ELSE 0 END;
                
                -- Calculate goal achievement rate
                SELECT 
                    CASE WHEN COUNT(*) > 0 THEN 
                        (COUNT(CASE WHEN net_income >= target_amount THEN 1 END) / COUNT(*)) * 100 
                    ELSE 0 END
                INTO v_goal_achievement_rate
                FROM (
                    SELECT 
                        g.target_month,
                        g.target_amount,
                        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as net_income
                    FROM goals g
                    LEFT JOIN transactions t ON g.user_id = t.user_id 
                        AND EXTRACT(MONTH FROM t.transaction_date) = g.target_month
                        AND EXTRACT(YEAR FROM t.transaction_date) = g.target_year
                    WHERE g.user_id = p_user_id 
                        AND g.target_year = EXTRACT(YEAR FROM SYSDATE)
                    GROUP BY g.target_month, g.target_amount
                );
                
                -- Calculate health score (0-100)
                v_health_score := LEAST(
                    (v_savings_rate * 0.4) + 
                    (v_goal_achievement_rate * 0.4) + 
                    (CASE WHEN v_net_income > 0 THEN 20 ELSE 0 END), 
                    100
                );
                
                OPEN p_result FOR
                SELECT 
                    v_total_income as total_income,
                    v_total_expenses as total_expenses,
                    v_net_income as net_income,
                    ROUND(v_savings_rate, 2) as savings_rate,
                    ROUND(v_goal_achievement_rate, 2) as goal_achievement_rate,
                    ROUND(v_health_score, 2) as health_score,
                    CASE 
                        WHEN v_health_score >= 80 THEN 'EXCELLENT'
                        WHEN v_health_score >= 60 THEN 'GOOD'
                        WHEN v_health_score >= 40 THEN 'FAIR'
                        ELSE 'POOR'
                    END as health_status
                FROM DUAL;
            END;
        """)
        
        connection.commit()
        print("Report procedures created successfully")
    except Exception as error:
        print(f"Error creating procedures: {error}")
        raise error
    finally:
        cursor.close()

async def check_and_create_users_table():
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT table_name FROM user_tables WHERE table_name = 'USERS'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            await create_users_table()
            return
        
        required_columns = [
            'ID', 'NAME', 'EMAIL', 'PASSWORD', 'DATE_OF_BIRTH',
            'IS_ACTIVE', 'LAST_LOGIN', 'CREATED_AT'
        ]
        
        cursor.execute("SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'")
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        missing_columns = [col for col in required_columns if col not in existing_columns]
        
        if missing_columns:
            print(f"Missing columns in USERS table: {', '.join(missing_columns)}")
            print("Dropping and recreating USERS table...")
            cursor.execute('DROP TABLE users CASCADE CONSTRAINTS')
            await create_users_table()
        else:
            print("USERS table exists with all required columns")
    except Exception as error:
        print(f"Error checking/creating users table: {error}")
        raise error
    finally:
        cursor.close()

async def create_users_table():
    cursor = connection.cursor()
    try:
        cursor.execute("""
            CREATE TABLE users (
                id NUMBER PRIMARY KEY,
                name VARCHAR2(100) NOT NULL,
                email VARCHAR2(255) UNIQUE NOT NULL,
                password VARCHAR2(255) NOT NULL,
                date_of_birth DATE NOT NULL,
                is_active NUMBER(1) DEFAULT 1,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        connection.commit()
        print("Created USERS table")
    finally:
        cursor.close()

async def check_and_create_transactions_table():
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT table_name FROM user_tables WHERE table_name = 'TRANSACTIONS'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            await create_transactions_table()
            return
        
        required_columns = [
            'ID', 'AMOUNT', 'DESCRIPTION', 'TYPE', 'CATEGORY',
            'USER_ID', 'DATE_CREATED', 'TRANSACTION_DATE'
        ]
        
        cursor.execute("SELECT column_name FROM user_tab_columns WHERE table_name = 'TRANSACTIONS'")
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        missing_columns = [col for col in required_columns if col not in existing_columns]
        
        if missing_columns:
            print(f"Missing columns in TRANSACTIONS table: {', '.join(missing_columns)}")
            print("Dropping and recreating TRANSACTIONS table...")
            cursor.execute('DROP TABLE transactions CASCADE CONSTRAINTS')
            await create_transactions_table()
        else:
            print("TRANSACTIONS table exists with all required columns")
            
            cursor.execute("""
                SELECT constraint_name
                FROM user_constraints
                WHERE table_name = 'TRANSACTIONS'
                AND constraint_name = 'FK_USER_TRANSACTION'
            """)
            fk_exists = cursor.fetchone()
            
            if not fk_exists:
                print("Adding foreign key constraint...")
                cursor.execute("""
                    ALTER TABLE transactions
                    ADD CONSTRAINT fk_user_transaction
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                """)
                connection.commit()
    except Exception as error:
        print(f"Error checking/creating transactions table: {error}")
        raise error
    finally:
        cursor.close()

async def create_transactions_table():
    cursor = connection.cursor()
    try:
        cursor.execute("""
            CREATE TABLE transactions (
                id NUMBER PRIMARY KEY,
                amount NUMBER NOT NULL,
                description VARCHAR2(500) NOT NULL,
                type VARCHAR2(10) NOT NULL,
                category VARCHAR2(100) NOT NULL,
                user_id NUMBER NOT NULL,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                transaction_date DATE NOT NULL,
                CONSTRAINT fk_user_transaction FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        connection.commit()
        print("Created TRANSACTIONS table with foreign key constraint")
    finally:
        cursor.close()

async def check_and_create_goals_table():
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT table_name FROM user_tables WHERE table_name = 'GOALS'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            await create_goals_table()
            return
        
        print("GOALS table already exists")
    except Exception as error:
        print(f"Error checking/creating goals table: {error}")
        raise error
    finally:
        cursor.close()

async def create_goals_table():
    cursor = connection.cursor()
    try:
        cursor.execute("""
            CREATE TABLE goals (
                id NUMBER PRIMARY KEY,
                user_id NUMBER NOT NULL,
                target_amount NUMBER NOT NULL,
                target_month NUMBER NOT NULL,
                target_year NUMBER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_user_goal FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT unique_user_month_goal UNIQUE (user_id, target_month, target_year)
            )
        """)
        connection.commit()
        print("Created GOALS table")
    finally:
        cursor.close()

async def get_connection():
    global connection
    if not connection:
        connection = oracledb.connect(**db_config)
    return connection

async def close_connection():
    if connection:
        connection.close()
        print("Database connection closed")