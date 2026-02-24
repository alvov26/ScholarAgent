import re
from pathlib import Path
from typing import Optional


class LatexStructureParser:
    """Parse LaTeX documents into structured sections while preserving math."""

    def __init__(self):
        # Define patterns in order of precedence (check multiline before single-line)
        self.math_patterns = [
            # Display math environments (must come before $$ to capture \begin{equation})
            ('equation_env', r'\\begin\{(equation|align|gather|multline|eqnarray)(\*?)\}(.*?)\\end\{\1\2\}', True),
            # Display math delimiters
            ('display_bracket', r'\\\[(.*?)\\\]', True),
            ('display_dollar', r'\$\$(.*?)\$\$', True),
            # Inline math delimiters
            ('inline_paren', r'\\\((.*?)\\\)', False),
            ('inline_dollar', r'\$(.*?)\$', False),
        ]

    def parse_to_structure(self, file_path: str, resource_path: Optional[str] = None) -> dict:
        """
        Parse a LaTeX file into structured sections.

        Returns:
            dict: {
                "format": "latex",
                "sections": [
                    {
                        "type": "section"|"subsection"|"subsubsection"|"paragraph",
                        "title": str,
                        "content": [
                            {"type": "text", "content": str},
                            {"type": "math", "content": str, "display": bool},
                            ...
                        ]
                    }
                ]
            }
        """
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            raw = f.read()

        # Extract document body
        body = self._extract_document_body(raw)

        # Split into sections
        sections = self._split_into_sections(body)

        return {
            "format": "latex",
            "sections": sections
        }

    def _extract_document_body(self, text: str) -> str:
        """Extract content between \\begin{document} and \\end{document}."""
        match = re.search(r"\\begin\{document\}(.*?)\\end\{document\}", text, re.DOTALL)
        if match:
            return match.group(1).strip()
        return text

    def _split_into_sections(self, text: str) -> list:
        """Split LaTeX text into hierarchical sections."""
        sections = []

        # Pattern to match section commands
        section_pattern = r'\\(section|subsection|subsubsection)\*?\{([^}]+)\}'

        # Find all section markers
        matches = list(re.finditer(section_pattern, text))

        if not matches:
            # No sections found, treat entire text as one section
            content = self._parse_content_blocks(text)
            if content:
                sections.append({
                    "type": "paragraph",
                    "title": "",
                    "content": content
                })
            return sections

        # Process each section
        for i, match in enumerate(matches):
            section_type = match.group(1)
            section_title = match.group(2)

            # Get content from end of this match to start of next match (or end of text)
            start_pos = match.end()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(text)

            section_content = text[start_pos:end_pos].strip()
            content_blocks = self._parse_content_blocks(section_content)

            sections.append({
                "type": section_type,
                "title": section_title,
                "content": content_blocks
            })

        # Handle any text before the first section
        if matches[0].start() > 0:
            pre_content = text[:matches[0].start()].strip()
            if pre_content:
                content_blocks = self._parse_content_blocks(pre_content)
                if content_blocks:
                    sections.insert(0, {
                        "type": "paragraph",
                        "title": "",
                        "content": content_blocks
                    })

        return sections

    def _parse_content_blocks(self, text: str) -> list:
        """
        Parse text into alternating text and math blocks.

        Returns list of {"type": "text"|"math", "content": str, "display": bool}
        """
        blocks = []
        position = 0

        while position < len(text):
            # Try to find the next math block
            earliest_match = None
            earliest_pos = len(text)
            matched_pattern = None

            for name, pattern, is_display in self.math_patterns:
                match = re.search(pattern, text[position:], re.DOTALL)
                if match and match.start() < (earliest_pos - position):
                    earliest_match = match
                    earliest_pos = position + match.start()
                    matched_pattern = (name, pattern, is_display)

            if earliest_match is None:
                # No more math blocks, add remaining text
                remaining = text[position:].strip()
                if remaining:
                    blocks.append({
                        "type": "text",
                        "content": remaining
                    })
                break

            # Add text before this math block
            if earliest_match.start() > 0:
                text_content = text[position:position + earliest_match.start()].strip()
                if text_content:
                    blocks.append({
                        "type": "text",
                        "content": text_content
                    })

            # Extract math content based on pattern type
            name, pattern, is_display = matched_pattern
            raw_match = earliest_match.group(0)

            if name == 'equation_env':
                # For equation environments, extract content from group 3 (after env name and *)
                # Groups: 1=env_name, 2=star, 3=content
                math_content = earliest_match.group(3).strip()
            else:
                # For delimiters, extract content from group 1
                math_content = earliest_match.group(1).strip()

            blocks.append({
                "type": "math",
                "content": math_content,
                "display": is_display,
                "raw": raw_match
            })

            position = position + earliest_match.end()

        return blocks
