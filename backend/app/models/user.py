import bcrypt
from app.config.database import get_connection, release_connection

class User:
    @staticmethod
    async def create(user_data):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            name = user_data['name']
            email = user_data['email']
            password = user_data['password']
            date_of_birth = user_data['date_of_birth']
            
            # Check if user already exists
            cursor.execute("SELECT id FROM users WHERE email = :email", {"email": email})
            if cursor.fetchone():
                raise ValueError("User with this email already exists")
            
            # Hash password
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Get next sequence value
            cursor.execute("SELECT users_seq.NEXTVAL AS id FROM DUAL")
            next_id = cursor.fetchone()[0]
            
            # Insert user
            cursor.execute("""
                INSERT INTO users (id, name, email, password, date_of_birth, is_active)
                VALUES (:id, :name, :email, :password, TO_DATE(:date_of_birth, 'YYYY-MM-DD'), 1)
            """, {
                "id": next_id,
                "name": name,
                "email": email,
                "password": hashed_password,
                "date_of_birth": date_of_birth
            })
            
            conn.commit()
            return next_id
            
        except Exception as error:
            if conn:
                conn.rollback()
            print(f"❌ Error creating user: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def get_by_id(user_id):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, name, email, 
                       TO_CHAR(date_of_birth, 'YYYY-MM-DD') as date_of_birth, 
                       is_active,
                       TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') as created_at
                FROM users
                WHERE id = :id
            """, {"id": int(user_id)})
            
            row = cursor.fetchone()
            if not row:
                return None
                
            return {
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "date_of_birth": row[3],
                "is_active": row[4] == 1,
                "created_at": row[5]
            }
            
        except Exception as error:
            print(f"❌ Error getting user by ID: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def get_by_email(email):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, name, email, password, 
                       TO_CHAR(date_of_birth, 'YYYY-MM-DD') as date_of_birth, 
                       is_active,
                       TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') as created_at
                FROM users
                WHERE email = :email
            """, {"email": email})
            
            row = cursor.fetchone()
            if not row:
                return None
                
            return {
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "password": row[3],
                "date_of_birth": row[4],
                "is_active": row[5] == 1,
                "created_at": row[6]
            }
            
        except Exception as error:
            print(f"❌ Error getting user by email: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def update_last_login(user_id):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE users
                SET last_login = CURRENT_TIMESTAMP
                WHERE id = :id
            """, {"id": int(user_id)})
            
            conn.commit()
            
        except Exception as error:
            if conn:
                conn.rollback()
            print(f"❌ Error updating last login: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    def compare_password(plain_password, hashed_password):
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception as error:
            print(f"❌ Error comparing passwords: {error}")
            return False