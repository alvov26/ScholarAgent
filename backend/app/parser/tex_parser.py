import re
from pathlib import Path
from typing import Optional

try:
    import pypandoc
except ImportError:  # pragma: no cover - optional dependency
    pypandoc = None


class TexParser:
    def __init__(self, cache_dir: str = "storage/cache/markdown"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def parse_to_markdown(self, file_path: str, resource_path: Optional[str] = None, bib_files: Optional[list[str]] = None) -> str:
        if pypandoc:
            try:
                extra_args = []
                if resource_path:
                    extra_args.append(f"--resource-path={resource_path}")
                if bib_files:
                    extra_args.append("--citeproc")
                    for bib in bib_files:
                        extra_args.append(f"--bibliography={bib}")
                return pypandoc.convert_file(file_path, "gfm", format="latex", extra_args=extra_args)
            except RuntimeError:
                pass

        with open(file_path, "r", encoding="utf-8", errors="replace") as handle:
            raw = handle.read()
        return self._fallback_to_markdown(raw)

    def _fallback_to_markdown(self, text: str) -> str:
        cleaned = self._strip_preamble(text)
        cleaned = self._convert_sections(cleaned)
        cleaned = self._convert_basic_formatting(cleaned)
        cleaned = self._convert_lists(cleaned)
        cleaned = self._cleanup_commands(cleaned)
        cleaned = cleaned.replace("\\\\", "\n")
        return cleaned.strip()

    def _strip_preamble(self, text: str) -> str:
        body_match = re.search(r"\\begin\{document\}(.*)\\end\{document\}", text, re.S)
        if body_match:
            return body_match.group(1)
        return text

    def _convert_sections(self, text: str) -> str:
        replacements = [
            (r"\\section\*?\{([^}]+)\}", r"# \1"),
            (r"\\subsection\*?\{([^}]+)\}", r"## \1"),
            (r"\\subsubsection\*?\{([^}]+)\}", r"### \1"),
        ]
        for pattern, repl in replacements:
            text = re.sub(pattern, repl, text)
        return text

    def _convert_basic_formatting(self, text: str) -> str:
        text = re.sub(r"\\textbf\{([^}]+)\}", r"**\1**", text)
        text = re.sub(r"\\emph\{([^}]+)\}", r"*\1*", text)
        return text

    def _convert_lists(self, text: str) -> str:
        text = re.sub(r"\\begin\{itemize\}", "", text)
        text = re.sub(r"\\end\{itemize\}", "", text)
        text = re.sub(r"\\item\s+", "- ", text)
        return text

    def _cleanup_commands(self, text: str) -> str:
        text = re.sub(r"\\(label|ref|cite|footnote)\{[^}]*\}", "", text)
        text = re.sub(r"\\begin\{(equation|align|align\*|equation\*)\}", "$$\n", text)
        text = re.sub(r"\\end\{(equation|align|align\*|equation\*)\}", "\n$$", text)
        return text
