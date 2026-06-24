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
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)

    # 1. Watchlists changes
    columns_watchlists = {c["name"]: c for c in inspector.get_columns("watchlists")}
    
    # Check if currency exists
    if "currency" not in columns_watchlists:
        with op.batch_alter_table('watchlists') as batch_op:
            batch_op.add_column(sa.Column('currency', sa.String(length=10), nullable=True, server_default='USD'))
            
    # Check ticker column length
    ticker_col = columns_watchlists.get("ticker")
    if ticker_col and getattr(ticker_col['type'], 'length', None) != 32:
        with op.batch_alter_table('watchlists') as batch_op:
            batch_op.alter_column('ticker',
                   existing_type=ticker_col['type'],
                   type_=sa.String(length=32),
                   existing_nullable=False)

    # 2. Sentiment Cache changes (only if table exists)
    if inspector.has_table('sentiment_cache'):
        columns_sentiment = {c["name"]: c for c in inspector.get_columns("sentiment_cache")}
        ticker_col_sent = columns_sentiment.get("ticker")
        if ticker_col_sent and getattr(ticker_col_sent['type'], 'length', None) != 32:
            with op.batch_alter_table('sentiment_cache') as batch_op:
                batch_op.alter_column('ticker',
                       existing_type=ticker_col_sent['type'],
                       type_=sa.String(length=32),
                       existing_nullable=False)


def downgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)

    if inspector.has_table('sentiment_cache'):
        columns_sentiment = {c["name"]: c for c in inspector.get_columns("sentiment_cache")}
        ticker_col_sent = columns_sentiment.get("ticker")
        if ticker_col_sent and getattr(ticker_col_sent['type'], 'length', None) == 32:
            with op.batch_alter_table('sentiment_cache') as batch_op:
                batch_op.alter_column('ticker',
                       existing_type=sa.String(length=32),
                       type_=sa.VARCHAR(length=10),
                       existing_nullable=False)

    if inspector.has_table('watchlists'):
        columns_watchlists = {c["name"]: c for c in inspector.get_columns("watchlists")}
        ticker_col_watch = columns_watchlists.get("ticker")
        if ticker_col_watch and getattr(ticker_col_watch['type'], 'length', None) == 32:
            with op.batch_alter_table('watchlists') as batch_op:
                batch_op.alter_column('ticker',
                       existing_type=sa.String(length=32),
                       type_=sa.VARCHAR(length=10),
                       existing_nullable=False)
                       
        if 'currency' in columns_watchlists:
            with op.batch_alter_table('watchlists') as batch_op:
                batch_op.drop_column('currency')
