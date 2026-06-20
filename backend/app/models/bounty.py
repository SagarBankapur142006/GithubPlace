import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

class Bounty(Base):
    __tablename__ = "bounties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    funder_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    github_issue_url: Mapped[str] = mapped_column(String(512), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open") # open, locked, resolved
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    funder: Mapped["User"] = relationship("User", backref="funded_bounties")
