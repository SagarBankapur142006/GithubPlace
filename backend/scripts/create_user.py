import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
import sys
import os

# add backend path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///ideora_new.db")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        user = User(
            email="test@ideora.app",
            password_hash=pwd_context.hash("password123"),
            full_name="Ideora Tester"
        )
        session.add(user)
        await session.commit()
        print("Test user created!")

if __name__ == "__main__":
    asyncio.run(main())
