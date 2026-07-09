
from fastapi import APIRouter
from dishka.integrations.fastapi import FromDishka, inject
from app.services.common_service import CommonService

router = APIRouter(tags=["Common"])

@router.get("/mongo/health")
@inject
async def db_check(common_service: FromDishka[CommonService]):
    return await common_service.db_check()

@router.get("/qdrant/health")
@inject
async def qdrant_health(
    common_service: FromDishka[CommonService]
):
    return await common_service.qdrant_check()

