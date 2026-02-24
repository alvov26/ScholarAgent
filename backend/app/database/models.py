from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Paper(Base):
    __tablename__ = "papers"

    id = Column(String(64), primary_key=True)  # SHA256 hash
    filename = Column(String(255), nullable=False)
    arxiv_id = Column(String(20), nullable=True)
    html_content = Column(Text, nullable=True)  # Compiled HTML from LaTeXML
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    compiled_at = Column(DateTime, nullable=True)

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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    paper = relationship("Paper", back_populates="tooltips")

    __table_args__ = (
        Index("idx_paper_node", "paper_id", "dom_node_id"),
        Index("idx_paper_user", "paper_id", "user_id"),
    )

    def __repr__(self):
        return f"<Tooltip(id={self.id[:8]}..., paper_id={self.paper_id[:8]}...)>"
