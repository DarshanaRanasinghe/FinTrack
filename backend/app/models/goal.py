from app.config.database import get_connection, release_connection

class Goal:
    @staticmethod
    async def create(goal_data):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            user_id = goal_data['user_id']
            target_amount = goal_data['target_amount']
            target_month = goal_data['target_month']
            target_year = goal_data['target_year']
            
            # Validate month range
            if target_month < 1 or target_month > 12:
                raise ValueError("Target month must be between 1 and 12")
            
            cursor.execute("SELECT goals_seq.NEXTVAL AS id FROM DUAL")
            next_id = cursor.fetchone()[0]
            
            cursor.execute("""
                INSERT INTO goals (id, user_id, target_amount, target_month, target_year)
                VALUES (:id, :user_id, :target_amount, :target_month, :target_year)
            """, {
                "id": next_id,
                "user_id": int(user_id),
                "target_amount": float(target_amount),
                "target_month": int(target_month),
                "target_year": int(target_year)
            })
            
            conn.commit()
            return next_id
            
        except Exception as error:
            if conn:
                conn.rollback()
            print(f"❌ Error creating goal: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def get_by_user_and_month(user_id, month, year):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, target_amount, target_month, target_year,
                       TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') as created_at
                FROM goals
                WHERE user_id = :user_id AND target_month = :target_month AND target_year = :target_year
            """, {
                "user_id": int(user_id), 
                "target_month": int(month), 
                "target_year": int(year)
            })
            
            row = cursor.fetchone()
            if not row:
                return None
                
            return {
                "id": row[0],
                "target_amount": float(row[1]),
                "target_month": row[2],
                "target_year": row[3],
                "created_at": row[4]
            }
            
        except Exception as error:
            print(f"❌ Error getting goal by user and month: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def get_user_goals(user_id):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, target_amount, target_month, target_year,
                       TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') as created_at
                FROM goals
                WHERE user_id = :user_id
                ORDER BY target_year DESC, target_month DESC
            """, {"user_id": int(user_id)})
            
            rows = cursor.fetchall()
            return [{
                "id": row[0],
                "target_amount": float(row[1]),
                "target_month": row[2],
                "target_year": row[3],
                "created_at": row[4]
            } for row in rows]
            
        except Exception as error:
            print(f"❌ Error getting user goals: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)

    @staticmethod
    async def update(id_, goal_data, user_id):
        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            target_amount = goal_data['target_amount']
            target_month = goal_data['target_month']
            target_year = goal_data['target_year']
            
            # Validate month range
            if target_month < 1 or target_month > 12:
                raise ValueError("Target month must be between 1 and 12")
            
            cursor.execute("""
                UPDATE goals
                SET target_amount = :target_amount, target_month = :target_month, target_year = :target_year
                WHERE id = :id AND user_id = :user_id
            """, {
                "target_amount": float(target_amount),
                "target_month": int(target_month),
                "target_year": int(target_year),
                "id": int(id_),
                "user_id": int(user_id)
            })
            
            conn.commit()
            return cursor.rowcount > 0
            
        except Exception as error:
            if conn:
                conn.rollback()
            print(f"❌ Error updating goal: {error}")
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
                DELETE FROM goals 
                WHERE id = :id AND user_id = :user_id
            """, {"id": int(id_), "user_id": int(user_id)})
            
            conn.commit()
            return cursor.rowcount > 0
            
        except Exception as error:
            if conn:
                conn.rollback()
            print(f"❌ Error deleting goal: {error}")
            raise error
        finally:
            if cursor:
                cursor.close()
            if conn:
                release_connection(conn)