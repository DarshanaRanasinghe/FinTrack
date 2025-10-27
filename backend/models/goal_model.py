from config.database import get_connection
from typing import Optional, List

class GoalModel:
    @staticmethod
    async def create(goal_data: dict) -> int:
        connection = await get_connection()
        user_id = goal_data['user_id']
        target_amount = goal_data['target_amount']
        target_month = goal_data['target_month']
        target_year = goal_data['target_year']
        
        try:
            # Get next sequence value
            seq_result = await connection.execute(
                'SELECT goals_seq.NEXTVAL AS id FROM DUAL'
            )
            next_id = seq_result[0]

            # Insert goal
            await connection.execute(
                """INSERT INTO goals (id, user_id, target_amount, target_month, target_year) 
                 VALUES (:id, :user_id, :target_amount, :target_month, :target_year)""",
                {
                    'id': next_id,
                    'user_id': user_id,
                    'target_amount': target_amount,
                    'target_month': target_month,
                    'target_year': target_year
                }
            )
            connection.commit()
            
            return next_id
        except Exception as error:
            connection.rollback()
            print(f'Error creating goal: {error}')
            raise error

    @staticmethod
    async def get_by_user_and_month(user_id: int, month: int, year: int) -> Optional[dict]:
        connection = await get_connection()
        try:
            result = await connection.execute(
                """SELECT id, target_amount, target_month, target_year, created_at
                 FROM goals 
                 WHERE user_id = :user_id AND target_month = :target_month AND target_year = :target_year""",
                [user_id, month, year]
            )
            
            if not result:
                return None
            
            row = result[0]
            return {
                'id': row[0],
                'target_amount': float(row[1]),
                'target_month': row[2],
                'target_year': row[3],
                'created_at': row[4]
            }
        except Exception as error:
            print(f'Error getting goal by user and month: {error}')
            raise error

    @staticmethod
    async def get_user_goals(user_id: int) -> List[dict]:
        connection = await get_connection()
        try:
            result = await connection.execute(
                """SELECT id, target_amount, target_month, target_year, created_at
                 FROM goals 
                 WHERE user_id = :user_id
                 ORDER BY target_year DESC, target_month DESC""",
                [user_id]
            )
            
            return [{
                'id': row[0],
                'target_amount': float(row[1]),
                'target_month': row[2],
                'target_year': row[3],
                'created_at': row[4]
            } for row in result]
        except Exception as error:
            print(f'Error getting user goals: {error}')
            raise error

    @staticmethod
    async def update(id: int, goal_data: dict, user_id: int) -> bool:
        connection = await get_connection()
        target_amount = goal_data['target_amount']
        target_month = goal_data['target_month']
        target_year = goal_data['target_year']
        
        try:
            result = await connection.execute(
                """UPDATE goals 
                 SET target_amount = :target_amount, target_month = :target_month, target_year = :target_year
                 WHERE id = :id AND user_id = :user_id""",
                { 
                    'target_amount': target_amount, 
                    'target_month': target_month, 
                    'target_year': target_year, 
                    'id': id,
                    'user_id': user_id
                }
            )
            connection.commit()
            
            return result.rowcount > 0
        except Exception as error:
            connection.rollback()
            print(f'Error updating goal: {error}')
            raise error

    @staticmethod
    async def delete(id: int, user_id: int) -> bool:
        connection = await get_connection()
        try:
            result = await connection.execute(
                'DELETE FROM goals WHERE id = :id AND user_id = :user_id',
                [id, user_id]
            )
            connection.commit()
            
            return result.rowcount > 0
        except Exception as error:
            connection.rollback()
            print(f'Error deleting goal: {error}')
            raise error