"""
Pytest configuration and fixtures for Scholar Agent tests.
"""

import os
import sys
import tempfile
import tarfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.app.database.models import Base


# =============================================================================
# Database Fixtures
# =============================================================================

@pytest.fixture(scope="function")
def test_db():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="function")
def test_db_engine():
    """Create an in-memory SQLite engine for testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)


# =============================================================================
# File Fixtures
# =============================================================================

@pytest.fixture
def fixtures_dir():
    """Return the path to the test fixtures directory."""
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def simple_tex_file(fixtures_dir):
    """Return the path to the simple_paper.tex fixture."""
    return fixtures_dir / "simple_paper.tex"


@pytest.fixture
def simple_tex_archive(simple_tex_file, tmp_path):
    """Create a .tar.gz archive containing the simple paper."""
    archive_path = tmp_path / "simple_paper.tar.gz"

    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(simple_tex_file, arcname="simple_paper.tex")

    return archive_path


@pytest.fixture
def sample_html():
    """Sample HTML content similar to LaTeXML output."""
    return """
<!DOCTYPE html>
<html>
<head>
    <title>Test Paper</title>
</head>
<body>
    <article>
        <h1 data-id="abc123">A Simple Test Paper</h1>
        <section data-id="def456">
            <h2>Introduction</h2>
            <p data-id="ghi789">This is a test paragraph with some text.</p>
            <p data-id="jkl012">Another paragraph here.</p>
        </section>
        <section data-id="mno345">
            <h2>Mathematics</h2>
            <p data-id="pqr678">Here is Euler's identity:</p>
            <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
                <mrow>
                    <msup><mi>e</mi><mrow><mi>i</mi><mi>π</mi></mrow></msup>
                    <mo>+</mo>
                    <mn>1</mn>
                    <mo>=</mo>
                    <mn>0</mn>
                </mrow>
            </math>
        </section>
    </article>
</body>
</html>
"""


@pytest.fixture
def temp_storage(tmp_path):
    """Create temporary storage directories."""
    uploads = tmp_path / "uploads"
    cache = tmp_path / "cache"
    uploads.mkdir()
    cache.mkdir()
    return {"uploads": uploads, "cache": cache, "root": tmp_path}


# =============================================================================
# API Test Client Fixture
# =============================================================================

@pytest.fixture
def api_client(temp_storage, monkeypatch):
    """Create a FastAPI test client with mocked database and storage."""
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    # Create an in-memory SQLite database with StaticPool for thread safety
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(engine)

    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Override the get_db dependency
    def override_get_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    # Import app and override dependencies
    from backend.app.api.main import app
    from backend.app.database.connection import get_db

    app.dependency_overrides[get_db] = override_get_db

    # Monkeypatch the UPLOADS_DIR
    monkeypatch.setattr("backend.app.api.main.UPLOADS_DIR", temp_storage["uploads"])

    client = TestClient(app)
    yield client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
