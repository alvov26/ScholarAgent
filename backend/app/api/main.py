import hashlib
import os
import re
import uuid
from datetime import datetime, UTC
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import Paper, Tooltip
from backend.app.compiler.latexml_compiler import compile_latex_to_html

app = FastAPI(title="Scholar Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage directories
UPLOADS_DIR = Path("storage/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Configuration
USE_DOCKER = os.getenv("LATEXML_USE_DOCKER", "true").lower() == "true"


# =============================================================================
# Pydantic Models
# =============================================================================

class PaperResponse(BaseModel):
    id: str
    filename: str
    arxiv_id: Optional[str] = None
    uploaded_at: datetime
    compiled_at: Optional[datetime] = None
    has_html: bool

    class Config:
        from_attributes = True


class PaperDetailResponse(PaperResponse):
    html_content: Optional[str] = None


class TooltipCreate(BaseModel):
    dom_node_id: str
    target_text: Optional[str] = None
    content: str


class TooltipUpdate(BaseModel):
    target_text: Optional[str] = None
    content: str


class TooltipResponse(BaseModel):
    id: str
    paper_id: str
    dom_node_id: str
    user_id: str
    target_text: Optional[str] = None
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Root
# =============================================================================

@app.get("/")
async def root():
    return {"message": "Scholar Agent API - LaTeX-first MVP"}


# =============================================================================
# Paper Management
# =============================================================================

@app.post("/api/papers/upload", response_model=PaperResponse)
async def upload_paper(
    file: UploadFile = File(...),
    compile_now: bool = Form(default=True),
    db: Session = Depends(get_db)
):
    """Upload a .tar.gz LaTeX source archive and optionally compile to HTML."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a name")

    archive_type = _get_archive_type(file.filename)
    if not archive_type:
        raise HTTPException(
            status_code=400,
            detail="Only .tar.gz, .tgz, .tar, or .zip archives are supported"
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="File is empty")

    file_hash = hashlib.sha256(data).hexdigest()
    upload_ext = ".tar.gz" if archive_type == "tar" else ".zip"
    upload_path = UPLOADS_DIR / f"{file_hash}{upload_ext}"

    # Check if paper already exists
    existing = db.query(Paper).filter(Paper.id == file_hash).first()
    if existing:
        return _paper_to_response(existing)

    # Save upload
    if not upload_path.exists():
        with open(upload_path, "wb") as handle:
            handle.write(data)

    # Create paper record
    paper = Paper(
        id=file_hash,
        filename=file.filename,
        uploaded_at=datetime.now(UTC)
    )

    # Compile if requested
    if compile_now:
        try:
            html = compile_latex_to_html(upload_path, file_hash, use_docker=USE_DOCKER)
            paper.html_content = html
            paper.compiled_at = datetime.now(UTC)
        except Exception as e:
            # Store paper without HTML, log error
            paper.html_content = None
            # Could add error logging here

    db.add(paper)
    db.commit()
    db.refresh(paper)

    return _paper_to_response(paper)


@app.post("/api/papers/upload/arxiv", response_model=PaperResponse)
async def upload_arxiv_source(
    url_or_id: str = Form(...),
    compile_now: bool = Form(default=True),
    db: Session = Depends(get_db)
):
    """Download arXiv source and compile to HTML."""
    arxiv_id = _extract_arxiv_id(url_or_id)
    if not arxiv_id:
        raise HTTPException(status_code=400, detail="Invalid arXiv URL or ID")

    file_hash, archive_path = await _download_arxiv_source(arxiv_id)

    # Check if paper already exists
    existing = db.query(Paper).filter(Paper.id == file_hash).first()
    if existing:
        return _paper_to_response(existing)

    # Create paper record
    paper = Paper(
        id=file_hash,
        filename=f"arXiv:{arxiv_id}",
        arxiv_id=arxiv_id,
        uploaded_at=datetime.now(UTC)
    )

    # Compile if requested
    if compile_now:
        try:
            html = compile_latex_to_html(archive_path, file_hash, use_docker=USE_DOCKER)
            paper.html_content = html
            paper.compiled_at = datetime.now(UTC)
        except Exception as e:
            paper.html_content = None

    db.add(paper)
    db.commit()
    db.refresh(paper)

    return _paper_to_response(paper)


@app.post("/api/papers/{paper_id}/compile", response_model=PaperResponse)
async def compile_paper(paper_id: str, db: Session = Depends(get_db)):
    """Trigger compilation for an uploaded paper."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Find source file
    source_path = _find_source_file(paper_id)
    if not source_path:
        raise HTTPException(status_code=404, detail="Source file not found")

    try:
        html = compile_latex_to_html(source_path, paper_id, use_docker=USE_DOCKER)
        paper.html_content = html
        paper.compiled_at = datetime.now(UTC)
        db.commit()
        db.refresh(paper)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compilation failed: {str(e)}")

    return _paper_to_response(paper)


@app.get("/api/papers", response_model=list[PaperResponse])
async def list_papers(db: Session = Depends(get_db)):
    """List all papers."""
    papers = db.query(Paper).order_by(Paper.uploaded_at.desc()).all()
    return [_paper_to_response(p) for p in papers]


@app.get("/api/papers/{paper_id}", response_model=PaperDetailResponse)
async def get_paper(paper_id: str, db: Session = Depends(get_db)):
    """Get paper with compiled HTML."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    return PaperDetailResponse(
        id=paper.id,
        filename=paper.filename,
        arxiv_id=paper.arxiv_id,
        uploaded_at=paper.uploaded_at,
        compiled_at=paper.compiled_at,
        has_html=paper.html_content is not None,
        html_content=paper.html_content
    )


@app.delete("/api/papers/{paper_id}")
async def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    """Delete a paper and all associated tooltips."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Delete source files
    deleted_files = []
    for ext in [".tar.gz", ".tgz", ".tar", ".zip"]:
        path = UPLOADS_DIR / f"{paper_id}{ext}"
        if path.exists():
            path.unlink()
            deleted_files.append(str(path))

    # Delete from database (cascades to tooltips)
    db.delete(paper)
    db.commit()

    return {"status": "success", "paper_id": paper_id, "deleted_files": deleted_files}


# =============================================================================
# Tooltip Management
# =============================================================================

@app.get("/api/papers/{paper_id}/tooltips", response_model=list[TooltipResponse])
async def get_tooltips(paper_id: str, db: Session = Depends(get_db)):
    """Get all tooltips for a paper."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    tooltips = db.query(Tooltip).filter(Tooltip.paper_id == paper_id).all()
    return tooltips


@app.post("/api/papers/{paper_id}/tooltips", response_model=TooltipResponse)
async def create_tooltip(
    paper_id: str,
    tooltip: TooltipCreate,
    db: Session = Depends(get_db)
):
    """Create a new tooltip anchored to a DOM node. Supports multiple annotations per node."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Create new tooltip (allow multiple per node now)
    new_tooltip = Tooltip(
        id=str(uuid.uuid4()),
        paper_id=paper_id,
        dom_node_id=tooltip.dom_node_id,
        target_text=tooltip.target_text,
        content=tooltip.content,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )

    db.add(new_tooltip)
    db.commit()
    db.refresh(new_tooltip)

    return new_tooltip


@app.put("/api/papers/{paper_id}/tooltips/{tooltip_id}", response_model=TooltipResponse)
async def update_tooltip(
    paper_id: str,
    tooltip_id: str,
    tooltip: TooltipUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing tooltip."""
    existing = db.query(Tooltip).filter(
        Tooltip.id == tooltip_id,
        Tooltip.paper_id == paper_id
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Tooltip not found")

    if tooltip.target_text is not None:
        existing.target_text = tooltip.target_text
    existing.content = tooltip.content
    existing.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(existing)

    return existing


@app.delete("/api/papers/{paper_id}/tooltips/{tooltip_id}")
async def delete_tooltip(paper_id: str, tooltip_id: str, db: Session = Depends(get_db)):
    """Delete a tooltip."""
    existing = db.query(Tooltip).filter(
        Tooltip.id == tooltip_id,
        Tooltip.paper_id == paper_id
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Tooltip not found")

    db.delete(existing)
    db.commit()

    return {"status": "success", "tooltip_id": tooltip_id}


# =============================================================================
# Helper Functions
# =============================================================================

def _paper_to_response(paper: Paper) -> PaperResponse:
    return PaperResponse(
        id=paper.id,
        filename=paper.filename,
        arxiv_id=paper.arxiv_id,
        uploaded_at=paper.uploaded_at,
        compiled_at=paper.compiled_at,
        has_html=paper.html_content is not None
    )


def _get_archive_type(filename: str) -> str | None:
    name = filename.lower()
    if name.endswith(".tar.gz") or name.endswith(".tgz") or name.endswith(".tar"):
        return "tar"
    if name.endswith(".zip"):
        return "zip"
    return None


def _extract_arxiv_id(value: str) -> str | None:
    value = value.strip()
    match = re.search(r"arxiv\.org/(abs|pdf|e-print)/([0-9.]+)", value)
    if match:
        return match.group(2)
    match = re.fullmatch(r"[0-9.]+", value)
    if match:
        return value
    return None


async def _download_arxiv_source(arxiv_id: str) -> tuple[str, Path]:
    url = f"https://arxiv.org/e-print/{arxiv_id}"
    async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.content

    file_hash = hashlib.sha256(data).hexdigest()
    archive_path = UPLOADS_DIR / f"{file_hash}.tar.gz"
    if not archive_path.exists():
        with open(archive_path, "wb") as handle:
            handle.write(data)
    return file_hash, archive_path


def _find_source_file(paper_id: str) -> Path | None:
    for ext in [".tar.gz", ".tgz", ".tar", ".zip"]:
        path = UPLOADS_DIR / f"{paper_id}{ext}"
        if path.exists():
            return path
    return None
