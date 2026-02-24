"""Initial schema - papers and tooltips

Revision ID: 001
Revises:
Create Date: 2024-02-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create papers table
    op.create_table(
        'papers',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('arxiv_id', sa.String(20), nullable=True),
        sa.Column('html_content', sa.Text(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), nullable=True),
        sa.Column('compiled_at', sa.DateTime(), nullable=True),
    )

    # Create tooltips table
    op.create_table(
        'tooltips',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('paper_id', sa.String(64), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('dom_node_id', sa.String(128), nullable=False),
        sa.Column('user_id', sa.String(64), nullable=True, server_default='default'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # Create indexes
    op.create_index('idx_paper_node', 'tooltips', ['paper_id', 'dom_node_id'])
    op.create_index('idx_paper_user', 'tooltips', ['paper_id', 'user_id'])


def downgrade() -> None:
    op.drop_index('idx_paper_user', table_name='tooltips')
    op.drop_index('idx_paper_node', table_name='tooltips')
    op.drop_table('tooltips')
    op.drop_table('papers')
