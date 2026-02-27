from datetime import datetime, UTC
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index, Boolean, Integer, JSON
from sqlalchemy.orm import DeclarativeBase, relationship


# Helper function for SQLAlchemy default datetime values
def utcnow():
    """Return current UTC time for use as SQLAlchemy default."""
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Paper(Base):
    __tablename__ = "papers"

    id = Column(String(64), primary_key=True)  # SHA256 hash
    filename = Column(String(255), nullable=False)
    arxiv_id = Column(String(20), nullable=True)
    html_content = Column(Text, nullable=True)  # Compiled HTML from LaTeXML
    uploaded_at = Column(DateTime, default=utcnow)
    compiled_at = Column(DateTime, nullable=True)

    # Extracted metadata (populated at compile time for agent pipeline)
    # Using JSON instead of JSONB for SQLite compatibility in tests
    # PostgreSQL will still use JSON efficiently
    sections_data = Column(JSON, nullable=True)     # Section hierarchy for TOC + agents
    equations_data = Column(JSON, nullable=True)    # Equations with LaTeX source
    citations_data = Column(JSON, nullable=True)    # Bibliography entries
    paper_metadata = Column(JSON, nullable=True)    # Title, authors, abstract
    latex_source = Column(Text, nullable=True)      # Raw main.tex content for agent context

    # Knowledge graph (populated by agent pipeline)
    knowledge_graph = Column(JSON, nullable=True)   # {nodes: [...], edges: [...], metadata: {...}}

    tooltips = relationship("Tooltip", back_populates="paper", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Paper(id={self.id[:8]}..., filename={self.filename})>"


class Tooltip(Base):
    __tablename__ = "tooltips"

    id = Column(String(64), primary_key=True)  # UUID or hash
    paper_id = Column(String(64), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    dom_node_id = Column(String(128), nullable=False)  # The data-id attribute from HTML
    user_id = Column(String(64), default="default")  # MVP: single user
    target_text = Column(String(512), nullable=True)  # What symbol/term this annotation explains
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)  # Pin to keep expanded
    display_order = Column(Integer, nullable=True)  # Manual ordering within section
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    paper = relationship("Paper", back_populates="tooltips")

    __table_args__ = (
        Index("idx_paper_node", "paper_id", "dom_node_id"),
        Index("idx_paper_user", "paper_id", "user_id"),
    )

    def __repr__(self):
        return f"<Tooltip(id={self.id[:8]}..., paper_id={self.paper_id[:8]}...)>"
