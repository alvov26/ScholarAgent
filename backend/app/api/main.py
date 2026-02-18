import json
import hashlib
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.app.parser.pdf_parser import PDFParser
from backend.app.parser.tex_parser import TexParser

app = FastAPI(title="Scholar Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_DIR = Path("storage/cache/parser")
CACHE_MD_DIR = Path("storage/cache/markdown")
UPLOADS_DIR = Path("storage/uploads")
MANIFEST_FILE = Path("storage/cache/manifest.json")

CACHE_MD_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/")
async def root():
    return {"message": "Welcome to Scholar Agent API"}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    # Placeholder for PDF upload and processing logic
    return {"filename": file.filename, "status": "received"}

@app.get("/paper/{paper_id}/structure")
async def get_structure(paper_id: str):
    # Placeholder for fetching paper structure
    return {"paper_id": paper_id, "structure": []}

@app.get("/papers")
async def list_papers():
    papers = _load_manifest().get("papers", [])

    if CACHE_DIR.exists():
        existing_ids = {paper["id"] for paper in papers}
        for file in CACHE_DIR.glob("*.json"):
            if file.stem in existing_ids:
                continue
            papers.append({
                "id": file.stem,
                "filename": f"{file.stem}.pdf",
                "type": "pdf",
                "cached": True
            })
    return {"papers": papers}

@app.get("/paper/{paper_id}/markdown")
async def get_paper_markdown(paper_id: str):
    metadata = _get_manifest_entry(paper_id)
    if metadata and metadata.get("type") in {"md", "tex"}:
        md_path = CACHE_MD_DIR / f"{paper_id}.md"
        if not md_path.exists():
            raise HTTPException(status_code=404, detail="Markdown not found in cache")
        with open(md_path, "r", encoding="utf-8") as handle:
            return {
                "paper_id": paper_id,
                "markdown": handle.read(),
                "pages_count": 1,
                "type": metadata.get("type")
            }

    cache_file = CACHE_DIR / f"{paper_id}.json"
    if not cache_file.exists():
        raise HTTPException(status_code=404, detail="Paper not found in cache")

    with open(cache_file, "r") as f:
        json_data = json.load(f)

    pages = json_data[0].get("pages", [])
    full_markdown = "\n\n".join([page.get("md", "") for page in pages])

    return {
        "paper_id": paper_id,
        "markdown": full_markdown,
        "pages_count": len(pages),
        "type": "pdf"
    }

@app.get("/paper/{paper_id}/content")
async def get_paper_content(paper_id: str):
    metadata = _get_manifest_entry(paper_id)
    if metadata and metadata.get("type") in {"md", "tex"}:
        raise HTTPException(status_code=400, detail="Content items are only available for PDFs")

    cache_file = CACHE_DIR / f"{paper_id}.json"
    
    if not cache_file.exists():
        raise HTTPException(status_code=404, detail="Paper not found in cache")
    
    with open(cache_file, "r") as f:
        json_data = json.load(f)
    
    # Return the structured items from all pages
    all_items = []
    pages = json_data[0].get("pages", [])
    for page in pages:
        page_num = page.get("page")
        for item in page.get("items", []):
            item["page"] = page_num # Add page reference to each item
            all_items.append(item)
            
    return {
        "paper_id": paper_id,
        "items": all_items,
        "pages_count": len(pages)
    }


@app.post("/paper/upload")
async def upload_paper(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a name")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".md", ".tex"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="File is empty")

    file_hash = hashlib.sha256(data).hexdigest()
    upload_path = UPLOADS_DIR / f"{file_hash}{ext}"
    if not upload_path.exists():
        with open(upload_path, "wb") as handle:
            handle.write(data)

    cached = False
    if ext == ".pdf":
        cache_file = CACHE_DIR / f"{file_hash}.json"
        if not cache_file.exists():
            parser = PDFParser(cache_dir=str(CACHE_DIR))
            parser.parse(str(upload_path))
        else:
            cached = True
    else:
        md_path = CACHE_MD_DIR / f"{file_hash}.md"
        if md_path.exists():
            cached = True
        else:
            markdown = _read_markdown_from_source(ext, upload_path)
            with open(md_path, "w", encoding="utf-8") as handle:
                handle.write(markdown)

    _upsert_manifest_entry({
        "id": file_hash,
        "filename": file.filename,
        "type": ext.lstrip("."),
        "cached": True,
        "cached_at": datetime.utcnow().isoformat() + "Z"
    })

    return {
        "paper_id": file_hash,
        "filename": file.filename,
        "type": ext.lstrip("."),
        "cached": cached
    }


def _read_markdown_from_source(ext: str, path: Path) -> str:
    if ext == ".md":
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return handle.read()

    parser = TexParser(cache_dir=str(CACHE_MD_DIR))
    return parser.parse_to_markdown(str(path))


def _load_manifest() -> dict:
    if not MANIFEST_FILE.exists():
        return {"papers": []}
    with open(MANIFEST_FILE, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _save_manifest(manifest: dict) -> None:
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_FILE, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)


def _get_manifest_entry(paper_id: str) -> dict | None:
    manifest = _load_manifest()
    for entry in manifest.get("papers", []):
        if entry.get("id") == paper_id:
            return entry
    return None


def _upsert_manifest_entry(entry: dict) -> None:
    manifest = _load_manifest()
    papers = manifest.get("papers", [])
    for idx, existing in enumerate(papers):
        if existing.get("id") == entry.get("id"):
            papers[idx] = {**existing, **entry}
            _save_manifest({"papers": papers})
            return
    papers.append(entry)
    _save_manifest({"papers": papers})
