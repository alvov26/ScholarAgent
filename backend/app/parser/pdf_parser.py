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
            result_type="json",
            verbose=True,
            user_prompt="Output clean markdown. Do not use HTML tags. Represent inline mathematical formulas using LaTeX wrapped in single dollar signs ($) and block formulas using double dollar signs ($$). Use the ampersand character (&) for alignment in LaTeX environments, do not escape it as an HTML entity."
        )

    def _get_file_hash(self, file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _unescape_html(self, text: str) -> str:
        return text.replace("&amp;", "&").replace("&#x26;", "&")\
                   .replace("&#123;", "{").replace("&#125;", "}")

    def parse(self, file_path: str) -> List[dict]:
        file_hash = self._get_file_hash(file_path)
        cache_file = self.cache_dir / f"{file_hash}.json"

        if cache_file.exists():
            print(f"Loading cached version for {file_path}...")
            with open(cache_file, "r") as f:
                return json.load(f)

        if not self.parser:
            if not self.api_key:
                self.api_key = os.getenv("LLAMA_CLOUD_API_KEY")
                if not self.api_key:
                    raise ValueError("LLAMA_CLOUD_API_KEY not found in environment")
            self.parser = self._get_parser()
            
        print(f"Parsing {file_path} via LlamaParse (JSON mode)...")
        json_objs = self.parser.get_json_result(file_path)
        
        # Post-process: unescape common HTML entities
        for file_obj in json_objs:
            for page in file_obj.get("pages", []):
                if "md" in page:
                    page["md"] = self._unescape_html(page["md"])
                if "text" in page:
                    page["text"] = self._unescape_html(page["text"])
                for item in page.get("items", []):
                    if "md" in item:
                        item["md"] = self._unescape_html(item["md"])
                    if "value" in item:
                        item["value"] = self._unescape_html(item["value"])

        # Cache the result
        with open(cache_file, "w") as f:
            json.dump(json_objs, f)
        
        return json_objs

if __name__ == "__main__":
    # Simple test
    import sys
    if len(sys.argv) > 1:
        parser = PDFParser()
        json_data = parser.parse(sys.argv[1])
        # Print summary
        pages = json_data[0].get("pages", [])
        print(f"Total pages: {len(pages)}")
        for i, page in enumerate(pages[:3]):
            print(f"--- Page {page['page']} ---")
            print(f"Items count: {len(page.get('items', []))}")
            print(page.get("md", "")[:200] + "...")
