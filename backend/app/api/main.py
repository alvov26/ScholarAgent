import os
import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from backend.app.parser.pdf_parser import PDFParser

app = FastAPI(title="Scholar Agent API")

CACHE_DIR = Path("storage/cache/parser")

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
    papers = []
    if CACHE_DIR.exists():
        for file in CACHE_DIR.glob("*.json"):
            papers.append({
                "id": file.stem,
                "cached": True
            })
    return {"papers": papers}

@app.get("/paper/{paper_id}/markdown")
async def get_paper_markdown(paper_id: str):
    # Try to find the cached file
    cache_file = CACHE_DIR / f"{paper_id}.json"
    
    if not cache_file.exists():
        raise HTTPException(status_code=404, detail="Paper not found in cache")
    
    with open(cache_file, "r") as f:
        json_data = json.load(f)
    
    # Extract markdown from each page
    # LlamaParse JSON structure: list of files, each has 'pages'
    pages = json_data[0].get("pages", [])
    full_markdown = "\n\n".join([page.get("md", "") for page in pages])
    
    return {
        "paper_id": paper_id, 
        "markdown": full_markdown,
        "pages_count": len(pages)
    }

@app.get("/paper/{paper_id}/content")
async def get_paper_content(paper_id: str):
    # Try to find the cached file
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
