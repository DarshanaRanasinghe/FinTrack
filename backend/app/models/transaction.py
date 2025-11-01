from app.config.database import get_connection, release_connection

class Transaction:
    @staticmethod
    async def create(transaction_data):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            amount = transaction_data['amount']
            description = transaction_data['desc']  # Changed from 'description' to 'desc'
            type_ = transaction_data['type']
            category = transaction_data['category']
            user_id = transaction_data['user_id']
            transaction_date = transaction_data['date']  # Changed from 'transaction_date' to 'date'
            
            # Validate transaction type
            if type_ not in ['income', 'expense']:
                raise ValueError("Transaction type must be 'income' or 'expense'")
            
            cursor.execute("SELECT transactions_seq.NEXTVAL AS id FROM DUAL")
            next_id = cursor.fetchone()[0]
            
            # Use proper date handling
            cursor.execute("""
                INSERT INTO transactions (id, amount, description, type, category, user_id, transaction_date)
                VALUES (:id, :amount, :description, :type, :category, :user_id, TO_DATE(:transaction_date, 'YYYY-MM-DD'))
            """, {
                "id": next_id,
                "amount": float(amount),
                "description": description,
                "type": type_,
                "category": category,
                "user_id": int(user_id),
                "transaction_date": transaction_date
            })
            conn.commit()
            return next_id
            
        except Exception as error:
            if conn:
                conn.rollback()
            print(f"❌ Error creating transaction: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def get_all(user_id):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, amount, description, type, category,
                       TO_CHAR(date_created, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') as date_created,
                       TO_CHAR(transaction_date, 'YYYY-MM-DD') as transaction_date
                FROM transactions
                WHERE user_id = :user_id
                ORDER BY transaction_date DESC, date_created DESC
            """, {"user_id": int(user_id)})
            
            rows = cursor.fetchall()
            return [{
                "id": row[0],
                "amount": float(row[1]),
                "desc": row[2],  # Changed to match frontend expectation
                "type": row[3],
                "category": row[4],
                "date": row[6],  # Changed from 'transaction_date' to 'date'
                "date_created": row[5]
            } for row in rows]
            
        except Exception as error:
            print(f"❌ Error getting transactions: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def get_by_id(id_, user_id):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, amount, description, type, category,
                       TO_CHAR(date_created, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') as date_created,
                       TO_CHAR(transaction_date, 'YYYY-MM-DD') as transaction_date
                FROM transactions
                WHERE id = :id AND user_id = :user_id
            """, {"id": int(id_), "user_id": int(user_id)})
            
            row = cursor.fetchone()
            if not row:
                return None
                
            return {
                "id": row[0],
                "amount": float(row[1]),
                "desc": row[2],
                "type": row[3],
                "category": row[4],
                "date": row[6],
                "date_created": row[5]
            }
            
        except Exception as error:
            print(f"❌ Error getting transaction by ID: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def get_by_month(user_id, month, year):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, amount, description, type, category,
                       TO_CHAR(date_created, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') as date_created,
                       TO_CHAR(transaction_date, 'YYYY-MM-DD') as transaction_date
                FROM transactions
                WHERE user_id = :user_id
                AND EXTRACT(MONTH FROM transaction_date) = :month
                AND EXTRACT(YEAR FROM transaction_date) = :year
                ORDER BY transaction_date DESC
            """, {
                "user_id": int(user_id), 
                "month": int(month), 
                "year": int(year)
            })
            
            rows = cursor.fetchall()
            return [{
                "id": row[0],
                "amount": float(row[1]),
                "desc": row[2],
                "type": row[3],
                "category": row[4],
                "date": row[6],
                "date_created": row[5]
            } for row in rows]
            
        except Exception as error:
            print(f"❌ Error getting transactions by month: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def delete(id_, user_id):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                DELETE FROM transactions 
                WHERE id = :id AND user_id = :user_id
            """, {"id": int(id_), "user_id": int(user_id)})
            
            conn.commit()
            return cursor.rowcount > 0
            
        except Exception as error:
            if conn:
                conn.rollback()
            print(f"❌ Error deleting transaction: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def update(id_, transaction_data, user_id):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            amount = transaction_data['amount']
            description = transaction_data['desc']
            type_ = transaction_data['type']
            category = transaction_data['category']
            transaction_date = transaction_data['date']
            
            # Validate transaction type
            if type_ not in ['income', 'expense']:
                raise ValueError("Transaction type must be 'income' or 'expense'")
            
            cursor.execute("""
                UPDATE transactions
                SET amount = :amount, description = :description, type = :type, 
                    category = :category, transaction_date = TO_DATE(:transaction_date, 'YYYY-MM-DD')
                WHERE id = :id AND user_id = :user_id
            """, {
                "amount": float(amount),
                "description": description,
                "type": type_,
                "category": category,
                "transaction_date": transaction_date,
                "id": int(id_),
                "user_id": int(user_id)
            })
            
            conn.commit()
            return cursor.rowcount > 0
            
        except Exception as error:
            if conn:
                conn.rollback()
            print(f"❌ Error updating transaction: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)