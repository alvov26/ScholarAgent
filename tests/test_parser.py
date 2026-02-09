import os
import sys
from pathlib import Path

# Add the project root to sys.path to allow importing from backend
sys.path.append(str(Path(__file__).parent.parent))

from backend.app.parser.pdf_parser import PDFParser

def test_parser():
    input_pdf = "input/2602.02383v2.pdf"
    if not os.path.exists(input_pdf):
        print(f"Error: Input PDF not found at {input_pdf}")
        return

    parser = PDFParser()

    print(f"\n--- Run 1: Parsing {input_pdf} ---")
    try:
        documents1 = parser.parse(input_pdf)
        print(f"Run 1: Successfully parsed {len(documents1)} documents.")
    except Exception as e:
        print(f"Run 1 error: {e}")
        return

    print(f"\n--- Run 2: Parsing {input_pdf} again (should be cached) ---")
    try:
        documents2 = parser.parse(input_pdf)
        print(f"Run 2: Successfully loaded {len(documents2)} documents from cache.")
        
        # Verify they are the same
        if len(documents1) == len(documents2) and documents1[0].text == documents2[0].text:
            print("Verification successful: Cached content matches original.")
        else:
            print("Verification failed: Cached content differs from original.")

    except Exception as e:
        print(f"Run 2 error: {e}")

if __name__ == "__main__":
    test_parser()
