"""add_tooltip_pinning_and_ordering

Revision ID: 002
Revises: e9d58b39eaac
Create Date: 2026-02-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, Sequence[str], None] = 'e9d58b39eaac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tooltips', sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('tooltips', sa.Column('display_order', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tooltips', 'display_order')
    op.drop_column('tooltips', 'is_pinned')
