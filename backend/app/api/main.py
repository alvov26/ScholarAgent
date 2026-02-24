import json
import hashlib
import re
import tarfile
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List
import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from backend.app.parser.pdf_parser import PDFParser
from backend.app.parser.tex_parser import TexParser
from backend.app.parser.latex_structure_parser import LatexStructureParser
from backend.app.parser.math_extractor import MathExtractor

app = FastAPI(title="Scholar Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_DIR = Path("storage/cache/parser")
CACHE_MD_DIR = Path("storage/cache/markdown")
CACHE_LATEX_DIR = Path("storage/cache/latex")
ANNOTATIONS_DIR = Path("storage/annotations")
UPLOADS_DIR = Path("storage/uploads")
MANIFEST_FILE = Path("storage/cache/manifest.json")

CACHE_MD_DIR.mkdir(parents=True, exist_ok=True)
CACHE_LATEX_DIR.mkdir(parents=True, exist_ok=True)
ANNOTATIONS_DIR.mkdir(parents=True, exist_ok=True)
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


@app.get("/paper/{paper_id}/latex")
async def get_paper_latex(paper_id: str, regenerate: bool = False):
    """Get structured LaTeX content for a paper."""
    metadata = _get_manifest_entry(paper_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Paper not found")

    if metadata.get("type") not in {"md", "tex"}:
        raise HTTPException(status_code=400, detail="LaTeX structure only available for .tex files")

    latex_cache_path = CACHE_LATEX_DIR / f"{paper_id}.json"

    # Check if we need to regenerate
    if regenerate or not latex_cache_path.exists():
        # Find the original upload
        upload_path = None
        for ext in [".tar.gz", ".tar", ".zip", ".tex"]:
            candidate = UPLOADS_DIR / f"{paper_id}{ext}"
            if candidate.exists():
                upload_path = candidate
                break

        if not upload_path:
            raise HTTPException(status_code=404, detail="Original source file not found")

        # Generate structured LaTeX
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                root = Path(tmpdir)

                # Extract if archive
                if upload_path.suffix in [".gz", ".tar", ".zip"]:
                    if upload_path.suffix == ".zip" or upload_path.name.endswith(".zip"):
                        with zipfile.ZipFile(upload_path, "r") as archive:
                            _safe_extract_zip(archive, root)
                    else:
                        with tarfile.open(upload_path, "r:*") as archive:
                            _safe_extract_tar(archive, root)
                elif upload_path.suffix == ".tex":
                    # Single .tex file
                    import shutil
                    shutil.copy(upload_path, root / upload_path.name)

                # Find main tex file
                tex_files = list(root.rglob("*.tex"))
                if not tex_files:
                    raise HTTPException(status_code=400, detail="No .tex files found")

                def score_tex(path: Path) -> int:
                    score = 0
                    name = path.name.lower()
                    if name in {"main.tex", "paper.tex", "ms.tex"}:
                        score += 3
                    try:
                        text = path.read_text(encoding="utf-8", errors="ignore")
                    except OSError:
                        return score
                    if "\\documentclass" in text:
                        score += 2
                    if "\\begin{document}" in text:
                        score += 2
                    score += min(len(text) // 5000, 3)
                    return score

                main_tex = max(tex_files, key=score_tex)

                # Generate structured LaTeX
                parser = LatexStructureParser()
                structure = parser.parse_to_structure(str(main_tex))
                extractor = MathExtractor()
                structure["math_catalog"] = extractor.extract_all_math(structure["sections"])

                # Cache it
                with open(latex_cache_path, "w", encoding="utf-8") as handle:
                    json.dump(structure, handle, indent=2, ensure_ascii=False)

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate LaTeX structure: {str(e)}")

    if latex_cache_path.exists():
        with open(latex_cache_path, "r", encoding="utf-8") as handle:
            return json.load(handle)

    raise HTTPException(status_code=404, detail="Structured LaTeX not found in cache")

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


@app.get("/paper/{paper_id}/annotations")
async def get_annotations(paper_id: str):
    ann_path = ANNOTATIONS_DIR / f"{paper_id}.json"
    if not ann_path.exists():
        return {"annotations": []}
    with open(ann_path, "r", encoding="utf-8") as handle:
        return {"annotations": json.load(handle)}


@app.post("/paper/{paper_id}/annotations")
async def save_annotations(paper_id: str, annotations: List[dict]):
    ann_path = ANNOTATIONS_DIR / f"{paper_id}.json"
    with open(ann_path, "w", encoding="utf-8") as handle:
        json.dump(annotations, handle, indent=2)
    return {"status": "success"}


@app.delete("/paper/{paper_id}")
async def delete_paper(paper_id: str):
    """Delete a cached paper and all associated files."""
    metadata = _get_manifest_entry(paper_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Delete all associated files
    deleted_files = []

    # Cache files
    cache_pdf = CACHE_DIR / f"{paper_id}.json"
    if cache_pdf.exists():
        cache_pdf.unlink()
        deleted_files.append(str(cache_pdf))

    # Markdown cache
    cache_md = CACHE_MD_DIR / f"{paper_id}.md"
    if cache_md.exists():
        cache_md.unlink()
        deleted_files.append(str(cache_md))

    # LaTeX structure cache
    cache_latex = CACHE_LATEX_DIR / f"{paper_id}.json"
    if cache_latex.exists():
        cache_latex.unlink()
        deleted_files.append(str(cache_latex))

    # Annotations
    annotations = ANNOTATIONS_DIR / f"{paper_id}.json"
    if annotations.exists():
        annotations.unlink()
        deleted_files.append(str(annotations))

    # Original upload
    for ext in [".pdf", ".md", ".tex", ".tar.gz", ".tar", ".tgz", ".zip"]:
        upload_file = UPLOADS_DIR / f"{paper_id}{ext}"
        if upload_file.exists():
            upload_file.unlink()
            deleted_files.append(str(upload_file))

    # Remove from manifest
    manifest = _load_manifest()
    papers = manifest.get("papers", [])
    papers = [p for p in papers if p.get("id") != paper_id]
    _save_manifest({"papers": papers})

    return {
        "status": "success",
        "paper_id": paper_id,
        "deleted_files": deleted_files
    }


@app.post("/paper/upload")
async def upload_paper(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a name")

    archive_type = _get_archive_type(file.filename)
    ext = Path(file.filename).suffix.lower()
    if not archive_type and ext not in {".pdf", ".md", ".tex"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="File is empty")

    file_hash = hashlib.sha256(data).hexdigest()
    upload_ext = ext if not archive_type else ".tar.gz" if archive_type == "tar" else ".zip"
    upload_path = UPLOADS_DIR / f"{file_hash}{upload_ext}"
    if not upload_path.exists():
        with open(upload_path, "wb") as handle:
            handle.write(data)

    cached = False
    if archive_type:
        md_path = CACHE_MD_DIR / f"{file_hash}.md"
        latex_cache_path = CACHE_LATEX_DIR / f"{file_hash}.json"
        if md_path.exists() and latex_cache_path.exists():
            cached = True
        else:
            # Generate both markdown and structured LaTeX
            with tempfile.TemporaryDirectory() as tmpdir:
                root = Path(tmpdir)
                if archive_type == "zip":
                    with zipfile.ZipFile(upload_path, "r") as archive:
                        _safe_extract_zip(archive, root)
                else:
                    with tarfile.open(upload_path, "r:*") as archive:
                        _safe_extract_tar(archive, root)

                # Find main tex file
                tex_files = list(root.rglob("*.tex"))
                if tex_files:
                    def score_tex(path: Path) -> int:
                        score = 0
                        name = path.name.lower()
                        if name in {"main.tex", "paper.tex", "ms.tex"}:
                            score += 3
                        try:
                            text = path.read_text(encoding="utf-8", errors="ignore")
                        except OSError:
                            return score
                        if "\\documentclass" in text:
                            score += 2
                        if "\\begin{document}" in text:
                            score += 2
                        score += min(len(text) // 5000, 3)
                        return score

                    main_tex = max(tex_files, key=score_tex)

                    # Generate structured LaTeX
                    parser = LatexStructureParser()
                    structure = parser.parse_to_structure(str(main_tex))
                    extractor = MathExtractor()
                    structure["math_catalog"] = extractor.extract_all_math(structure["sections"])
                    with open(latex_cache_path, "w", encoding="utf-8") as handle:
                        json.dump(structure, handle, indent=2, ensure_ascii=False)

            # Generate markdown (backward compatibility)
            markdown = _convert_archive_to_markdown(upload_path, archive_type)
            with open(md_path, "w", encoding="utf-8") as handle:
                handle.write(markdown)
        paper_type = "tex"
    elif ext == ".pdf":
        cache_file = CACHE_DIR / f"{file_hash}.json"
        if not cache_file.exists():
            parser = PDFParser(cache_dir=str(CACHE_DIR))
            parser.parse(str(upload_path))
        else:
            cached = True
        paper_type = "pdf"
    else:
        md_path = CACHE_MD_DIR / f"{file_hash}.md"
        latex_cache_path = CACHE_LATEX_DIR / f"{file_hash}.json"

        if ext == ".tex":
            # For .tex files, generate both markdown and structured LaTeX
            if md_path.exists() and latex_cache_path.exists():
                cached = True
            else:
                # Generate structured LaTeX
                parser = LatexStructureParser()
                structure = parser.parse_to_structure(str(upload_path))
                extractor = MathExtractor()
                structure["math_catalog"] = extractor.extract_all_math(structure["sections"])
                with open(latex_cache_path, "w", encoding="utf-8") as handle:
                    json.dump(structure, handle, indent=2, ensure_ascii=False)

                # Generate markdown (backward compatibility)
                markdown = _read_markdown_from_source(ext, upload_path)
                with open(md_path, "w", encoding="utf-8") as handle:
                    handle.write(markdown)
        else:
            # For .md files, just process markdown
            if md_path.exists():
                cached = True
            else:
                markdown = _read_markdown_from_source(ext, upload_path)
                with open(md_path, "w", encoding="utf-8") as handle:
                    handle.write(markdown)

        paper_type = ext.lstrip(".")

    _upsert_manifest_entry({
        "id": file_hash,
        "filename": file.filename,
        "type": paper_type,
        "cached": True,
        "cached_at": datetime.utcnow().isoformat() + "Z"
    })

    return {
        "paper_id": file_hash,
        "filename": file.filename,
        "type": paper_type,
        "cached": cached
    }


@app.post("/paper/upload/folder")
async def upload_latex_folder(files: List[UploadFile] = File(...), paths: List[str] = Form(...)):
    if len(files) != len(paths):
        raise HTTPException(status_code=400, detail="File list and path list must match")

    file_hash = _hash_folder_bundle(files, paths)
    md_path = CACHE_MD_DIR / f"{file_hash}.md"
    if not md_path.exists():
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            for upload, rel_path in zip(files, paths):
                data = await upload.read()
                dest = root / rel_path
                dest.parent.mkdir(parents=True, exist_ok=True)
                with open(dest, "wb") as handle:
                    handle.write(data)
            markdown = _convert_latex_sources(root)
            with open(md_path, "w", encoding="utf-8") as handle:
                handle.write(markdown)

    _upsert_manifest_entry({
        "id": file_hash,
        "filename": Path(paths[0]).parts[0] if paths else "latex-folder",
        "type": "tex",
        "cached": True,
        "cached_at": datetime.utcnow().isoformat() + "Z"
    })

    return {
        "paper_id": file_hash,
        "filename": Path(paths[0]).parts[0] if paths else "latex-folder",
        "type": "tex",
        "cached": md_path.exists()
    }


@app.post("/paper/upload/arxiv")
async def upload_arxiv_source(url_or_id: str = Form(...)):
    arxiv_id = _extract_arxiv_id(url_or_id)
    if not arxiv_id:
        raise HTTPException(status_code=400, detail="Invalid arXiv URL or ID")

    file_hash, archive_path = _download_arxiv_source(arxiv_id)
    md_path = CACHE_MD_DIR / f"{file_hash}.md"
    if not md_path.exists():
        markdown = _convert_archive_to_markdown(archive_path, "tar")
        with open(md_path, "w", encoding="utf-8") as handle:
            handle.write(markdown)

    _upsert_manifest_entry({
        "id": file_hash,
        "filename": f"arXiv:{arxiv_id}",
        "type": "tex",
        "cached": True,
        "cached_at": datetime.utcnow().isoformat() + "Z"
    })

    return {
        "paper_id": file_hash,
        "filename": f"arXiv:{arxiv_id}",
        "type": "tex",
        "cached": md_path.exists()
    }


def _read_markdown_from_source(ext: str, path: Path) -> str:
    if ext == ".md":
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return handle.read()

    parser = TexParser(cache_dir=str(CACHE_MD_DIR))
    return parser.parse_to_markdown(str(path))


def _convert_archive_to_markdown(archive_path: Path, archive_type: str) -> str:
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        if archive_type == "zip":
            with zipfile.ZipFile(archive_path, "r") as archive:
                _safe_extract_zip(archive, root)
        else:
            with tarfile.open(archive_path, "r:*") as archive:
                _safe_extract_tar(archive, root)
        return _convert_latex_sources(root)


def _convert_latex_sources(root: Path) -> str:
    tex_files = list(root.rglob("*.tex"))
    if not tex_files:
        raise HTTPException(status_code=400, detail="No .tex files found in sources")

    def score_tex(path: Path) -> int:
        score = 0
        name = path.name.lower()
        if name in {"main.tex", "paper.tex", "ms.tex"}:
            score += 3
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            return score
        if "\\documentclass" in text:
            score += 2
        if "\\begin{document}" in text:
            score += 2
        score += min(len(text) // 5000, 3)
        return score

    main_tex = max(tex_files, key=score_tex)
    bib_files = [str(p) for p in root.rglob("*.bib")]
    parser = TexParser(cache_dir=str(CACHE_MD_DIR))
    return parser.parse_to_markdown(str(main_tex), resource_path=str(root), bib_files=bib_files)


def _generate_latex_structure(tex_path: Path, file_hash: str) -> dict:
    """Generate and cache structured LaTeX."""
    latex_cache_path = CACHE_LATEX_DIR / f"{file_hash}.json"

    if not latex_cache_path.exists():
        parser = LatexStructureParser()
        structure = parser.parse_to_structure(str(tex_path))

        # Extract math catalog
        extractor = MathExtractor()
        math_catalog = extractor.extract_all_math(structure["sections"])
        structure["math_catalog"] = math_catalog

        # Cache the structure
        with open(latex_cache_path, "w", encoding="utf-8") as handle:
            json.dump(structure, handle, indent=2, ensure_ascii=False)

    with open(latex_cache_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


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


def _get_archive_type(filename: str) -> str | None:
    name = filename.lower()
    if name.endswith(".tar.gz") or name.endswith(".tgz") or name.endswith(".tar"):
        return "tar"
    if name.endswith(".zip"):
        return "zip"
    return None


def _hash_folder_bundle(files: List[UploadFile], paths: List[str]) -> str:
    entries = []
    for upload, rel_path in zip(files, paths):
        entries.append((rel_path, upload))
    entries.sort(key=lambda item: item[0])

    hasher = hashlib.sha256()
    for rel_path, upload in entries:
        hasher.update(rel_path.encode("utf-8"))
        data = upload.file.read()
        hasher.update(data)
        upload.file.seek(0)
    return hasher.hexdigest()


def _extract_arxiv_id(value: str) -> str | None:
    value = value.strip()
    match = re.search(r"arxiv\.org/(abs|pdf|e-print)/([0-9.]+)", value)
    if match:
        return match.group(2)
    match = re.fullmatch(r"[0-9.]+", value)
    if match:
        return value
    return None


def _download_arxiv_source(arxiv_id: str) -> tuple[str, Path]:
    url = f"https://arxiv.org/e-print/{arxiv_id}"
    with httpx.Client(follow_redirects=True, timeout=60.0) as client:
        response = client.get(url)
        response.raise_for_status()
        data = response.content

    file_hash = hashlib.sha256(data).hexdigest()
    archive_path = UPLOADS_DIR / f"{file_hash}.tar.gz"
    if not archive_path.exists():
        with open(archive_path, "wb") as handle:
            handle.write(data)
    return file_hash, archive_path


def _safe_extract_zip(archive: zipfile.ZipFile, dest: Path) -> None:
    for member in archive.infolist():
        target = (dest / member.filename).resolve()
        if not str(target).startswith(str(dest.resolve())):
            continue
        archive.extract(member, dest)


def _safe_extract_tar(archive: tarfile.TarFile, dest: Path) -> None:
    for member in archive.getmembers():
        target = (dest / member.name).resolve()
        if not str(target).startswith(str(dest.resolve())):
            continue
        archive.extract(member, dest)
