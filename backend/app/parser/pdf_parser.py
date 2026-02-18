import os
import hashlib
import json
import re
from typing import List
from pathlib import Path
from dotenv import load_dotenv
from llama_parse import LlamaParse
from llama_index.core import Document

load_dotenv()

class PDFParser:
    def __init__(self, cache_dir: str = "storage/cache/parser"):
        self.api_key = os.getenv("LLAMA_CLOUD_API_KEY")
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        if not self.api_key:
            # We don't raise error here to allow the class to be instantiated,
            # but we'll need it when parsing.
            print("Warning: LLAMA_CLOUD_API_KEY not found in environment.")
        
        self.parser = None
        if self.api_key:
            self.parser = self._get_parser()

    def _get_parser(self):
        return LlamaParse(
            api_key=self.api_key,
            result_type="markdown",
            verbose=True,
            user_prompt="Output clean markdown. Do not use HTML tags. Represent all mathematical formulas (both inline and block) using LaTeX wrapped in double dollar signs ($$). Do not use single dollar signs."
        )

    def _get_file_hash(self, file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def parse(self, file_path: str) -> List[Document]:
        file_hash = self._get_file_hash(file_path)
        cache_file = self.cache_dir / f"{file_hash}.json"

        if cache_file.exists():
            print(f"Loading cached version for {file_path}...")
            with open(cache_file, "r") as f:
                cached_data = json.load(f)
                return [Document(text=doc["text"], metadata=doc.get("metadata", {})) for doc in cached_data]

        if not self.parser:
            if not self.api_key:
                self.api_key = os.getenv("LLAMA_CLOUD_API_KEY")
                if not self.api_key:
                    raise ValueError("LLAMA_CLOUD_API_KEY not found in environment")
            self.parser = self._get_parser()
            
        print(f"Parsing {file_path} via LlamaParse...")
        documents = self.parser.load_data(file_path)
        
        # Post-process: convert single $ to double $$ for consistency if requested
        # or just to follow the "double dollar" instruction more strictly.
        for doc in documents:
            # Replace $...$ with $$...$$ but avoid $$$...$$$
            new_text = re.sub(r'(?<!\$)\$([^\$]+)\$(?!\$)', r'$$\1$$', doc.text)
            doc.set_content(new_text)
        
        # Cache the result
        cached_data = [{"text": doc.text, "metadata": doc.metadata} for doc in documents]
        with open(cache_file, "w") as f:
            json.dump(cached_data, f)
        
        return documents

if __name__ == "__main__":
    # Simple test
    import sys
    if len(sys.argv) > 1:
        parser = PDFParser()
        docs = parser.parse(sys.argv[1])
        for i, doc in enumerate(docs):
            print(f"--- Document {i} ---")
            print(doc.text[:500] + "...")
