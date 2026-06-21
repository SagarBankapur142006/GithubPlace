import asyncio
from app.database import engine, Base
# Import all models to register them on Base
from app.models import *

async def main():
    async with engine.begin() as conn:
        print("Dropping existing tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Schema recreated successfully!")

if __name__ == "__main__":
    asyncio.run(main())
