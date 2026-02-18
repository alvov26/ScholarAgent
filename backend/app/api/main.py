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
        # Maybe paper_id is a filename in input/? 
        # For now we only support cached hashes
        raise HTTPException(status_code=404, detail="Paper not found in cache")
    
    with open(cache_file, "r") as f:
        cached_data = json.load(f)
    
    # Join all pages text with double newlines
    # LlamaParse usually gives us a list of pages
    full_markdown = "\n\n".join([doc["text"] for doc in cached_data])
    
    return {
        "paper_id": paper_id, 
        "markdown": full_markdown,
        "pages_count": len(cached_data)
    }
