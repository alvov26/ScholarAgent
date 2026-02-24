# Scholar Agent (Core MVP)

## Outline
An interactive, web-based academic paper reader that compiles arXiv LaTeX source files into accessible HTML5. It provides robust, node-level interaction with math formulas and allows users to create, attach, and persist tooltips to text and symbols across reading sessions.

## Philosophy
**LaTeX-first, deterministic pipeline**. No PDF parsing heuristics, no markdown intermediaries. Direct LaTeX → HTML5 + MathML compilation for maximum reliability and precision.

---

## Features

### MVP: Core Rendering & Interaction
- **Source Compilation**: Accepts an arXiv source folder (`.tar.gz` with `.tex`, `.bib`, etc.) and compiles it into a single structured HTML5 document.
- **Robust In-Formula Selection**: Precise, node-based symbol selection using MathJax 4 Semantic Enrichment (SRE).
    - Users can click on individual symbols or sub-expressions within a formula (rendered from MathML).
    - Ensures logical consistency (e.g., selecting the entire superscript vs. a specific base variable).
- **Persistent User Tooltips**: Users can highlight text or click math symbols to attach manual tooltips and notes.
    - Tooltips persist between sessions.
    - Tooltips are anchored to unique, stable DOM identifiers generated during the HTML compilation.
- **Interactive Bibliography**: Citations are clickable links that scroll to or display the bibliography entry.

### Post-MVP: Agentic Features (Deferred)
- Symbol Glossary Agent & context-aware auto-resolution.
- Logical Flow Map & structural RAG (Motivation → Core Hypothesis → Proof).
- User-profile dependent tooltip generation.
- Semantic Scholar API integration for "Reference Peeking".

### Won't Have
- Writing papers
- Math animations (e.g. Manim integration)
- PDF parsing (completely removed)

---

## Architecture & Stages

### Stage 1: Document Compilation (The "Cracking" Phase)
**Input**: arXiv `.tar.gz` source archive
**Output**: Rich HTML5 + MathML

- **Toolchain**: `LaTeXML` (packaged via the `engrafo` Docker container for reliable environment handling).
- **Process**:
    1. Unpack source archive.
    2. Run LaTeXML to resolve macros, bibliography (`.bbl`/`.bib`), and generate HTML5.
    3. **Post-Processing (Crucial)**: Inject stable, deterministic `data-id` attributes into the HTML nodes (paragraphs, sections, math blocks) so the frontend has anchors for persisting tooltips.

### Stage 2: Core Serving & Persistence
- **Backend**: FastAPI
    - **API**: Endpoints to upload source archives, fetch compiled HTML, and CRUD endpoints for user tooltips.
    - **Database**: PostgreSQL (Relational tables mapping `user_id` + `document_id` + `dom_node_id` to tooltip content).
    - *(Note: Vector storage like pgvector/LanceDB is shelved until the RAG/Agentic phase).*

- **Frontend**: Next.js
    - **Renderer**: `html-react-parser` (Replaces `react-markdown`).
        - This library allows you to take the raw HTML string from the backend and intercept specific tags (like `<math>` or `<span class="citation">`) to replace them with interactive React components.
    - **Math Engine**: `MathJax 4` (via `mathjax-full`).
        - Takes the MathML output from LaTeXML, applies Semantic Enrichment (SRE), and renders it as interactable SVG/HTML.
    - **Interactivity**: `Framer Motion` for smooth tooltip positioning and transitions.

---

## Tech Stack

### Backend
- **FastAPI**: API server
- **PostgreSQL**: Relational database for tooltips and metadata
- **LaTeXML**: LaTeX → HTML5 + MathML compiler (via Docker)
- No LlamaParse, no pypandoc, no LlamaIndex (for MVP)

### Frontend
- **Next.js**: React framework
- **html-react-parser**: HTML → React component tree
- **mathjax-full**: MathML rendering with semantic enrichment
- **framer-motion**: Tooltip animations
- No react-markdown, no remark-math, no rehype-mathjax (replaced by direct HTML rendering)

