import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.types import JsonColumn

class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    repo_url: Mapped[str] = mapped_column(String(512), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    pricing_tier: Mapped[str] = mapped_column(String(50), nullable=False, default="Free")
    preview_schema: Mapped[dict] = mapped_column(JsonColumn, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", backref="deployments")
