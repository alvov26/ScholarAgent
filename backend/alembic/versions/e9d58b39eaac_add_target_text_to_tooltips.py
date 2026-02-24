"""add_target_text_to_tooltips

Revision ID: e9d58b39eaac
Revises: 001
Create Date: 2026-02-24 23:20:32.407844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9d58b39eaac'
down_revision: Union[str, Sequence[str], None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tooltips', sa.Column('target_text', sa.String(512), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tooltips', 'target_text')
