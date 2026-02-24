"""
Tests for database models.
"""

from datetime import datetime

import pytest

from backend.app.database.models import Paper, Tooltip


class TestPaperModel:
    """Tests for the Paper model."""

    def test_create_paper(self, test_db):
        """Test creating a paper."""
        paper = Paper(
            id="abc123def456",
            filename="test_paper.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        # Retrieve and verify
        retrieved = test_db.query(Paper).filter(Paper.id == "abc123def456").first()
        assert retrieved is not None
        assert retrieved.filename == "test_paper.tar.gz"
        assert retrieved.html_content is None
        assert retrieved.arxiv_id is None

    def test_create_paper_with_arxiv_id(self, test_db):
        """Test creating a paper with arXiv ID."""
        paper = Paper(
            id="xyz789",
            filename="arXiv:2401.12345",
            arxiv_id="2401.12345",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        retrieved = test_db.query(Paper).filter(Paper.id == "xyz789").first()
        assert retrieved.arxiv_id == "2401.12345"

    def test_create_paper_with_html_content(self, test_db, sample_html):
        """Test creating a paper with compiled HTML."""
        paper = Paper(
            id="html123",
            filename="compiled_paper.tar.gz",
            html_content=sample_html,
            uploaded_at=datetime.utcnow(),
            compiled_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        retrieved = test_db.query(Paper).filter(Paper.id == "html123").first()
        assert retrieved.html_content is not None
        assert "Test Paper" in retrieved.html_content
        assert retrieved.compiled_at is not None

    def test_paper_repr(self, test_db):
        """Test the paper string representation."""
        paper = Paper(
            id="a" * 64,
            filename="test.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        repr_str = repr(paper)
        assert "Paper" in repr_str
        assert "aaaaaaaa" in repr_str  # First 8 chars of ID

    def test_delete_paper(self, test_db):
        """Test deleting a paper."""
        paper = Paper(
            id="delete_me",
            filename="to_delete.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        test_db.delete(paper)
        test_db.commit()

        retrieved = test_db.query(Paper).filter(Paper.id == "delete_me").first()
        assert retrieved is None


class TestTooltipModel:
    """Tests for the Tooltip model."""

    def test_create_tooltip(self, test_db):
        """Test creating a tooltip."""
        # First create a paper
        paper = Paper(
            id="paper_for_tooltip",
            filename="test.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        # Create tooltip
        tooltip = Tooltip(
            id="tooltip123",
            paper_id="paper_for_tooltip",
            dom_node_id="abc123",
            content="This is a test annotation",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        test_db.add(tooltip)
        test_db.commit()

        retrieved = test_db.query(Tooltip).filter(Tooltip.id == "tooltip123").first()
        assert retrieved is not None
        assert retrieved.content == "This is a test annotation"
        assert retrieved.dom_node_id == "abc123"

    def test_tooltip_default_user_id(self, test_db):
        """Test that tooltip has default user_id."""
        paper = Paper(
            id="paper_default_user",
            filename="test.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        tooltip = Tooltip(
            id="tooltip_default",
            paper_id="paper_default_user",
            dom_node_id="node123",
            content="Test content",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        test_db.add(tooltip)
        test_db.commit()

        retrieved = test_db.query(Tooltip).filter(Tooltip.id == "tooltip_default").first()
        assert retrieved.user_id == "default"

    def test_tooltip_paper_relationship(self, test_db):
        """Test the tooltip-paper relationship."""
        paper = Paper(
            id="paper_rel",
            filename="test.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        tooltip = Tooltip(
            id="tooltip_rel",
            paper_id="paper_rel",
            dom_node_id="node456",
            content="Related content",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        test_db.add(tooltip)
        test_db.commit()

        # Access paper through tooltip
        retrieved = test_db.query(Tooltip).filter(Tooltip.id == "tooltip_rel").first()
        assert retrieved.paper is not None
        assert retrieved.paper.id == "paper_rel"

    def test_paper_tooltips_relationship(self, test_db):
        """Test accessing tooltips through paper."""
        paper = Paper(
            id="paper_many_tooltips",
            filename="test.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        # Create multiple tooltips
        for i in range(3):
            tooltip = Tooltip(
                id=f"tooltip_many_{i}",
                paper_id="paper_many_tooltips",
                dom_node_id=f"node_{i}",
                content=f"Content {i}",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            test_db.add(tooltip)
        test_db.commit()

        # Access tooltips through paper
        retrieved_paper = test_db.query(Paper).filter(Paper.id == "paper_many_tooltips").first()
        assert len(retrieved_paper.tooltips) == 3

    def test_cascade_delete(self, test_db):
        """Test that deleting a paper deletes its tooltips."""
        paper = Paper(
            id="paper_cascade",
            filename="test.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        tooltip = Tooltip(
            id="tooltip_cascade",
            paper_id="paper_cascade",
            dom_node_id="cascade_node",
            content="Will be deleted",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        test_db.add(tooltip)
        test_db.commit()

        # Delete the paper
        test_db.delete(paper)
        test_db.commit()

        # Tooltip should be gone
        retrieved = test_db.query(Tooltip).filter(Tooltip.id == "tooltip_cascade").first()
        assert retrieved is None

    def test_update_tooltip_content(self, test_db):
        """Test updating tooltip content."""
        paper = Paper(
            id="paper_update",
            filename="test.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        tooltip = Tooltip(
            id="tooltip_update",
            paper_id="paper_update",
            dom_node_id="update_node",
            content="Original content",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        test_db.add(tooltip)
        test_db.commit()

        # Update content
        tooltip.content = "Updated content"
        tooltip.updated_at = datetime.utcnow()
        test_db.commit()

        retrieved = test_db.query(Tooltip).filter(Tooltip.id == "tooltip_update").first()
        assert retrieved.content == "Updated content"

    def test_tooltip_repr(self, test_db):
        """Test the tooltip string representation."""
        paper = Paper(
            id="a" * 64,
            filename="test.tar.gz",
            uploaded_at=datetime.utcnow()
        )
        test_db.add(paper)
        test_db.commit()

        tooltip = Tooltip(
            id="b" * 64,
            paper_id="a" * 64,
            dom_node_id="node",
            content="Test",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        test_db.add(tooltip)
        test_db.commit()

        repr_str = repr(tooltip)
        assert "Tooltip" in repr_str
        assert "bbbbbbbb" in repr_str  # First 8 chars of ID
