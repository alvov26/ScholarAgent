import re
from typing import List, Dict


class MathExtractor:
    """Extract and catalog all math expressions from LaTeX content."""

    def extract_all_math(self, sections: List[Dict]) -> List[Dict]:
        """
        Extract all math expressions from structured sections.

        Returns:
            List of {
                "id": str,  # unique identifier
                "content": str,  # LaTeX math content
                "display": bool,  # inline or display
                "section": str,  # section title
                "context": str  # surrounding text
            }
        """
        math_catalog = []
        math_id = 0

        for section in sections:
            section_title = section.get("title", "")
            content_blocks = section.get("content", [])

            for i, block in enumerate(content_blocks):
                if block.get("type") == "math":
                    # Get surrounding context
                    context_before = ""
                    context_after = ""

                    if i > 0 and content_blocks[i - 1].get("type") == "text":
                        context_before = content_blocks[i - 1].get("content", "")[-100:]

                    if i < len(content_blocks) - 1 and content_blocks[i + 1].get("type") == "text":
                        context_after = content_blocks[i + 1].get("content", "")[:100]

                    math_catalog.append({
                        "id": f"math_{math_id}",
                        "content": block.get("content", ""),
                        "display": block.get("display", False),
                        "raw": block.get("raw", ""),
                        "section": section_title,
                        "context": {
                            "before": context_before.strip(),
                            "after": context_after.strip()
                        }
                    })
                    math_id += 1

        return math_catalog

    def extract_symbols(self, math_content: str) -> List[str]:
        """
        Extract individual symbols from a math expression.

        Returns list of unique symbols/variables found.
        """
        symbols = set()

        # Remove common commands that aren't symbols
        cleaned = re.sub(r'\\(frac|sqrt|sum|int|prod|lim|text|mathrm|mathbf|mathit|mathcal)\{[^}]*\}', '', math_content)

        # Find LaTeX commands (e.g., \alpha, \beta)
        latex_symbols = re.findall(r'\\([a-zA-Z]+)', cleaned)
        symbols.update(latex_symbols)

        # Find single-letter variables (excluding spaces and operators)
        variables = re.findall(r'\b([a-zA-Z])\b', cleaned)
        symbols.update(variables)

        # Find Greek letters and special symbols
        greek_pattern = r'\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)'
        greek = re.findall(greek_pattern, math_content)
        symbols.update(greek)

        return sorted(list(symbols))
