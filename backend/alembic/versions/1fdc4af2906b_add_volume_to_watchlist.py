"""add_volume_to_watchlist

Revision ID: 1fdc4af2906b
Revises: aa2b5b81ef25
Create Date: 2026-06-16 10:35:43.932721

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1fdc4af2906b'
down_revision: Union[str, None] = 'aa2b5b81ef25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('watchlists', sa.Column('volume', sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('watchlists', 'volume')
