"""Seed the fixed lookup data.

Currently just the six categories from PLAN.md. Idempotent: safe to run on
every deploy — existing rows are matched by name and their color /
is_recurring_default are refreshed to match this file.

Run:
    python -m app.db.seed
"""

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.category import Category

# name -> (color, is_recurring_default)
CATEGORIES: dict[str, tuple[str, bool]] = {
    "Gym": ("#ef4444", True),
    "Office": ("#3b82f6", True),
    "DSA/Learning": ("#8b5cf6", False),
    "Side Project": ("#10b981", False),
    "Prayer": ("#f59e0b", True),
    "Other": ("#64748b", False),
}


async def seed_categories() -> None:
    async with AsyncSessionLocal() as session:
        existing = {
            c.name: c
            for c in (await session.execute(select(Category))).scalars()
        }
        created, updated = 0, 0
        for name, (color, is_recurring_default) in CATEGORIES.items():
            row = existing.get(name)
            if row is None:
                session.add(
                    Category(
                        name=name,
                        color=color,
                        is_recurring_default=is_recurring_default,
                    )
                )
                created += 1
            elif (
                row.color != color
                or row.is_recurring_default != is_recurring_default
            ):
                row.color = color
                row.is_recurring_default = is_recurring_default
                updated += 1
        await session.commit()
        print(
            f"Categories seeded: {created} created, {updated} updated, "
            f"{len(CATEGORIES) - created - updated} unchanged."
        )


async def main() -> None:
    await seed_categories()


if __name__ == "__main__":
    asyncio.run(main())
