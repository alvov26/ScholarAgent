"""add_entity_id_to_tooltips

Revision ID: 23e94fe3e028
Revises: 004
Create Date: 2026-03-03 17:15:05.227778

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '23e94fe3e028'
down_revision: Union[str, Sequence[str], None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add entity_id column to tooltips table for semantic tooltips."""
    # Add entity_id column (nullable to support both semantic and paragraph tooltips)
    op.add_column('tooltips', sa.Column('entity_id', sa.String(length=128), nullable=True))

    # Create index for performance on entity_id lookups
    op.create_index('idx_paper_entity', 'tooltips', ['paper_id', 'entity_id'])

    # Make dom_node_id nullable (it was NOT NULL before, but now semantic tooltips won't have it)
    op.alter_column('tooltips', 'dom_node_id',
                    existing_type=sa.String(length=128),
                    nullable=True)


def downgrade() -> None:
    """Remove entity_id column and revert dom_node_id to NOT NULL."""
    # Drop index
    op.drop_index('idx_paper_entity', table_name='tooltips')

    # Remove entity_id column
    op.drop_column('tooltips', 'entity_id')

    # Revert dom_node_id to NOT NULL (may fail if semantic tooltips exist)
    op.alter_column('tooltips', 'dom_node_id',
                    existing_type=sa.String(length=128),
                    nullable=False)
