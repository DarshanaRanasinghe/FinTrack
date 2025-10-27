from config.database import get_connection
from typing import Optional, List

class TransactionModel:
    @staticmethod
    async def create(transaction_data: dict) -> int:
        connection = await get_connection()
        amount = transaction_data['amount']
        description = transaction_data['description']
        type_ = transaction_data['type']
        category = transaction_data['category']
        user_id = transaction_data['user_id']
        transaction_date = transaction_data['transaction_date']
        
        try:
            # Get next sequence value
            seq_result = await connection.execute(
                'SELECT transactions_seq.NEXTVAL AS id FROM DUAL'
            )
            next_id = seq_result[0]

            # Insert transaction
            await connection.execute(
                """INSERT INTO transactions (id, amount, description, type, category, user_id, transaction_date) 
                 VALUES (:id, :amount, :description, :type, :category, :user_id, TO_DATE(:transaction_date, 'YYYY-MM-DD'))""",
                {
                    'id': next_id,
                    'amount': amount,
                    'description': description,
                    'type': type_,
                    'category': category,
                    'user_id': user_id,
                    'transaction_date': transaction_date.strftime('%Y-%m-%d')
                }
            )
            connection.commit()
            
            return next_id
        except Exception as error:
            connection.rollback()
            print(f'Error creating transaction: {error}')
            raise error

    @staticmethod
    async def get_all(user_id: int) -> List[dict]:
        connection = await get_connection()
        try:
            result = await connection.execute(
                """SELECT id, amount, description, type, category, 
                          date_created, transaction_date
                 FROM transactions 
                 WHERE user_id = :user_id
                 ORDER BY transaction_date DESC, date_created DESC""",
                [user_id]
            )
            
            return [{
                'id': row[0],
                'amount': float(row[1]),
                'description': row[2],
                'type': row[3],
                'category': row[4],
                'date_created': row[5],
                'transaction_date': row[6]
            } for row in result]
        except Exception as error:
            print(f'Error getting transactions: {error}')
            raise error

    @staticmethod
    async def get_by_id(id: int, user_id: int) -> Optional[dict]:
        connection = await get_connection()
        try:
            result = await connection.execute(
                """SELECT id, amount, description, type, category, 
                          date_created, transaction_date
                 FROM transactions 
                 WHERE id = :id AND user_id = :user_id""",
                [id, user_id]
            )
            
            if not result:
                return None
            
            row = result[0]
            return {
                'id': row[0],
                'amount': float(row[1]),
                'description': row[2],
                'type': row[3],
                'category': row[4],
                'date_created': row[5],
                'transaction_date': row[6]
            }
        except Exception as error:
            print(f'Error getting transaction by ID: {error}')
            raise error

    @staticmethod
    async def get_by_month(user_id: int, month: int, year: int) -> List[dict]:
        connection = await get_connection()
        try:
            result = await connection.execute(
                """SELECT id, amount, description, type, category, 
                          date_created, transaction_date
                 FROM transactions 
                 WHERE user_id = :user_id 
                 AND EXTRACT(MONTH FROM transaction_date) = :month 
                 AND EXTRACT(YEAR FROM transaction_date) = :year
                 ORDER BY transaction_date DESC""",
                [user_id, month, year]
            )
            
            return [{
                'id': row[0],
                'amount': float(row[1]),
                'description': row[2],
                'type': row[3],
                'category': row[4],
                'date_created': row[5],
                'transaction_date': row[6]
            } for row in result]
        except Exception as error:
            print(f'Error getting transactions by month: {error}')
            raise error

    @staticmethod
    async def delete(id: int, user_id: int) -> bool:
        connection = await get_connection()
        try:
            result = await connection.execute(
                'DELETE FROM transactions WHERE id = :id AND user_id = :user_id',
                [id, user_id]
            )
            connection.commit()
            
            return result.rowcount > 0
        except Exception as error:
            connection.rollback()
            print(f'Error deleting transaction: {error}')
            raise error

    @staticmethod
    async def update(id: int, transaction_data: dict, user_id: int) -> bool:
        connection = await get_connection()
        amount = transaction_data['amount']
        description = transaction_data['description']
        type_ = transaction_data['type']
        category = transaction_data['category']
        transaction_date = transaction_data['transaction_date']
        
        try:
            result = await connection.execute(
                """UPDATE transactions 
                 SET amount = :amount, description = :description, type = :type, 
                     category = :category, transaction_date = TO_DATE(:transaction_date, 'YYYY-MM-DD')
                 WHERE id = :id AND user_id = :user_id""",
                { 
                    'amount': amount, 
                    'description': description, 
                    'type': type_, 
                    'category': category, 
                    'transaction_date': transaction_date.strftime('%Y-%m-%d'),
                    'id': id,
                    'user_id': user_id
                }
            )
            connection.commit()
            
            return result.rowcount > 0
        except Exception as error:
            connection.rollback()
            print(f'Error updating transaction: {error}')
            raise error