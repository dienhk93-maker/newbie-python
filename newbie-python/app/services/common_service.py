from app.database import connection
from app.services.qdrant_service import QdrantService
from app.utils.error.error import InternalServerException
class CommonService:
    def __init__(self, qdrant_service: QdrantService):
        self.qdrant_service = qdrant_service
        
    async def db_check(self):
        try:
            await connection.client.admin.command("ping")
            return {"status": "ok", "db": "connected"}
        except Exception as e:
            raise InternalServerException(message="MongoDB error")

    async def qdrant_check(self):
        try:
            collections = await self.qdrant_service.client.get_collections()
            return {
                "status": "ok",
                "collections": [
                    collection.name
                    for collection in collections.collections
                ],
            }
        except Exception as e:
            raise InternalServerException(message = "Qdrant error")
