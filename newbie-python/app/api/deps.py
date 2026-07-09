from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.jwt_handler import JWTHandler
from app.utils.error.error import UnauthorizedException
from app.constants.user_constant import Role

security = HTTPBearer()

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        user_id = JWTHandler.get_user_id_from_token(token)
        return user_id
    except Exception as e:
        raise UnauthorizedException("Invalid or missing authentication token")

# get role from token
def get_current_user_role(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        user_role = JWTHandler.get_role_from_token(token)
        return user_role
    except Exception as e:
        raise UnauthorizedException("Invalid or missing authentication token")