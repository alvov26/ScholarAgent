"""add_knowledge_graph_column

Revision ID: 004
Revises: 003
Create Date: 2026-02-27 01:00:00.000000

Add JSON column to papers table for storing knowledge graph data:
- knowledge_graph: {nodes: [...], edges: [...], metadata: {...}}
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, Sequence[str], None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add knowledge_graph column to papers table."""
    op.add_column('papers', sa.Column('knowledge_graph', sa.JSON, nullable=True))


def downgrade() -> None:
    """Remove knowledge_graph column from papers table."""
    op.drop_column('papers', 'knowledge_graph')
