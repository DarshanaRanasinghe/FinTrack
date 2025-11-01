import os
import oracledb
from dotenv import load_dotenv

load_dotenv()

db_config = {
    "user": os.getenv("DB_USER", "system"),
    "password": os.getenv("DB_PASSWORD", "123"),
    "dsn": f"{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '1521')}/{os.getenv('DB_SID', 'xe')}"
}

connection_pool = None

async def init_database():
    global connection_pool
    try:
        # Create connection pool for better performance
        connection_pool = oracledb.create_pool(
            user=db_config["user"],
            password=db_config["password"],
            dsn=db_config["dsn"],
            min=1,
            max=10,
            increment=1
        )
        
        # Test connection
        with connection_pool.acquire() as conn:
            print("✅ Connected to Oracle Database")
            
            # Create sequences
            await create_sequence_if_not_exists(conn, "USERS_SEQ")
            await create_sequence_if_not_exists(conn, "TRANSACTIONS_SEQ")
            await create_sequence_if_not_exists(conn, "GOALS_SEQ")
            
            # Check and create tables
            await check_and_create_users_table(conn)
            await check_and_create_transactions_table(conn)
            await check_and_create_goals_table(conn)
        
        print("✅ Database initialized successfully")
        return connection_pool
        
    except Exception as error:
        print(f"❌ Database initialization error: {error}")
        raise error

async def create_sequence_if_not_exists(conn, seq_name):
    cursor = conn.cursor()
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
        conn.commit()
        print(f"✅ Sequence {seq_name} created or already exists")
    except Exception as error:
        print(f"❌ Error creating sequence {seq_name}: {error}")
        raise error
    finally:
        cursor.close()

async def check_and_create_users_table(conn):
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT table_name FROM user_tables WHERE table_name = 'USERS'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            await create_users_table(conn)
            return
        
        required_columns = [
            'ID', 'NAME', 'EMAIL', 'PASSWORD', 'DATE_OF_BIRTH',
            'IS_ACTIVE', 'LAST_LOGIN', 'CREATED_AT'
        ]
        
        cursor.execute("SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'")
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        missing_columns = [col for col in required_columns if col not in existing_columns]
        
        if missing_columns:
            print(f"⚠️ Missing columns in USERS table: {', '.join(missing_columns)}")
            print("🔄 Dropping and recreating USERS table...")
            cursor.execute('DROP TABLE users CASCADE CONSTRAINTS')
            await create_users_table(conn)
        else:
            print("✅ USERS table exists with all required columns")
    except Exception as error:
        print(f"❌ Error checking/creating users table: {error}")
        raise error
    finally:
        cursor.close()

async def create_users_table(conn):
    cursor = conn.cursor()
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
        conn.commit()
        print("✅ Created USERS table")
    except Exception as error:
        print(f"❌ Error creating users table: {error}")
        raise error
    finally:
        cursor.close()

async def check_and_create_transactions_table(conn):
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT table_name FROM user_tables WHERE table_name = 'TRANSACTIONS'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            await create_transactions_table(conn)
            return
        
        required_columns = [
            'ID', 'AMOUNT', 'DESCRIPTION', 'TYPE', 'CATEGORY',
            'USER_ID', 'DATE_CREATED', 'TRANSACTION_DATE'
        ]
        
        cursor.execute("SELECT column_name FROM user_tab_columns WHERE table_name = 'TRANSACTIONS'")
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        missing_columns = [col for col in required_columns if col not in existing_columns]
        
        if missing_columns:
            print(f"⚠️ Missing columns in TRANSACTIONS table: {', '.join(missing_columns)}")
            print("🔄 Dropping and recreating TRANSACTIONS table...")
            cursor.execute('DROP TABLE transactions CASCADE CONSTRAINTS')
            await create_transactions_table(conn)
        else:
            print("✅ TRANSACTIONS table exists with all required columns")
            
            # Check foreign key constraint
            cursor.execute("""
                SELECT constraint_name
                FROM user_constraints
                WHERE table_name = 'TRANSACTIONS'
                AND constraint_name = 'FK_USER_TRANSACTION'
            """)
            fk_exists = cursor.fetchone()
            
            if not fk_exists:
                print("🔄 Adding foreign key constraint...")
                cursor.execute("""
                    ALTER TABLE transactions
                    ADD CONSTRAINT fk_user_transaction
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                """)
                conn.commit()
                print("✅ Foreign key constraint added")
    except Exception as error:
        print(f"❌ Error checking/creating transactions table: {error}")
        raise error
    finally:
        cursor.close()

async def create_transactions_table(conn):
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE transactions (
                id NUMBER PRIMARY KEY,
                amount NUMBER NOT NULL,
                description VARCHAR2(500) NOT NULL,
                type VARCHAR2(10) NOT NULL CHECK (type IN ('income', 'expense')),
                category VARCHAR2(100) NOT NULL,
                user_id NUMBER NOT NULL,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                transaction_date DATE NOT NULL,
                CONSTRAINT fk_user_transaction FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.commit()
        print("✅ Created TRANSACTIONS table with foreign key constraint")
    except Exception as error:
        print(f"❌ Error creating transactions table: {error}")
        raise error
    finally:
        cursor.close()

async def check_and_create_goals_table(conn):
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT table_name FROM user_tables WHERE table_name = 'GOALS'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            await create_goals_table(conn)
            return
        
        print("✅ GOALS table already exists")
    except Exception as error:
        print(f"❌ Error checking/creating goals table: {error}")
        raise error
    finally:
        cursor.close()

async def create_goals_table(conn):
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE goals (
                id NUMBER PRIMARY KEY,
                user_id NUMBER NOT NULL,
                target_amount NUMBER NOT NULL,
                target_month NUMBER NOT NULL CHECK (target_month BETWEEN 1 AND 12),
                target_year NUMBER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_user_goal FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT unique_user_month_goal UNIQUE (user_id, target_month, target_year)
            )
        """)
        conn.commit()
        print("✅ Created GOALS table")
    except Exception as error:
        print(f"❌ Error creating goals table: {error}")
        raise error
    finally:
        cursor.close()

def get_connection():
    """Get a connection from the pool - synchronous for model methods"""
    if not connection_pool:
        raise Exception("Database not initialized. Call init_database first.")
    return connection_pool.acquire()

def release_connection(conn):
    """Release connection back to pool"""
    if connection_pool and conn:
        connection_pool.release(conn)

async def close_connection():
    """Close the connection pool"""
    global connection_pool
    if connection_pool:
        connection_pool.close()
        connection_pool = None
        print("✅ Database connection pool closed")