from fastapi import APIRouter
from dishka.integrations.fastapi import FromDishka, inject
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, RefreshTokenRequest
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.utils.error.error import BadRequestException

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", response_model=UserResponse, status_code=201)
@inject
async def register(
    register_data: RegisterRequest,
    auth_service: FromDishka[AuthService]
):
    """Register user"""
    try:
        user = await auth_service.register(register_data)
        return user
    except ValueError as e:
        raise BadRequestException(message=str(e))

@router.post("/login", response_model=TokenResponse)
@inject
async def login(
    login_data: LoginRequest,
    auth_service: FromDishka[AuthService]
):
    """Login user"""
    return await auth_service.login(login_data)

@router.post("/refresh", response_model=TokenResponse)
@inject
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    auth_service: FromDishka[AuthService]
):
    """Refresh token"""
    return await auth_service.refresh(refresh_data)
