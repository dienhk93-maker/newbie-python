from pymongo import AsyncMongoClient
from beanie import init_beanie

from app.config import settings
from app.models.user import User
from app.models.profile import Profile
from app.models.conversation import Conversation

class Database:
    client: AsyncMongoClient
    def __init__(self):
        self.client = AsyncMongoClient(settings.MONGODB_URL)
    
    async def init(self):
        try:
            await self.client.admin.command("ping")
            print("[SUCCESS] MongoDB connected")
        except Exception as e:
            print(f"[ERROR] MongoDB connection failed: {e}")
            raise e

        await init_beanie(
            database=self.client[settings.MONGODB_DB],
            document_models=[User, Profile, Conversation],
        )

    async def close(self):
        await self.client.close()

connection = Database()