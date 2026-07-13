import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def main():
    client = AsyncIOMotorClient("mongodb://root:password123@localhost:27017/my_app?authSource=admin")
    db = client.my_app
    
    # Let's verify standard DBRef query
    user_id = "6a5452bd923019b0b3ce1d1f"
    docs = await db.profiles.find({"user.$id": ObjectId(user_id)}).to_list(None)
    print(f"By user.$id: {len(docs)}")
    
    docs2 = await db.profiles.find({"user.id": ObjectId(user_id)}).to_list(None)
    print(f"By user.id: {len(docs2)}")
    
    # Find all profiles
    all_profiles = await db.profiles.find({}).to_list(None)
    if all_profiles:
        print(f"First profile user field: {all_profiles[0].get('user')}")

if __name__ == "__main__":
    asyncio.run(main())
