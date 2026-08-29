"""Category model — a small fixed lookup table.

Seeded once (see `app/db/seed.py`) with: Gym, Office, DSA/Learning,
Side Project, Prayer, Other. Not user-scoped in this version.
"""

from sqlalchemy import Boolean, String, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # Hex color used by the frontend for the category tag, e.g. "#4f46e5".
    color: Mapped[str] = mapped_column(
        String(9), nullable=False, default="#64748b", server_default="#64748b"
    )
    # True for categories that normally come from a recurring template
    # (Gym, Office, Prayer) rather than being added ad-hoc.
    is_recurring_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )

    tasks: Mapped[list["Task"]] = relationship(back_populates="category")  # noqa: F821
    recurring_templates: Mapped[list["RecurringTemplate"]] = relationship(  # noqa: F821
        back_populates="category"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Category id={self.id} name={self.name!r}>"
