from app.config.database import get_connection
from datetime import datetime

class Transaction:
    @staticmethod
    async def create(transaction_data):
        conn = await get_connection()
        cursor = conn.cursor()
        try:
            amount = transaction_data['amount']
            description = transaction_data.get('desc') or transaction_data.get('description', '')
            type_ = transaction_data['type']
            category = transaction_data['category']
            user_id = transaction_data['user_id']
            transaction_date = transaction_data.get('date') or transaction_data.get('transaction_date')
            
            # Validate required fields
            if not all([amount, description, type_, category, user_id, transaction_date]):
                raise ValueError("All fields are required")
            
            # Validate transaction type
            if type_ not in ["income", "expense"]:
                raise ValueError("Type must be either 'income' or 'expense'")
            
            cursor.execute("SELECT transactions_seq.NEXTVAL AS id FROM DUAL")
            next_id = cursor.fetchone()[0]
            
            # Handle date parsing more robustly
            try:
                # Try to parse the date to ensure it's valid
                parsed_date = datetime.strptime(transaction_date, '%Y-%m-%d')
                formatted_date = parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                raise ValueError("Invalid date format. Use YYYY-MM-DD")
            
            cursor.execute("""
                INSERT INTO transactions (id, amount, description, type, category, user_id, transaction_date)
                VALUES (:id, :amount, :description, :type, :category, :user_id, TO_DATE(:transaction_date, 'YYYY-MM-DD'))
            """, {
                "id": next_id,
                "amount": float(amount),
                "description": description,
                "type": type_,
                "category": category,
                "user_id": user_id,
                "transaction_date": formatted_date
            })
            conn.commit()
            return next_id
        except Exception as error:
            conn.rollback()
            print(f"Error creating transaction: {error}")
            raise error
        finally:
            cursor.close()

    @staticmethod
    async def get_all(user_id):
        conn = await get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT id, amount, description, type, category,
                       TO_CHAR(date_created, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') as date_created,
                       TO_CHAR(transaction_date, 'YYYY-MM-DD') as transaction_date
                FROM transactions
                WHERE user_id = :user_id
                ORDER BY transaction_date DESC, date_created DESC
            """, {"user_id": user_id})
            rows = cursor.fetchall()
            return [{
                "id": row[0],
                "amount": float(row[1]),
                "desc": row[2],  # Changed from "description" to "desc" for frontend compatibility
                "type": row[3],
                "category": row[4],
                "date": row[6],  # Changed from "transaction_date" to "date"
                "date_created": row[5]
            } for row in rows]
        except Exception as error:
            print(f"Error getting transactions: {error}")
            return []
        finally:
            cursor.close()

    # Update the update method as well
    @staticmethod
    async def update(id_, transaction_data, user_id):
        conn = await get_connection()
        cursor = conn.cursor()
        try:
            amount = transaction_data['amount']
            description = transaction_data.get('desc') or transaction_data.get('description', '')
            type_ = transaction_data['type']
            category = transaction_data['category']
            transaction_date = transaction_data.get('date') or transaction_data.get('transaction_date')
            
            # Handle date parsing
            try:
                parsed_date = datetime.strptime(transaction_date, '%Y-%m-%d')
                formatted_date = parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                raise ValueError("Invalid date format. Use YYYY-MM-DD")
            
            cursor.execute("""
                UPDATE transactions
                SET amount = :amount, description = :description, type = :type, category = :category,
                    transaction_date = TO_DATE(:transaction_date, 'YYYY-MM-DD')
                WHERE id = :id AND user_id = :user_id
            """, {
                "amount": float(amount),
                "description": description,
                "type": type_,
                "category": category,
                "transaction_date": formatted_date,
                "id": id_,
                "user_id": user_id
            })
            conn.commit()
            return cursor.rowcount > 0
        except Exception as error:
            conn.rollback()
            print(f"Error updating transaction: {error}")
            raise error
        finally:
            cursor.close()