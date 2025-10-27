import oracledb
import os
from dotenv import load_dotenv

load_dotenv()

# Don't initialize Oracle client - use thin mode for async
# oracledb.init_oracle_client()

class DatabaseConfig:
    def __init__(self):
        self.user = os.getenv('DB_USER', 'system')
        self.password = os.getenv('DB_PASSWORD', '123')
        self.host = os.getenv('DB_HOST', 'localhost')
        self.port = os.getenv('DB_PORT', '1521')
        self.sid = os.getenv('DB_SID', 'xe')
        self.pool = None
    
    def get_connection_string(self):
        return f"{self.host}:{self.port}/{self.sid}"

db_config = DatabaseConfig()

async def init_database():
    try:
        # Create async connection pool
        db_config.pool = oracledb.create_pool_async(
            user=db_config.user,
            password=db_config.password,
            dsn=db_config.get_connection_string(),
            min=2,
            max=10,
            increment=1
        )
        
        print('Connected to Oracle Database')
        
        # Get a connection to set up the database
        connection = await get_connection()
        
        # Create sequences
        await create_sequences(connection)
        
        # Check and create tables
        await check_and_create_users_table(connection)
        await check_and_create_transactions_table(connection)
        await check_and_create_goals_table(connection)
        
        # Release the connection back to the pool
        await connection.close()
        
        print('Database initialized successfully')
    except Exception as error:
        print(f'Database initialization error: {error}')
        raise error

async def create_sequences(connection):
    sequences = ['users_seq', 'transactions_seq', 'goals_seq']
    cursor = connection.cursor()
    
    for seq in sequences:
        try:
            await cursor.execute(f"""
                BEGIN
                    EXECUTE IMMEDIATE 'CREATE SEQUENCE {seq} START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE';
                EXCEPTION
                    WHEN OTHERS THEN
                        IF SQLCODE != -955 THEN
                            RAISE;
                        END IF;
                END;
            """)
            await connection.commit()
        except Exception as e:
            print(f"Error creating sequence {seq}: {e}")
    
    cursor.close()

async def check_and_create_users_table(connection):
    try:
        cursor = connection.cursor()
        
        await cursor.execute("""
            SELECT table_name 
            FROM user_tables 
            WHERE table_name = 'USERS'
        """)
        table_exists = await cursor.fetchone()

        if not table_exists:
            cursor.close()
            await create_users_table(connection)
            return

        required_columns = [
            'ID', 'NAME', 'EMAIL', 'PASSWORD', 'DATE_OF_BIRTH', 
            'IS_ACTIVE', 'LAST_LOGIN', 'CREATED_AT'
        ]

        await cursor.execute("""
            SELECT column_name 
            FROM user_tab_columns 
            WHERE table_name = 'USERS'
        """)
        existing_columns = await cursor.fetchall()

        existing_column_names = [row[0] for row in existing_columns]
        missing_columns = [col for col in required_columns if col not in existing_column_names]

        if missing_columns:
            print(f"Missing columns in USERS table: {', '.join(missing_columns)}")
            print('Dropping and recreating USERS table...')
            
            await cursor.execute('DROP TABLE users CASCADE CONSTRAINTS')
            await connection.commit()
            cursor.close()
            await create_users_table(connection)
        else:
            print('USERS table exists with all required columns')
            cursor.close()

    except Exception as error:
        print(f'Error checking/creating users table: {error}')
        raise error

async def create_users_table(connection):
    cursor = connection.cursor()
    await cursor.execute("""
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
    await connection.commit()
    cursor.close()
    print('Created USERS table')

async def check_and_create_transactions_table(connection):
    try:
        cursor = connection.cursor()
        
        await cursor.execute("""
            SELECT table_name 
            FROM user_tables 
            WHERE table_name = 'TRANSACTIONS'
        """)
        table_exists = await cursor.fetchone()

        if not table_exists:
            cursor.close()
            await create_transactions_table(connection)
            return

        required_columns = [
            'ID', 'AMOUNT', 'DESCRIPTION', 'TYPE', 'CATEGORY', 
            'USER_ID', 'DATE_CREATED', 'TRANSACTION_DATE'
        ]

        await cursor.execute("""
            SELECT column_name 
            FROM user_tab_columns 
            WHERE table_name = 'TRANSACTIONS'
        """)
        existing_columns = await cursor.fetchall()

        existing_column_names = [row[0] for row in existing_columns]
        missing_columns = [col for col in required_columns if col not in existing_column_names]

        if missing_columns:
            print(f"Missing columns in TRANSACTIONS table: {', '.join(missing_columns)}")
            print('Dropping and recreating TRANSACTIONS table...')
            
            await cursor.execute('DROP TABLE transactions CASCADE CONSTRAINTS')
            await connection.commit()
            cursor.close()
            await create_transactions_table(connection)
        else:
            print('TRANSACTIONS table exists with all required columns')
            
            try:
                await cursor.execute("""
                    SELECT constraint_name 
                    FROM user_constraints 
                    WHERE table_name = 'TRANSACTIONS' 
                    AND constraint_name = 'FK_USER_TRANSACTION'
                """)
                fk_exists = await cursor.fetchone()
                
                if not fk_exists:
                    print('Adding foreign key constraint...')
                    await cursor.execute("""
                        ALTER TABLE transactions 
                        ADD CONSTRAINT fk_user_transaction 
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    """)
                    await connection.commit()
            except Exception as fk_error:
                print(f'Error checking/adding foreign key: {fk_error}')
            
            cursor.close()

    except Exception as error:
        print(f'Error checking/creating transactions table: {error}')
        raise error

async def create_transactions_table(connection):
    cursor = connection.cursor()
    await cursor.execute("""
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
    await connection.commit()
    cursor.close()
    print('Created TRANSACTIONS table with foreign key constraint')

async def check_and_create_goals_table(connection):
    try:
        cursor = connection.cursor()
        
        await cursor.execute("""
            SELECT table_name 
            FROM user_tables 
            WHERE table_name = 'GOALS'
        """)
        table_exists = await cursor.fetchone()

        if not table_exists:
            cursor.close()
            await create_goals_table(connection)
            return

        print('GOALS table already exists')
        cursor.close()

    except Exception as error:
        print(f'Error checking/creating goals table: {error}')
        raise error

async def create_goals_table(connection):
    cursor = connection.cursor()
    await cursor.execute("""
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
    await connection.commit()
    cursor.close()
    print('Created GOALS table')

async def get_connection():
    """Get a connection from the pool"""
    try:
        if db_config.pool is None:
            raise Exception("Database pool not initialized")
        return await db_config.pool.acquire()
    except Exception as error:
        print(f'Error getting database connection: {error}')
        raise error

async def release_connection(connection):
    """Release connection back to pool"""
    if connection:
        try:
            await connection.close()
        except Exception as error:
            print(f'Error releasing connection: {error}')

async def close_connection():
    """Close the connection pool"""
    if db_config.pool:
        try:
            await db_config.pool.close()
            print('Database connection pool closed')
        except Exception as error:
            print(f'Error closing connection pool: {error}')