from fastapi import APIRouter, HTTPException, Depends
from schemas.goal_schema import GoalCreate, GoalUpdate, GoalResponse
from models.goal_model import GoalModel
from middleware.auth_middleware import authenticate_token

router = APIRouter(prefix="/goals", tags=["goals"])

@router.post("", response_model=dict)
async def create_goal(
    goal_data: GoalCreate,
    current_user: dict = Depends(authenticate_token)
):
    try:
        if goal_data.target_month < 1 or goal_data.target_month > 12:
            raise HTTPException(
                status_code=400,
                detail="Month must be between 1 and 12"
            )

        goal_dict = goal_data.dict()
        goal_dict['user_id'] = current_user['id']
        
        goal_id = await GoalModel.create(goal_dict)
        
        return {
            "success": True,
            "message": "Goal created successfully",
            "data": {"id": goal_id}
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create goal: {str(error)}"
        )

@router.get("", response_model=dict)
async def get_goals(current_user: dict = Depends(authenticate_token)):
    try:
        goals = await GoalModel.get_user_goals(current_user['id'])
        return {
            "success": True,
            "data": goals
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch goals: {str(error)}"
        )

@router.get("/{month}/{year}", response_model=dict)
async def get_goal_by_month(
    month: int, 
    year: int, 
    current_user: dict = Depends(authenticate_token)
):
    try:
        goal = await GoalModel.get_by_user_and_month(current_user['id'], month, year)
        return {
            "success": True,
            "data": goal
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch goal: {str(error)}"
        )

@router.put("/{id}", response_model=dict)
async def update_goal(
    id: int,
    goal_data: GoalUpdate,
    current_user: dict = Depends(authenticate_token)
):
    try:
        if goal_data.target_month < 1 or goal_data.target_month > 12:
            raise HTTPException(
                status_code=400,
                detail="Month must be between 1 and 12"
            )
        
        updated = await GoalModel.update(id, goal_data.dict(), current_user['id'])
        
        if not updated:
            raise HTTPException(
                status_code=404,
                detail="Goal not found"
            )
        
        return {
            "success": True,
            "message": "Goal updated successfully"
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update goal: {str(error)}"
        )

@router.delete("/{id}", response_model=dict)
async def delete_goal(id: int, current_user: dict = Depends(authenticate_token)):
    try:
        deleted = await GoalModel.delete(id, current_user['id'])
        
        if not deleted:
            raise HTTPException(
                status_code=404,
                detail="Goal not found"
            )
        
        return {
            "success": True,
            "message": "Goal deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete goal: {str(error)}"
        )