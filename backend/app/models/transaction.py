@staticmethod
async def create(transaction_data):
    conn = await get_connection()
    cursor = conn.cursor()
    try:
        # Handle both 'desc' and 'description' fields
        description = transaction_data.get('desc') or transaction_data.get('description', '')
        # Handle both 'date' and 'transaction_date' fields
        transaction_date = transaction_data.get('date') or transaction_data.get('transaction_date', '')
        
        amount = transaction_data['amount']
        type_ = transaction_data['type']
        category = transaction_data['category']
        user_id = transaction_data['user_id']
        
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