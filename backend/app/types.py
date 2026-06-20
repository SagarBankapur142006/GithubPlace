from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB

# JSONB on Postgres, JSON on SQLite (dev fallback)
JsonColumn = JSON().with_variant(JSONB, "postgresql")
