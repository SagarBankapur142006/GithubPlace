"""Initialize database tables and seed demo listings."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow running as: python scripts/bootstrap.py
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


async def main() -> None:
    from app.database import init_db

    print("Creating database tables...")
    await init_db()
    print("Tables ready.")

    print("Seeding demo listings...")
    from scripts.seed import seed

    await seed()
    print("Bootstrap complete.")


if __name__ == "__main__":
    asyncio.run(main())
