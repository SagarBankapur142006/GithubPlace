import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.types import JsonColumn


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    github_repo_url: Mapped[str | None] = mapped_column(String(512), unique=True, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    short_description: Mapped[str] = mapped_column(Text, nullable=False)
    expert_analysis: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    tech_stack: Mapped[list] = mapped_column(JsonColumn, nullable=False, default=list)
    complexity: Mapped[str] = mapped_column(String(50), nullable=False)
    revenue_model: Mapped[str] = mapped_column(String(100), nullable=False)
    growth_potential_score: Mapped[int] = mapped_column(Integer, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    meta_title: Mapped[str] = mapped_column(String(255), nullable=False)
    meta_description: Mapped[str] = mapped_column(Text, nullable=False)
    json_ld: Mapped[dict] = mapped_column(JsonColumn, nullable=False, default=dict)
    github_stars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    github_forks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_commit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    license: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_metadata: Mapped[dict] = mapped_column(JsonColumn, nullable=False, default=dict)
    live_demo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    demo_video_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pitch_deck: Mapped[dict] = mapped_column(JsonColumn, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_rescanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="listing")
    seller: Mapped["User"] = relationship("User", back_populates="listings")
