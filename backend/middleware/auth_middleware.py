from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.security import verify_token
from models.user_model import UserModel

security = HTTPBearer()

async def authenticate_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Access token required"
        )

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = await UserModel.get_by_id(payload.get("user_id"))
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    if not user['is_active']:
        raise HTTPException(
            status_code=401,
            detail="Account is deactivated"
        )

    return user