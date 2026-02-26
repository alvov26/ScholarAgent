"""add_paper_metadata_columns

Revision ID: 003
Revises: 002
Create Date: 2026-02-27 00:00:00.000000

Add JSON columns to papers table for storing extracted metadata:
- sections_data: Section hierarchy for TOC and agent pipeline
- equations_data: Equations with LaTeX source
- citations_data: Bibliography entries
- paper_metadata: Title, authors, abstract
- latex_source: Raw LaTeX content for agent context
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, Sequence[str], None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add metadata columns to papers table."""
    op.add_column('papers', sa.Column('sections_data', sa.JSON, nullable=True))
    op.add_column('papers', sa.Column('equations_data', sa.JSON, nullable=True))
    op.add_column('papers', sa.Column('citations_data', sa.JSON, nullable=True))
    op.add_column('papers', sa.Column('paper_metadata', sa.JSON, nullable=True))
    op.add_column('papers', sa.Column('latex_source', sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove metadata columns from papers table."""
    op.drop_column('papers', 'latex_source')
    op.drop_column('papers', 'paper_metadata')
    op.drop_column('papers', 'citations_data')
    op.drop_column('papers', 'equations_data')
    op.drop_column('papers', 'sections_data')
