import asyncio
from bson import ObjectId
from app.models.profile import Profile
from app.models.user import User
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

async def main():
    client = AsyncIOMotorClient("mongodb://root:password123@localhost:27017/my_app?authSource=admin")
    await init_beanie(database=client.my_app, document_models=[User, Profile])
    
    user_id = "6a5452bd923019b0b3ce1d1f"
    
    # 1. Beanie native syntax
    try:
        p1 = await Profile.find_one(Profile.user.id == ObjectId(user_id), fetch_links=True)
        print("native:", getattr(p1, "id", None))
    except Exception as e:
        print("native error:", str(e))
        
    # 2. String syntax
    try:
        p2 = await Profile.find_one({"user.$id": ObjectId(user_id)}, fetch_links=True)
        print("string dict:", getattr(p2, "id", None))
    except Exception as e:
        print("string error:", str(e))

    # 3. DBRef syntax
    try:
        from bson.dbref import DBRef
        p3 = await Profile.find_one({"user": DBRef("users", ObjectId(user_id))}, fetch_links=True)
        print("dbref:", getattr(p3, "id", None))
    except Exception as e:
        print("dbref error:", str(e))

if __name__ == "__main__":
    asyncio.run(main())
