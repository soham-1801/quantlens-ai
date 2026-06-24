"""add_watchlist_overview_fields

Revision ID: aa2b5b81ef25
Revises: None
Create Date: 2026-06-15 20:44:30.819262

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa2b5b81ef25'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)

    # If the starting tables are missing, create them using metadata first
    if not inspector.has_table("users") or not inspector.has_table("watchlists") or not inspector.has_table("sentiment_cache"):
        from app.core.database import Base
        Base.metadata.create_all(bind=conn)
        inspector = inspect(conn)

    columns = {c["name"] for c in inspector.get_columns("watchlists")}

    if "company_name" not in columns:
        op.add_column('watchlists', sa.Column('company_name', sa.String(length=255), nullable=True))
    if "sector" not in columns:
        op.add_column('watchlists', sa.Column('sector', sa.String(length=255), nullable=True))
    if "industry" not in columns:
        op.add_column('watchlists', sa.Column('industry', sa.String(length=255), nullable=True))
    if "market_cap" not in columns:
        op.add_column('watchlists', sa.Column('market_cap', sa.BigInteger(), nullable=True))
    if "pe_ratio" not in columns:
        op.add_column('watchlists', sa.Column('pe_ratio', sa.Float(), nullable=True))
    if "dividend_yield" not in columns:
        op.add_column('watchlists', sa.Column('dividend_yield', sa.Float(), nullable=True))
    if "beta" not in columns:
        op.add_column('watchlists', sa.Column('beta', sa.Float(), nullable=True))
    if "eps" not in columns:
        op.add_column('watchlists', sa.Column('eps', sa.Float(), nullable=True))
    if "current_price" not in columns:
        op.add_column('watchlists', sa.Column('current_price', sa.Float(), nullable=True))
    if "previous_close" not in columns:
        op.add_column('watchlists', sa.Column('previous_close', sa.Float(), nullable=True))
    if "website" not in columns:
        op.add_column('watchlists', sa.Column('website', sa.Text(), nullable=True))
    if "updated_at" not in columns:
        op.add_column('watchlists', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
    if "refresh_error" not in columns:
        op.add_column('watchlists', sa.Column('refresh_error', sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)
    columns = {c["name"] for c in inspector.get_columns("watchlists")}

    if "refresh_error" in columns:
        op.drop_column('watchlists', 'refresh_error')
    if "updated_at" in columns:
        op.drop_column('watchlists', 'updated_at')
    if "website" in columns:
        op.drop_column('watchlists', 'website')
    if "previous_close" in columns:
        op.drop_column('watchlists', 'previous_close')
    if "current_price" in columns:
        op.drop_column('watchlists', 'current_price')
    if "eps" in columns:
        op.drop_column('watchlists', 'eps')
    if "beta" in columns:
        op.drop_column('watchlists', 'beta')
    if "dividend_yield" in columns:
        op.drop_column('watchlists', 'dividend_yield')
    if "pe_ratio" in columns:
        op.drop_column('watchlists', 'pe_ratio')
    if "market_cap" in columns:
        op.drop_column('watchlists', 'market_cap')
    if "industry" in columns:
        op.drop_column('watchlists', 'industry')
    if "sector" in columns:
        op.drop_column('watchlists', 'sector')
    if "company_name" in columns:
        op.drop_column('watchlists', 'company_name')
