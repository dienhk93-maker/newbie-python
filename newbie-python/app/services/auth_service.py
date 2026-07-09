from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, RefreshTokenRequest
from app.schemas.user import UserCreate
from app.services.user_service import UserService
from app.core.jwt_handler import JWTHandler
from app.utils.error.error import UnauthorizedException
from app.config import settings

class AuthService:
    def __init__(self, user_service: UserService):
        self.user_service = user_service

    async def register(self, register_request: RegisterRequest):
        try:
            user_create = UserCreate(
                email=register_request.email,
                user_name=register_request.user_name,
                password=register_request.password,
                full_name=register_request.full_name,
                role=register_request.role
            )
            return await self.user_service.create_user(user_create)
        except Exception as e:
            raise e

    async def login(self, login_request: LoginRequest) -> TokenResponse:
        user = await self.user_service.get_by_email(login_request.email)
        if not user:
            raise UnauthorizedException("Incorrect email or password")

        if not JWTHandler.verify_password(login_request.password, user.hashed_password):
            raise UnauthorizedException("Incorrect email or password")
            
        access_token = JWTHandler.create_access_token({"sub": str(user.id), "role": user.role})
        refresh_token = JWTHandler.create_refresh_token({"sub": str(user.id), "role": user.role})
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    async def refresh(self, refresh_request: RefreshTokenRequest) -> TokenResponse:
        try:
            user_id = JWTHandler.get_user_id_from_token(refresh_request.refresh_token)
        except Exception:
            raise UnauthorizedException("Invalid or expired refresh token")
            
        user = await self.user_service.get_user_by_id(user_id)
        if not user:
            raise UnauthorizedException("User not found")
            
        access_token = JWTHandler.create_access_token({"sub": str(user.id), "role": user.role})
        new_refresh_token = JWTHandler.create_refresh_token({"sub": str(user.id), "role": user.role})
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
