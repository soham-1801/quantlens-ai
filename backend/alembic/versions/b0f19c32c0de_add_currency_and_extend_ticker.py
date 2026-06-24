"""add_currency_and_extend_ticker

Revision ID: b0f19c32c0de
Revises: 1fdc4af2906b
Create Date: 2026-06-24 19:33:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0f19c32c0de'
down_revision: Union[str, None] = '1fdc4af2906b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add currency column and modify ticker length in watchlists
    with op.batch_alter_table('watchlists') as batch_op:
        batch_op.add_column(sa.Column('currency', sa.String(length=10), nullable=True, server_default='USD'))
        batch_op.alter_column('ticker',
               existing_type=sa.VARCHAR(length=10),
               type_=sa.String(length=32),
               existing_nullable=False)

    # Modify ticker length in sentiment_cache
    with op.batch_alter_table('sentiment_cache') as batch_op:
        batch_op.alter_column('ticker',
               existing_type=sa.VARCHAR(length=10),
               type_=sa.String(length=32),
               existing_nullable=False)


def downgrade() -> None:
    with op.batch_alter_table('sentiment_cache') as batch_op:
        batch_op.alter_column('ticker',
               existing_type=sa.String(length=32),
               type_=sa.VARCHAR(length=10),
               existing_nullable=False)

    with op.batch_alter_table('watchlists') as batch_op:
        batch_op.alter_column('ticker',
               existing_type=sa.String(length=32),
               type_=sa.VARCHAR(length=10),
               existing_nullable=False)
        batch_op.drop_column('currency')
