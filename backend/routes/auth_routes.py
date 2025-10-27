from fastapi import APIRouter, HTTPException, Depends
from datetime import timedelta
from schemas.user_schema import UserCreate, UserLogin, UserResponse, Token
from models.user_model import UserModel
from utils.security import create_access_token, verify_password
from middleware.auth_middleware import authenticate_token

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=dict)
async def register(user_data: UserCreate):
    try:
        # Validation
        if len(user_data.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters long"
            )

        user_id = await UserModel.create(user_data.dict())
        
        return {
            "success": True,
            "message": "User registered successfully",
            "data": {"id": user_id}
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to register user: {str(error)}"
        )

@router.post("/login", response_model=dict)
async def login(login_data: UserLogin):
    try:
        if not login_data.email or not login_data.password:
            raise HTTPException(
                status_code=400,
                detail="Email and password are required"
            )
        
        user = await UserModel.get_by_email(login_data.email)
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        if not user['is_active']:
            raise HTTPException(
                status_code=401,
                detail="Account is deactivated"
            )
        
        is_password_valid = await UserModel.compare_password(login_data.password, user['password'])
        
        if not is_password_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        await UserModel.update_last_login(user['id'])
        
        access_token = create_access_token(
            data={"user_id": user['id'], "email": user['email']},
            expires_delta=timedelta(days=7)
        )
        
        user_response = UserResponse(**user)
        
        return {
            "success": True,
            "message": "Login successful",
            "data": {
                "user": user_response.dict(),
                "token": access_token,
                "expiresIn": "7d"
            }
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to login: {str(error)}"
        )

@router.get("/profile", response_model=dict)
async def get_profile(current_user: dict = Depends(authenticate_token)):
    try:
        user_response = UserResponse(**current_user)
        return {
            "success": True,
            "data": user_response.dict()
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get profile: {str(error)}"
        )

@router.put("/profile", response_model=dict)
async def update_profile(current_user: dict = Depends(authenticate_token)):
    # Implementation for profile update would go here
    return {
        "success": False,
        "message": "Profile update not implemented yet"
    }