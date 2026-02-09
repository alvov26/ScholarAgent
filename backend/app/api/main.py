from fastapi import FastAPI, UploadFile, File
from backend.app.parser.pdf_parser import PDFParser

app = FastAPI(title="Scholar Agent API")

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
