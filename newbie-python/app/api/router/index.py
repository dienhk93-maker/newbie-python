from fastapi import FastAPI, APIRouter
from app.api.v1.common import router as common_router
from app.api.v1.user import router as user_router
from app.api.v1.auth import router as auth_router
from app.api.v1.profile import router as profile_router
from app.api.v1.ai_search import router as ai_search_router
from app.api.v1.conversation import router as conversation_router

def setup_routers(app: FastAPI) -> None:
    # Common router (no prefix)
    app.include_router(common_router)
    
    # API V1 router group
    v1_router = APIRouter(prefix="/api/v1")
    v1_router.include_router(auth_router)
    v1_router.include_router(user_router)
    v1_router.include_router(profile_router)
    v1_router.include_router(ai_search_router)
    v1_router.include_router(conversation_router)
    
    app.include_router(v1_router)

