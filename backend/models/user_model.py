from config.database import get_connection, release_connection
from utils.security import get_password_hash, verify_password
from typing import Optional

class UserModel:
    @staticmethod
    async def create(user_data: dict) -> int:
        connection = await get_connection()
        cursor = connection.cursor()
        
        name = user_data['name']
        email = user_data['email']
        password = user_data['password']
        date_of_birth = user_data['date_of_birth']
        
        try:
            # Check if user exists
            await cursor.execute(
                'SELECT id FROM users WHERE email = :email',
                {'email': email}
            )
            existing_user = await cursor.fetchone()

            if existing_user:
                raise Exception('User with this email already exists')

            # Hash password
            hashed_password = get_password_hash(password)

            # Get next sequence value
            await cursor.execute('SELECT users_seq.NEXTVAL FROM DUAL')
            seq_result = await cursor.fetchone()
            next_id = seq_result[0]

            # Insert user
            await cursor.execute(
                """INSERT INTO users (id, name, email, password, date_of_birth, is_active) 
                 VALUES (:id, :name, :email, :password, TO_DATE(:date_of_birth, 'YYYY-MM-DD'), :is_active)""",
                {
                    'id': next_id,
                    'name': name,
                    'email': email,
                    'password': hashed_password,
                    'date_of_birth': date_of_birth.strftime('%Y-%m-%d'),
                    'is_active': 1
                }
            )
            await connection.commit()
            
            return next_id
        except Exception as error:
            await connection.rollback()
            print(f'Error creating user: {error}')
            raise error
        finally:
            await cursor.close()
            await release_connection(connection)

    @staticmethod
    async def get_by_id(id: int) -> Optional[dict]:
        connection = await get_connection()
        cursor = connection.cursor()
        
        try:
            await cursor.execute(
                """SELECT id, name, email, date_of_birth, is_active,
                          created_at, last_login
                 FROM users 
                 WHERE id = :id""",
                {'id': id}
            )
            
            row = await cursor.fetchone()
            
            if not row:
                return None
            
            return {
                'id': row[0],
                'name': row[1],
                'email': row[2],
                'date_of_birth': row[3],
                'is_active': bool(row[4]),
                'created_at': row[5],
                'last_login': row[6]
            }
        except Exception as error:
            print(f'Error getting user by ID: {error}')
            raise error
        finally:
            await cursor.close()
            await release_connection(connection)

    @staticmethod
    async def get_by_email(email: str) -> Optional[dict]:
        connection = await get_connection()
        cursor = connection.cursor()
        
        try:
            await cursor.execute(
                """SELECT id, name, email, password, date_of_birth, is_active,
                          created_at, last_login
                 FROM users 
                 WHERE email = :email""",
                {'email': email}
            )
            
            row = await cursor.fetchone()
            
            if not row:
                return None
            
            return {
                'id': row[0],
                'name': row[1],
                'email': row[2],
                'password': row[3],
                'date_of_birth': row[4],
                'is_active': bool(row[5]),
                'created_at': row[6],
                'last_login': row[7]
            }
        except Exception as error:
            print(f'Error getting user by email: {error}')
            raise error
        finally:
            await cursor.close()
            await release_connection(connection)

    @staticmethod
    async def update_last_login(user_id: int):
        connection = await get_connection()
        cursor = connection.cursor()
        
        try:
            await cursor.execute(
                """UPDATE users 
                 SET last_login = CURRENT_TIMESTAMP 
                 WHERE id = :id""",
                {'id': user_id}
            )
            await connection.commit()
        except Exception as error:
            await connection.rollback()
            print(f'Error updating last login: {error}')
            raise error
        finally:
            await cursor.close()
            await release_connection(connection)

    @staticmethod
    async def compare_password(plain_password: str, hashed_password: str) -> bool:
        return verify_password(plain_password, hashed_password)