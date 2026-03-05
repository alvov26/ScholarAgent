#!/usr/bin/env python3
"""
Database migration script.
Creates all tables defined in models.py.
"""

from backend.app.database.connection import engine
from backend.app.database.models import Base

def migrate():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created successfully")

if __name__ == "__main__":
    migrate()
