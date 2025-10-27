from fastapi import APIRouter, HTTPException, Depends, Query
from schemas.transaction_schema import TransactionCreate, TransactionUpdate, TransactionResponse
from models.transaction_model import TransactionModel
from middleware.auth_middleware import authenticate_token

router = APIRouter(prefix="/transactions", tags=["transactions"])

@router.post("", response_model=dict)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: dict = Depends(authenticate_token)
):
    try:
        if transaction_data.type not in ['income', 'expense']:
            raise HTTPException(
                status_code=400,
                detail="Type must be either 'income' or 'expense'"
            )

        transaction_dict = transaction_data.dict()
        transaction_dict['user_id'] = current_user['id']
        
        transaction_id = await TransactionModel.create(transaction_dict)
        
        return {
            "success": True,
            "message": "Transaction created successfully",
            "data": {"id": transaction_id}
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create transaction: {str(error)}"
        )

@router.get("", response_model=dict)
async def get_transactions(current_user: dict = Depends(authenticate_token)):
    try:
        transactions = await TransactionModel.get_all(current_user['id'])
        return {
            "success": True,
            "data": transactions
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch transactions: {str(error)}"
        )

@router.get("/{id}", response_model=dict)
async def get_transaction_by_id(id: int, current_user: dict = Depends(authenticate_token)):
    try:
        transaction = await TransactionModel.get_by_id(id, current_user['id'])
        
        if not transaction:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found"
            )
        
        return {
            "success": True,
            "data": transaction
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch transaction: {str(error)}"
        )

@router.get("/month/{month}/{year}", response_model=dict)
async def get_transactions_by_month(
    month: int, 
    year: int, 
    current_user: dict = Depends(authenticate_token)
):
    try:
        transactions = await TransactionModel.get_by_month(current_user['id'], month, year)
        return {
            "success": True,
            "data": transactions
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch transactions: {str(error)}"
        )

@router.put("/{id}", response_model=dict)
async def update_transaction(
    id: int,
    transaction_data: TransactionUpdate,
    current_user: dict = Depends(authenticate_token)
):
    try:
        if transaction_data.type not in ['income', 'expense']:
            raise HTTPException(
                status_code=400,
                detail="Type must be either 'income' or 'expense'"
            )

        updated = await TransactionModel.update(
            id, 
            transaction_data.dict(), 
            current_user['id']
        )
        
        if not updated:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found"
            )
        
        return {
            "success": True,
            "message": "Transaction updated successfully"
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update transaction: {str(error)}"
        )

@router.delete("/{id}", response_model=dict)
async def delete_transaction(id: int, current_user: dict = Depends(authenticate_token)):
    try:
        deleted = await TransactionModel.delete(id, current_user['id'])
        
        if not deleted:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found"
            )
        
        return {
            "success": True,
            "message": "Transaction deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete transaction: {str(error)}"
        )