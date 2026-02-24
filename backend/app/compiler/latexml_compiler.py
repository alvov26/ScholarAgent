"""
LaTeXML Compiler Service

Compiles LaTeX sources to HTML5 + MathML using LaTeXML (via Docker or local installation).
Post-processes HTML to inject stable data-id attributes for tooltip anchoring.
"""

import hashlib
import re
import shutil
import subprocess
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Optional
from html.parser import HTMLParser


class DataIdInjector(HTMLParser):
    """
    HTML post-processor that injects stable data-id attributes into content nodes.

    Target elements: p, section, h1-h6, math, span (with specific classes), figure, table
    """

    INJECTABLE_TAGS = {'p', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                       'math', 'figure', 'table', 'li', 'blockquote', 'pre'}

    def __init__(self, paper_id: str):
        super().__init__()
        self.paper_id = paper_id
        self.output: list[str] = []
        self.node_counters: dict[str, int] = {}
        self.path_stack: list[str] = []

    def _generate_data_id(self, tag: str) -> str:
        """Generate a stable, deterministic data-id based on paper_id and node path."""
        # Increment counter for this tag type
        self.node_counters[tag] = self.node_counters.get(tag, 0) + 1
        count = self.node_counters[tag]

        # Create path-based identifier
        path = "/".join(self.path_stack + [f"{tag}[{count}]"])

        # Generate hash
        hash_input = f"{self.paper_id}:{path}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]):
        self.path_stack.append(tag)

        attrs_dict = dict(attrs)

        # Inject data-id for injectable tags that don't already have one
        if tag in self.INJECTABLE_TAGS and 'data-id' not in attrs_dict:
            data_id = self._generate_data_id(tag)
            attrs_dict['data-id'] = data_id

        # Reconstruct tag
        attr_str = ''
        for key, value in attrs_dict.items():
            if value is None:
                attr_str += f' {key}'
            else:
                # Escape quotes in value
                escaped = value.replace('"', '&quot;')
                attr_str += f' {key}="{escaped}"'

        self.output.append(f'<{tag}{attr_str}>')

    def handle_endtag(self, tag: str):
        if self.path_stack and self.path_stack[-1] == tag:
            self.path_stack.pop()
        self.output.append(f'</{tag}>')

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, Optional[str]]]):
        attrs_dict = dict(attrs)

        if tag in self.INJECTABLE_TAGS and 'data-id' not in attrs_dict:
            data_id = self._generate_data_id(tag)
            attrs_dict['data-id'] = data_id

        attr_str = ''
        for key, value in attrs_dict.items():
            if value is None:
                attr_str += f' {key}'
            else:
                escaped = value.replace('"', '&quot;')
                attr_str += f' {key}="{escaped}"'

        self.output.append(f'<{tag}{attr_str} />')

    def handle_data(self, data: str):
        self.output.append(data)

    def handle_comment(self, data: str):
        self.output.append(f'<!--{data}-->')

    def handle_decl(self, decl: str):
        self.output.append(f'<!{decl}>')

    def handle_pi(self, data: str):
        self.output.append(f'<?{data}>')

    def handle_entityref(self, name: str):
        self.output.append(f'&{name};')

    def handle_charref(self, name: str):
        self.output.append(f'&#{name};')

    def get_result(self) -> str:
        return ''.join(self.output)


def inject_data_ids(html: str, paper_id: str) -> str:
    """Inject stable data-id attributes into HTML content nodes."""
    injector = DataIdInjector(paper_id)
    injector.feed(html)
    return injector.get_result()


class LaTeXMLCompiler:
    """
    Compiles LaTeX sources to HTML5 using LaTeXML.

    Supports both Docker-based compilation (engrafo) and local latexml installation.
    """

    def __init__(self, use_docker: bool = True, docker_image: str = "latexml/ar5ivist"):
        self.use_docker = use_docker
        self.docker_image = docker_image

    def compile(self, source_path: Path, paper_id: str) -> str:
        """
        Compile LaTeX source to HTML.

        Args:
            source_path: Path to .tar.gz, .zip, or .tex file
            paper_id: Unique identifier for the paper (used for data-id generation)

        Returns:
            Compiled HTML string with injected data-id attributes
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            work_dir = Path(tmpdir)
            source_dir = work_dir / "source"
            output_dir = work_dir / "output"
            source_dir.mkdir()
            output_dir.mkdir()

            # Extract or copy source
            self._prepare_source(source_path, source_dir)

            # Find main tex file
            main_tex = self._find_main_tex(source_dir)
            if not main_tex:
                raise ValueError("No main .tex file found in source")

            # Compile
            if self.use_docker:
                html = self._compile_with_docker(source_dir, main_tex, output_dir)
            else:
                html = self._compile_locally(source_dir, main_tex, output_dir)

            # Post-process: inject data-id attributes
            html = inject_data_ids(html, paper_id)

            return html

    def _prepare_source(self, source_path: Path, dest_dir: Path) -> None:
        """Extract archive or copy single file to destination directory."""
        name = source_path.name.lower()

        if name.endswith('.tar.gz') or name.endswith('.tgz') or name.endswith('.tar'):
            with tarfile.open(source_path, 'r:*') as archive:
                # Safe extraction
                for member in archive.getmembers():
                    target = (dest_dir / member.name).resolve()
                    if not str(target).startswith(str(dest_dir.resolve())):
                        continue
                    archive.extract(member, dest_dir)
        elif name.endswith('.zip'):
            with zipfile.ZipFile(source_path, 'r') as archive:
                for member in archive.infolist():
                    target = (dest_dir / member.filename).resolve()
                    if not str(target).startswith(str(dest_dir.resolve())):
                        continue
                    archive.extract(member, dest_dir)
        elif name.endswith('.tex'):
            shutil.copy(source_path, dest_dir / source_path.name)
        else:
            raise ValueError(f"Unsupported source format: {source_path.suffix}")

    def _find_main_tex(self, source_dir: Path) -> Optional[Path]:
        """Find the main .tex file using heuristics."""
        tex_files = list(source_dir.rglob("*.tex"))
        if not tex_files:
            return None

        if len(tex_files) == 1:
            return tex_files[0]

        def score_tex(path: Path) -> int:
            score = 0
            name = path.name.lower()

            # Prefer common main file names
            if name in {"main.tex", "paper.tex", "ms.tex", "article.tex"}:
                score += 5

            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                return score

            # Must have documentclass
            if "\\documentclass" in text:
                score += 3

            # Must have begin{document}
            if "\\begin{document}" in text:
                score += 3

            # Longer files tend to be the main file
            score += min(len(text) // 5000, 3)

            return score

        return max(tex_files, key=score_tex)

    def _compile_with_docker(self, source_dir: Path, main_tex: Path, output_dir: Path) -> str:
        """Compile using Docker (latexml/ar5ivist with latexmlc)."""
        relative_tex = main_tex.relative_to(source_dir)
        output_html = output_dir / "output.html"

        # Run latexmlc (one-step LaTeX -> HTML5)
        # Note: ar5ivist image has latexmlc as entrypoint, so we just pass args
        cmd = [
            "docker", "run", "--rm",
            "-v", f"{source_dir}:/source:ro",
            "-v", f"{output_dir}:/output",
            self.docker_image,
            f"/source/{relative_tex}",
            "--dest=/output/output.html",
            "--format=html5",
            "--pmml",  # Presentation MathML
            "--cmml",  # Content MathML
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise RuntimeError(f"latexmlc failed: {result.stderr}\n{result.stdout}")

        html = output_html.read_text(encoding="utf-8")

        # Extract body content only (LaTeXML outputs full HTML document)
        return self._extract_body(html)

    def _extract_body(self, html: str) -> str:
        """Extract content from <body> tag, stripping document wrapper."""
        import re
        # Match body content (non-greedy)
        match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1)
        # Fallback: return as-is if no body tag found
        return html

    def _compile_locally(self, source_dir: Path, main_tex: Path, output_dir: Path) -> str:
        """Compile using local latexml installation."""
        output_xml = output_dir / "output.xml"
        output_html = output_dir / "output.html"

        # Run latexml
        latexml_cmd = [
            "latexml",
            f"--dest={output_xml}",
            str(main_tex)
        ]

        result = subprocess.run(
            latexml_cmd,
            capture_output=True,
            text=True,
            timeout=300,
            cwd=source_dir
        )
        if result.returncode != 0:
            raise RuntimeError(f"latexml failed: {result.stderr}")

        # Run latexmlpost
        latexmlpost_cmd = [
            "latexmlpost",
            f"--dest={output_html}",
            "--format=html5",
            "--mathml",
            str(output_xml)
        ]

        result = subprocess.run(latexmlpost_cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(f"latexmlpost failed: {result.stderr}")

        html = output_html.read_text(encoding="utf-8")
        return self._extract_body(html)


# Convenience function for API usage
def compile_latex_to_html(source_path: Path, paper_id: str, use_docker: bool = True) -> str:
    """
    Compile LaTeX source to HTML with data-id injection.

    Args:
        source_path: Path to source archive (.tar.gz, .zip) or .tex file
        paper_id: Unique paper identifier for data-id generation
        use_docker: Whether to use Docker for compilation

    Returns:
        Compiled HTML string
    """
    compiler = LaTeXMLCompiler(use_docker=use_docker)
    return compiler.compile(source_path, paper_id)
