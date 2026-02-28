# Knowledge Graph Implementation Plan

## Overview
Build an agentic system that automatically extracts semantic structure from compiled papers and constructs a navigable knowledge graph showing relationships between concepts, definitions, theorems, and symbols.

**Goal**: Transform the reader from a passive document viewer into an active navigation tool where users can:
- Jump to symbol definitions
- See where concepts are used
- Understand theorem dependencies
- Navigate by conceptual relationships (not just sections)

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Compile-Time Metadata | ✅ Complete | Sections, equations, citations extracted at compile time |
| Phase 1: LangGraph Pipeline | ✅ Complete | Parallel extraction with progress tracking |
| Phase 2: Graph Storage | ✅ Complete (simplified) | Using JSONB on Paper model (not separate tables) |
| Phase 3: Frontend Visualization | ✅ Complete | React Flow with real-time progress UI |

**See also:** `KNOWLEDGE_GRAPH_SCAFFOLD.md` for a concise reference on the pipeline architecture.

---

## Architecture: Three-Phase Approach

### Phase 0: Preparatory Work - Compile-Time Metadata Extraction
Enhance the LaTeXML compilation pipeline to extract and store structured metadata at compile time. This provides a foundation for the agent pipeline and eliminates redundant parsing.

### Phase 1: Extraction Pipeline (LangGraph)
Multi-agent workflow that uses pre-extracted metadata and analyzes content to build semantic knowledge graph.

### Phase 2: Graph Persistence & Visualization
Store extracted knowledge in PostgreSQL and visualize in the left panel.

---

## Phase 0: Preparatory Work - Architecture Enhancements

### Motivation

**Current State:**
- Compiler returns only HTML string
- Frontend re-parses HTML for TOC (client-side)
- Agent pipeline would need to re-parse HTML for sections
- No structured data stored in database

**Problems:**
- Redundant parsing (frontend TOC, agent pipeline sections)
- Slower agent startup (needs to parse before extracting)
- No access to LaTeX source context for better extractions
- Citations, equations extracted multiple times

**Solution: Extract Once, Use Everywhere**

At compile time, extract all agent-relevant metadata and store it in the database. Both frontend and agents consume this pre-parsed data.

---

### Compilation Pipeline Enhancement

#### New Return Type

```python
from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class CompilationResult:
    """Structured result from LaTeXML compilation"""
    html_content: str                  # Compiled HTML with data-ids
    sections: List[Dict]               # Section hierarchy (for TOC + agents)
    equations: List[Dict]              # Extracted equations with LaTeX
    citations: List[Dict]              # Bibliography entries
    metadata: Optional[Dict]           # Title, authors, abstract (if present)
    latex_source: Optional[str]        # Raw main.tex content
```

#### Updated Compiler Interface

```python
# backend/app/compiler/latexml_compiler.py

class LaTeXMLCompiler:
    def compile(
        self,
        source_path: Path,
        paper_id: str,
        assets_dir: Optional[Path] = None
    ) -> CompilationResult:
        """
        Compile LaTeX source to HTML with metadata extraction.

        Returns:
            CompilationResult with HTML, sections, equations, citations, etc.
        """
        # ... existing compilation logic ...

        # Post-process: inject data-id attributes
        html = inject_data_ids(html, paper_id)

        # NEW: Extract metadata at compile time
        sections = extract_sections(html, paper_id)
        equations = extract_equations(html, paper_id)
        citations = extract_citations(html, paper_id)
        doc_metadata = extract_document_metadata(html)

        # Read LaTeX source for agent context
        latex_source = None
        if main_tex:
            try:
                latex_source = main_tex.read_text(encoding='utf-8', errors='ignore')
            except Exception:
                pass  # Non-critical if source can't be read

        return CompilationResult(
            html_content=html,
            sections=sections,
            equations=equations,
            citations=citations,
            metadata=doc_metadata,
            latex_source=latex_source
        )
```

---

### Metadata Extraction Functions

#### 1. Section Extraction (Port from Frontend)

```python
def extract_sections(html: str, paper_id: str) -> List[Dict]:
    """
    Extract hierarchical section structure from compiled HTML.

    This replaces the frontend parseTOC logic - both TOC and agents
    will use this pre-extracted data.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'html.parser')
    headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], attrs={'data-id': True})

    sections = []
    stack = []  # Track parent sections

    for heading in headings:
        level = int(heading.name[1])  # h1 -> 1, h2 -> 2
        data_id = heading.get('data-id')

        # Find parent in stack
        while stack and stack[-1]['level'] >= level:
            stack.pop()

        parent_id = stack[-1]['id'] if stack else None

        # Extract content between this heading and next
        content_nodes = []
        for sibling in heading.find_next_siblings():
            if sibling.name and sibling.name.startswith('h'):
                break
            content_nodes.append(str(sibling))

        section = {
            'id': data_id,
            'title': heading.get_text().strip(),
            'title_html': str(heading),  # Preserve MathML in titles
            'level': level,
            'parent_id': parent_id,
            'content_html': '\n'.join(content_nodes),
            'dom_node_id': data_id
        }

        sections.append(section)
        stack.append({'id': data_id, 'level': level})

    return sections
```

#### 2. Equation Extraction

```python
def extract_equations(html: str, paper_id: str) -> List[Dict]:
    """
    Extract all equation blocks with their LaTeX source.

    Useful for agents to analyze equations without re-parsing.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'html.parser')
    equations = []

    for math_tag in soup.find_all('math', attrs={'data-id': True}):
        math_id = math_tag.get('data-id')

        # Try to extract LaTeX from MathML (if available in attributes/annotation)
        latex = extract_latex_from_mathml(math_tag)

        # Determine if display or inline
        display_style = math_tag.get('display') == 'block'

        equations.append({
            'id': math_id,
            'latex': latex,
            'is_display': display_style,
            'dom_node_id': math_id,
            'mathml': str(math_tag)  # Keep MathML for frontend
        })

    return equations

def extract_latex_from_mathml(math_tag) -> Optional[str]:
    """Extract LaTeX from MathML annotation if present"""
    # Check for <annotation encoding="application/x-tex">
    annotation = math_tag.find('annotation', {'encoding': 'application/x-tex'})
    if annotation:
        return annotation.get_text()

    # Fallback: basic MathML to LaTeX (or return None)
    return None
```

#### 3. Citation Extraction

```python
def extract_citations(html: str, paper_id: str) -> List[Dict]:
    """
    Extract bibliography entries from compiled HTML.

    Useful for future citation analysis and Semantic Scholar integration.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'html.parser')
    citations = []

    # LaTeXML typically puts bibliography in a section with class ltx_bibliography
    bib_section = soup.find(['section', 'div'], class_='ltx_bibliography')

    if bib_section:
        for entry in bib_section.find_all('li', class_='ltx_bibitem'):
            cite_key = entry.get('id', '').replace('bib.', '')  # cite.Author2023 -> Author2023
            cite_text = entry.get_text().strip()
            dom_id = entry.get('data-id')

            citations.append({
                'key': cite_key,
                'text': cite_text,
                'dom_node_id': dom_id
            })

    return citations
```

#### 4. Document Metadata Extraction

```python
def extract_document_metadata(html: str) -> Optional[Dict]:
    """
    Extract paper metadata (title, authors, abstract) if present.

    LaTeXML often includes this in the document header.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'html.parser')
    metadata = {}

    # Extract title
    title_tag = soup.find(['h1', 'h2'], class_='ltx_title')
    if title_tag:
        metadata['title'] = title_tag.get_text().strip()

    # Extract authors
    authors = []
    for author_tag in soup.find_all('span', class_='ltx_creator'):
        authors.append(author_tag.get_text().strip())
    if authors:
        metadata['authors'] = authors

    # Extract abstract
    abstract_div = soup.find(['div', 'section'], class_='ltx_abstract')
    if abstract_div:
        metadata['abstract'] = abstract_div.get_text().strip()

    return metadata if metadata else None
```

---

### Database Schema Updates

Extend the `Paper` model to store extracted metadata:

```python
# backend/app/database/models.py

from sqlalchemy.dialects.postgresql import JSONB

class Paper(Base):
    __tablename__ = "papers"

    id = Column(String(64), primary_key=True)
    filename = Column(String(255), nullable=False)
    arxiv_id = Column(String(20), nullable=True)
    html_content = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=utcnow)
    compiled_at = Column(DateTime, nullable=True)

    # NEW: Extracted metadata (JSONB for flexibility)
    sections_data = Column(JSONB, nullable=True)      # Section hierarchy
    equations_data = Column(JSONB, nullable=True)     # Equations with LaTeX
    citations_data = Column(JSONB, nullable=True)     # Bibliography
    metadata = Column(JSONB, nullable=True)           # Title, authors, abstract
    latex_source = Column(Text, nullable=True)        # Raw LaTeX (for agent context)

    tooltips = relationship("Tooltip", back_populates="paper", cascade="all, delete-orphan")
    kg_nodes = relationship("KGNode", back_populates="paper", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Paper(id={self.id[:8]}..., filename={self.filename})>"
```

**Migration Required:**
```bash
cd backend
alembic revision -m "add structured metadata to papers"
# Edit migration file to add columns
alembic upgrade head
```

---

### API Updates

Update the upload endpoint to store extracted metadata:

```python
# backend/app/api/main.py

@app.post("/api/papers/upload", response_model=PaperResponse)
async def upload_paper(
    file: UploadFile = File(...),
    compile_now: bool = Form(default=True),
    db: Session = Depends(get_db)
):
    # ... existing upload logic ...

    if compile_now:
        try:
            paper_assets_dir = ASSETS_DIR / file_hash

            # NEW: Get structured compilation result
            result = compile_latex_to_html(
                upload_path,
                file_hash,
                use_docker=USE_DOCKER,
                assets_dir=paper_assets_dir
            )

            # Store all extracted data
            paper.html_content = result.html_content
            paper.sections_data = result.sections
            paper.equations_data = result.equations
            paper.citations_data = result.citations
            paper.metadata = result.metadata
            paper.latex_source = result.latex_source
            paper.compiled_at = datetime.now(UTC)

        except Exception as e:
            paper.html_content = None
            # Log error

    db.add(paper)
    db.commit()
    db.refresh(paper)

    return _paper_to_response(paper)
```

**Update convenience function signature:**

```python
# backend/app/compiler/latexml_compiler.py

def compile_latex_to_html(
    source_path: Path,
    paper_id: str,
    use_docker: bool = True,
    assets_dir: Optional[Path] = None
) -> CompilationResult:  # Changed from -> str
    """
    Compile LaTeX source to HTML with metadata extraction.

    Returns:
        CompilationResult with HTML and extracted metadata
    """
    compiler = LaTeXMLCompiler(use_docker=use_docker)
    return compiler.compile(source_path, paper_id, assets_dir=assets_dir)
```

---

### Frontend Updates

Update API response models to include pre-extracted data:

```python
# backend/app/api/main.py

class PaperDetailResponse(PaperResponse):
    html_content: Optional[str] = None
    sections: Optional[List[Dict]] = None       # NEW
    equations: Optional[List[Dict]] = None      # NEW
    citations: Optional[List[Dict]] = None      # NEW
    paper_metadata: Optional[Dict] = None       # NEW

@app.get("/api/papers/{paper_id}", response_model=PaperDetailResponse)
async def get_paper(paper_id: str, db: Session = Depends(get_db)):
    """Get paper with compiled HTML and metadata"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    return PaperDetailResponse(
        id=paper.id,
        filename=paper.filename,
        arxiv_id=paper.arxiv_id,
        uploaded_at=paper.uploaded_at,
        compiled_at=paper.compiled_at,
        has_html=paper.html_content is not None,
        html_content=paper.html_content,
        sections=paper.sections_data,           # NEW
        equations=paper.equations_data,         # NEW
        citations=paper.citations_data,         # NEW
        paper_metadata=paper.metadata           # NEW
    )
```

**Frontend Usage (No More Parsing!):**

```tsx
// frontend/components/reader/PaperLoader.tsx

const toc = useMemo(() => {
    // Use pre-extracted sections from backend
    if (currentPaper?.sections) {
        return buildHierarchy(currentPaper.sections);  // Simple tree builder
    }
    // Fallback for old papers without sections_data
    return parseTOC(currentPaper?.html_content);
}, [currentPaper]);
```

---

### Benefits of This Approach

1. **Performance:**
   - Frontend TOC loads instantly (no HTML parsing)
   - Agent pipeline starts faster (no section parsing needed)

2. **Consistency:**
   - Single source of truth for document structure
   - Frontend and agents see identical data

3. **Scalability:**
   - Easy to add more compile-time extractions (figures, tables, etc.)
   - Pre-extracted data can be indexed for search

4. **Context for Agents:**
   - LaTeX source provides explicit theorem/definition environments
   - Equations already extracted with LaTeX for easy analysis
   - Citations ready for Semantic Scholar integration

---

### Implementation Checklist

- [x] Create `CompilationResult` dataclass
- [x] Implement `extract_sections()` function
- [x] Implement `extract_equations()` function
- [x] Implement `extract_citations()` function
- [x] Implement `extract_document_metadata()` function
- [x] Update `LaTeXMLCompiler.compile()` to return `CompilationResult`
- [x] Update convenience function signature
- [x] Add database migration for new JSONB columns
- [x] Update Paper model with new fields
- [x] Update API upload endpoint to store metadata
- [x] Update API get_paper endpoint to return metadata
- [x] Update frontend to use pre-extracted sections
- [x] Test with sample papers (arXiv + local)

---

## Phase 1: LangGraph Agent Pipeline

### State Schema

```python
from typing import TypedDict, List, Dict, Optional
from langgraph.graph import StateGraph, END

class GraphState(TypedDict):
    """Shared state passed between agents"""
    paper_id: str

    # Pre-extracted data from Phase 0 (already in database)
    sections: List[Dict]      # From paper.sections_data
    equations: List[Dict]     # From paper.equations_data
    citations: List[Dict]     # From paper.citations_data
    latex_source: Optional[str]  # From paper.latex_source

    # Agent-extracted entities
    symbols: List[Dict]       # {symbol, first_occurrence_id, context, latex}
    definitions: List[Dict]   # {term, definition_text, dom_node_id, section_id}
    theorems: List[Dict]      # {name, statement, dom_node_id, type: 'theorem'|'lemma'|'corollary'}

    # Relationships
    relationships: List[Dict] # {from_id, to_id, type, evidence_text}

    # Final output
    graph_data: Dict          # {nodes: [...], edges: [...]}

    # Error tracking
    errors: List[str]
```

### Agent Pipeline Flow (Simplified)

**Key Change:** Section and equation extraction now happen at compile time (Phase 0).
The agent pipeline starts with pre-extracted data from the database.

```
┌─────────────────────────┐
│  Fetch from Database    │
│  - paper.sections_data  │ ← Already extracted at compile time!
│  - paper.equations_data │
│  - paper.citations_data │
│  - paper.latex_source   │
└────────────┬────────────┘
             │
             ├──────────────────────┬──────────────────────┬──────────────────────┐
             ▼                      ▼                      ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐
│ 1. Symbol Agent     │  │ 2. Definition Agent │  │ 3. Theorem Agent    │  │ 4. LaTeX Theorem     │
│    (LLM)            │  │    (LLM)            │  │    (LLM on HTML)    │  │    Agent (LLM)       │
│                     │  │                     │  │                     │  │                      │
│ Analyzes sections   │  │ Finds: "X is        │  │ Finds: "Theorem     │  │ Parses LaTeX source  │
│ Extracts: α_t,      │  │ defined as..."      │  │ 3.2:", "Lemma",     │  │ for \begin{theorem}  │
│ \mathcal{L},        │  │ blocks              │  │ "Corollary" in HTML │  │ environments         │
│ key variables       │  │                     │  │                     │  │ (more reliable!)     │
└─────────┬───────────┘  └─────────┬───────────┘  └─────────┬───────────┘  └──────────┬───────────┘
          │                        │                        │                          │
          └────────────────────────┴────────────────────────┴──────────────────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────┐
                                   │ 5. Dependency Agent     │ ← Finds cross-references
                                   │    (LLM)                │   "By Theorem X..."
                                   │                         │   "Using Definition Y..."
                                   └────────────┬────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────┐
                                   │ 6. Graph Builder        │ ← Assembles nodes + edges
                                   │    (Pure Logic)         │   Merges theorem data
                                   └────────────┬────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────┐
                                   │  Output: graph_data     │
                                   │  {nodes, edges}         │
                                   └─────────────────────────┘
```

**Benefits of Pre-Extraction:**
- **Faster startup**: No HTML parsing needed, agents start immediately
- **Better context**: LaTeX source gives explicit theorem environments: `\begin{theorem}...\end{theorem}`
- **Consistency**: Same section data used by frontend TOC and agents
- **Equations ready**: No need to re-extract math blocks

---

## Agent Specifications

### 1. Data Loader (Replaces Section Parser)
**Type**: Database query (no LLM, no parsing)
**Input**: `paper_id`
**Output**: Pre-extracted data from Phase 0

**Implementation**:
```python
def load_paper_data(state: GraphState) -> GraphState:
    """
    Load pre-extracted metadata from database.

    This replaces the old section parser - data already extracted at compile time.
    """
    from backend.app.database.connection import get_db
    from backend.app.database.models import Paper

    db = next(get_db())
    paper = db.query(Paper).filter(Paper.id == state["paper_id"]).first()

    if not paper:
        raise ValueError(f"Paper {state['paper_id']} not found")

    # Load pre-extracted data
    state["sections"] = paper.sections_data or []
    state["equations"] = paper.equations_data or []
    state["citations"] = paper.citations_data or []
    state["latex_source"] = paper.latex_source

    return state
```

**Output**: State populated with pre-extracted data, ready for agent analysis.

---

### 2. Symbol Extraction Agent
**Type**: LLM (Claude Sonnet)
**Input**: `sections`
**Output**: `symbols` list

**Prompt Template**:
```python
system_prompt = """You are a mathematical symbol extractor for academic papers.
Your task is to identify and extract all mathematical symbols, variables, and notation
from a section of text.

For each symbol, provide:
1. The symbol itself (in LaTeX if applicable, e.g., \\alpha_t, \\mathcal{L})
2. A brief context (1 sentence explaining what it represents)
3. Whether it's newly introduced in this section (boolean)

Output as JSON array.
"""

user_prompt = """Section: {section_title}

Content:
{content_html}

Extract all mathematical symbols and key notation."""
```

**Structured Output (Pydantic)**:
```python
from pydantic import BaseModel, Field
from typing import List

class Symbol(BaseModel):
    symbol: str = Field(description="The symbol in LaTeX format")
    context: str = Field(description="Brief explanation (1 sentence)")
    is_new: bool = Field(description="Is this symbol introduced in this section?")
    latex_form: str = Field(description="Pure LaTeX representation")

class SymbolExtractionOutput(BaseModel):
    symbols: List[Symbol]
```

**Implementation**:
```python
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate

def symbol_extraction(state: GraphState) -> GraphState:
    """Extract symbols using LLM with structured output"""
    llm = ChatAnthropic(model="claude-sonnet-4")
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", user_prompt)
    ])

    structured_llm = llm.with_structured_output(SymbolExtractionOutput)

    symbols = []
    for section in state["sections"]:
        try:
            response = structured_llm.invoke({
                "section_title": section["title"],
                "content_html": section["content_html"]
            })

            for symbol in response.symbols:
                symbols.append({
                    "symbol": symbol.symbol,
                    "context": symbol.context,
                    "first_occurrence_id": section["dom_node_id"],
                    "section_id": section["id"],
                    "latex": symbol.latex_form,
                    "is_new": symbol.is_new
                })
        except Exception as e:
            state["errors"].append(f"Symbol extraction failed for section {section['id']}: {str(e)}")

    state["symbols"] = symbols
    return state
```

**Output Example**:
```python
[
  {
    "symbol": "α_t",
    "context": "Noise scaling parameter at timestep t",
    "first_occurrence_id": "def456",
    "section_id": "def456",
    "latex": "\\alpha_t",
    "is_new": True
  },
  {
    "symbol": "ℒ",
    "context": "Loss function for the diffusion model",
    "first_occurrence_id": "ghi789",
    "section_id": "ghi789",
    "latex": "\\mathcal{L}",
    "is_new": True
  }
]
```

---

### 3. Definition Extraction Agent
**Type**: LLM (Claude Sonnet)
**Input**: `sections`
**Output**: `definitions` list

**Heuristics to Guide LLM**:
- "We define X as..."
- "Let X be..."
- "X is defined as..."
- Paragraphs following "Definition N.M:"
- Bold/italic terms followed by descriptions

**Prompt Template**:
```python
system_prompt = """You are a definition extractor for academic papers.
Identify both formal and informal definitions.

A definition includes:
- The term being defined
- The definition text (what it means)
- Whether it's formal (numbered, e.g., "Definition 3.2") or informal

Be precise: only extract statements that actually define a concept, not just mentions."""

user_prompt = """Section: {section_title}

Content:
{content_html}

Extract all definitions."""
```

**Structured Output**:
```python
class Definition(BaseModel):
    term: str = Field(description="The term being defined")
    definition_text: str = Field(description="The definition itself")
    is_formal: bool = Field(description="Is this a numbered/formal definition?")
    definition_number: Optional[str] = Field(description="e.g., 'Definition 3.2' if formal")

class DefinitionExtractionOutput(BaseModel):
    definitions: List[Definition]
```

**Implementation**: Similar to symbol extraction, but returns definitions.

**Output Example**:
```python
[
  {
    "term": "Diffusion Process",
    "definition_text": "A stochastic process that gradually adds noise to data",
    "dom_node_id": "def456",
    "section_id": "def456",
    "is_formal": False,
    "definition_number": None
  },
  {
    "term": "Forward Process",
    "definition_text": "The process q(x_t | x_{t-1}) that corrupts data with Gaussian noise",
    "dom_node_id": "def789",
    "section_id": "def456",
    "is_formal": True,
    "definition_number": "Definition 3.1"
  }
]
```

---

### 4. Theorem Extraction Agent
**Type**: LLM (Claude Sonnet)
**Input**: `sections`
**Output**: `theorems` list

**Target Patterns**:
- "Theorem N.M:"
- "Lemma N.M:"
- "Corollary N.M:"
- "Proposition N.M:"

**Prompt Template**:
```python
system_prompt = """You are a theorem extractor for academic papers.
Identify all formal mathematical statements: theorems, lemmas, corollaries, propositions.

For each, extract:
- Type (theorem/lemma/corollary/proposition)
- Number (e.g., "3.2")
- Statement (the actual claim)
- Name (if given, e.g., "Theorem 3.2 (Convergence)")
"""

user_prompt = """Section: {section_title}

Content:
{content_html}

Extract all formal statements."""
```

**Structured Output**:
```python
class Theorem(BaseModel):
    type: str = Field(description="theorem/lemma/corollary/proposition")
    number: str = Field(description="e.g., '3.2'")
    name: Optional[str] = Field(description="Optional name, e.g., 'Convergence Theorem'")
    statement: str = Field(description="The actual theorem statement")

class TheoremExtractionOutput(BaseModel):
    theorems: List[Theorem]
```

**Output Example**:
```python
[
  {
    "type": "theorem",
    "number": "3.2",
    "name": "Convergence of Reverse Process",
    "statement": "The reverse process converges to the data distribution as T → ∞",
    "dom_node_id": "thm123",
    "section_id": "abc123"
  }
]
```

---

### 5. Dependency Extraction Agent
**Type**: LLM (Claude Sonnet)
**Input**: `sections`, `symbols`, `definitions`, `theorems`
**Output**: `relationships` list

**Goal**: Find cross-references and dependencies

**Patterns to Detect**:
- "By Theorem X..."
- "Using Definition Y..."
- "This follows from Lemma Z..."
- "Recall that..." (refers to earlier concept)
- Symbol usage: "where α_t is defined in Section 3"

**Prompt Template**:
```python
system_prompt = """You are analyzing dependencies in an academic paper.
Identify relationships between concepts:
- "uses": X uses Y in its proof/derivation
- "depends_on": X logically depends on Y
- "defines": X defines symbol/term Y
- "mentions": X references Y

Output relationships as JSON."""

user_prompt = """Section: {section_title}

Content:
{content_html}

Known entities:
- Symbols: {symbol_list}
- Definitions: {definition_list}
- Theorems: {theorem_list}

Extract all dependency relationships in this section."""
```

**Structured Output**:
```python
class Relationship(BaseModel):
    from_entity: str = Field(description="Source entity ID or name")
    to_entity: str = Field(description="Target entity ID or name")
    relationship_type: str = Field(description="uses/depends_on/defines/mentions")
    evidence_text: str = Field(description="The text that shows this relationship")

class RelationshipExtractionOutput(BaseModel):
    relationships: List[Relationship]
```

**Implementation**:
```python
def dependency_extraction(state: GraphState) -> GraphState:
    """Extract dependencies between entities"""
    llm = ChatAnthropic(model="claude-sonnet-4")
    structured_llm = llm.with_structured_output(RelationshipExtractionOutput)

    relationships = []

    for section in state["sections"]:
        # Prepare context: list known entities
        symbol_list = [s["symbol"] for s in state["symbols"]]
        definition_list = [d["term"] for d in state["definitions"]]
        theorem_list = [f"{t['type'].capitalize()} {t['number']}" for t in state["theorems"]]

        response = structured_llm.invoke({
            "section_title": section["title"],
            "content_html": section["content_html"],
            "symbol_list": ", ".join(symbol_list),
            "definition_list": ", ".join(definition_list),
            "theorem_list": ", ".join(theorem_list)
        })

        for rel in response.relationships:
            relationships.append({
                "from_id": resolve_entity_id(rel.from_entity, state),  # Helper
                "to_id": resolve_entity_id(rel.to_entity, state),
                "type": rel.relationship_type,
                "evidence": rel.evidence_text,
                "section_id": section["id"]
            })

    state["relationships"] = relationships
    return state

def resolve_entity_id(entity_name: str, state: GraphState) -> str:
    """Map entity name/number to its ID"""
    # Check symbols
    for symbol in state["symbols"]:
        if symbol["symbol"] == entity_name:
            return f"symbol_{symbol['symbol']}"

    # Check definitions
    for defn in state["definitions"]:
        if defn["term"].lower() == entity_name.lower():
            return f"def_{defn['term']}"

    # Check theorems
    for thm in state["theorems"]:
        if f"{thm['type']} {thm['number']}" == entity_name:
            return f"thm_{thm['number']}"

    # Fallback: sanitize name
    return entity_name.replace(" ", "_").lower()
```

**Output Example**:
```python
[
  {
    "from_id": "thm_3.2",
    "to_id": "def_diffusion_process",
    "type": "uses",
    "evidence": "By the definition of the diffusion process in Section 3.1...",
    "section_id": "abc123"
  },
  {
    "from_id": "eq_001",
    "to_id": "symbol_alpha_t",
    "type": "mentions",
    "evidence": "where α_t is the noise schedule",
    "section_id": "abc123"
  }
]
```

---

### 6. Graph Builder Agent
**Type**: Pure logic (no LLM)
**Input**: All extracted entities + relationships
**Output**: `graph_data` (nodes + edges)

**Implementation**:
```python
def build_graph(state: GraphState) -> GraphState:
    """Assemble final graph structure from extracted entities"""
    nodes = []
    edges = []

    # Convert symbols to nodes
    for symbol in state["symbols"]:
        nodes.append({
            "id": f"symbol_{symbol['symbol']}",
            "type": "symbol",
            "label": symbol["symbol"],
            "latex": symbol["latex"],
            "context": symbol["context"],
            "dom_node_id": symbol["first_occurrence_id"],
            "section_id": symbol["section_id"]
        })

    # Convert definitions to nodes
    for defn in state["definitions"]:
        nodes.append({
            "id": f"def_{defn['term']}",
            "type": "definition",
            "label": defn["term"],
            "definition": defn["definition_text"],
            "is_formal": defn.get("is_formal", False),
            "dom_node_id": defn["dom_node_id"],
            "section_id": defn["section_id"]
        })

    # Convert theorems to nodes
    for thm in state["theorems"]:
        nodes.append({
            "id": f"thm_{thm['number']}",
            "type": "theorem",
            "subtype": thm["type"],  # theorem/lemma/corollary
            "label": f"{thm['type'].capitalize()} {thm['number']}",
            "name": thm.get("name"),
            "statement": thm["statement"],
            "dom_node_id": thm["dom_node_id"],
            "section_id": thm["section_id"]
        })

    # Convert equations to nodes
    for eq in state["equations"]:
        nodes.append({
            "id": eq["id"],
            "type": "equation",
            "label": f"Equation {eq['id']}",
            "latex": eq["latex"],
            "purpose": eq["purpose"],
            "dom_node_id": eq["dom_node_id"],
            "section_id": eq["section_id"]
        })

    # Convert relationships to edges
    for rel in state["relationships"]:
        edges.append({
            "id": f"{rel['from_id']}_to_{rel['to_id']}",
            "source": rel["from_id"],
            "target": rel["to_id"],
            "type": rel["type"],
            "evidence": rel["evidence"]
        })

    state["graph_data"] = {
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "paper_id": state["paper_id"],
            "node_count": len(nodes),
            "edge_count": len(edges)
        }
    }

    return state
```

**Output Example**:
```json
{
  "nodes": [
    {
      "id": "symbol_alpha_t",
      "type": "symbol",
      "label": "α_t",
      "latex": "\\alpha_t",
      "context": "Noise scaling parameter",
      "dom_node_id": "def456",
      "section_id": "def456"
    },
    {
      "id": "def_diffusion_process",
      "type": "definition",
      "label": "Diffusion Process",
      "definition": "A stochastic process that adds noise to data",
      "dom_node_id": "def456",
      "section_id": "def456"
    },
    {
      "id": "thm_3.2",
      "type": "theorem",
      "subtype": "theorem",
      "label": "Theorem 3.2",
      "statement": "The reverse process converges...",
      "dom_node_id": "thm123",
      "section_id": "abc123"
    }
  ],
  "edges": [
    {
      "id": "thm_3.2_to_def_diffusion_process",
      "source": "thm_3.2",
      "target": "def_diffusion_process",
      "type": "uses",
      "evidence": "By the definition of the diffusion process..."
    }
  ]
}
```

---

## LangGraph Implementation

### Complete Workflow Code

```python
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic

# Initialize workflow
workflow = StateGraph(GraphState)

# Add all agent nodes
workflow.add_node("parse_sections", section_parser)
workflow.add_node("extract_symbols", symbol_extraction)
workflow.add_node("extract_definitions", definition_extraction)
workflow.add_node("extract_theorems", theorem_extraction)
workflow.add_node("extract_equations", equation_extraction)
workflow.add_node("extract_dependencies", dependency_extraction)
workflow.add_node("build_graph", build_graph)

# Define workflow edges
workflow.set_entry_point("parse_sections")

# Parallel extraction after section parsing
workflow.add_edge("parse_sections", "extract_symbols")
workflow.add_edge("parse_sections", "extract_definitions")
workflow.add_edge("parse_sections", "extract_theorems")
workflow.add_edge("parse_sections", "extract_equations")

# All extractions must complete before dependency analysis
workflow.add_edge("extract_symbols", "extract_dependencies")
workflow.add_edge("extract_definitions", "extract_dependencies")
workflow.add_edge("extract_theorems", "extract_dependencies")
workflow.add_edge("extract_equations", "extract_dependencies")

# Build graph after dependency extraction
workflow.add_edge("extract_dependencies", "build_graph")

# End workflow
workflow.add_edge("build_graph", END)

# Compile
app = workflow.compile()

# Usage
initial_state = {
    "paper_id": "abc123",
    "html_content": paper_html,
    "sections": [],
    "symbols": [],
    "definitions": [],
    "theorems": [],
    "equations": [],
    "relationships": [],
    "graph_data": {},
    "errors": []
}

result = app.invoke(initial_state)
print(f"Extracted {len(result['graph_data']['nodes'])} nodes")
print(f"Found {len(result['graph_data']['edges'])} relationships")
```

---

## Phase 2: Storage & API

### Database Schema

**PostgreSQL Tables** (extend existing schema):

```sql
-- Knowledge graph nodes
CREATE TABLE kg_nodes (
    id VARCHAR(255) PRIMARY KEY,
    paper_id VARCHAR(64) REFERENCES papers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- 'symbol', 'definition', 'theorem', 'equation', 'section'
    subtype VARCHAR(50),         -- For theorems: 'lemma', 'corollary', etc.
    label VARCHAR(500) NOT NULL,
    data JSONB NOT NULL,         -- Store all extra fields (latex, context, statement, etc.)
    dom_node_id VARCHAR(128),    -- Link to HTML node
    section_id VARCHAR(128),     -- Which section it belongs to
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kg_nodes_paper ON kg_nodes(paper_id);
CREATE INDEX idx_kg_nodes_type ON kg_nodes(type);
CREATE INDEX idx_kg_nodes_dom ON kg_nodes(dom_node_id);

-- Knowledge graph edges (relationships)
CREATE TABLE kg_edges (
    id VARCHAR(255) PRIMARY KEY,
    paper_id VARCHAR(64) REFERENCES papers(id) ON DELETE CASCADE,
    source_id VARCHAR(255) REFERENCES kg_nodes(id) ON DELETE CASCADE,
    target_id VARCHAR(255) REFERENCES kg_nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,  -- 'uses', 'depends_on', 'defines', 'mentions'
    evidence TEXT,                           -- Text snippet showing the relationship
    created_at TIMESTAMP DEFAULT NOW(),

    -- Prevent duplicate edges
    UNIQUE(source_id, target_id, relationship_type)
);

CREATE INDEX idx_kg_edges_paper ON kg_edges(paper_id);
CREATE INDEX idx_kg_edges_source ON kg_edges(source_id);
CREATE INDEX idx_kg_edges_target ON kg_edges(target_id);
CREATE INDEX idx_kg_edges_type ON kg_edges(relationship_type);
```

### SQLAlchemy Models

```python
# backend/app/database/models.py

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

class KGNode(Base):
    __tablename__ = "kg_nodes"

    id = Column(String(255), primary_key=True)
    paper_id = Column(String(64), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    subtype = Column(String(50), nullable=True)
    label = Column(String(500), nullable=False)
    data = Column(JSONB, nullable=False)
    dom_node_id = Column(String(128), nullable=True)
    section_id = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    paper = relationship("Paper", back_populates="kg_nodes")
    outgoing_edges = relationship("KGEdge", foreign_keys="KGEdge.source_id", back_populates="source_node")
    incoming_edges = relationship("KGEdge", foreign_keys="KGEdge.target_id", back_populates="target_node")

    __table_args__ = (
        Index("idx_kg_nodes_paper", "paper_id"),
        Index("idx_kg_nodes_type", "type"),
        Index("idx_kg_nodes_dom", "dom_node_id"),
    )

class KGEdge(Base):
    __tablename__ = "kg_edges"

    id = Column(String(255), primary_key=True)
    paper_id = Column(String(64), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(String(255), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(String(255), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(50), nullable=False)
    evidence = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    paper = relationship("Paper")
    source_node = relationship("KGNode", foreign_keys=[source_id], back_populates="outgoing_edges")
    target_node = relationship("KGNode", foreign_keys=[target_id], back_populates="incoming_edges")

    __table_args__ = (
        Index("idx_kg_edges_paper", "paper_id"),
        Index("idx_kg_edges_source", "source_id"),
        Index("idx_kg_edges_target", "target_id"),
        Index("idx_kg_edges_type", "relationship_type"),
    )

# Update Paper model
class Paper(Base):
    # ... existing fields ...
    kg_nodes = relationship("KGNode", back_populates="paper", cascade="all, delete-orphan")
```

### API Endpoints

```python
# backend/app/api/main.py

from backend.app.database.models import KGNode, KGEdge

@app.post("/api/papers/{paper_id}/build-knowledge-graph")
async def build_knowledge_graph(paper_id: str, db: Session = Depends(get_db)):
    """Trigger knowledge graph construction for a paper"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper or not paper.html_content:
        raise HTTPException(status_code=404, detail="Paper not found or not compiled")

    # Run LangGraph pipeline
    from backend.app.agents.knowledge_graph import build_kg_for_paper

    try:
        graph_data = build_kg_for_paper(paper.id, paper.html_content)

        # Store nodes
        for node_data in graph_data["nodes"]:
            node = KGNode(
                id=node_data["id"],
                paper_id=paper_id,
                type=node_data["type"],
                subtype=node_data.get("subtype"),
                label=node_data["label"],
                data=node_data,  # Store all fields as JSONB
                dom_node_id=node_data.get("dom_node_id"),
                section_id=node_data.get("section_id")
            )
            db.add(node)

        # Store edges
        for edge_data in graph_data["edges"]:
            edge = KGEdge(
                id=edge_data["id"],
                paper_id=paper_id,
                source_id=edge_data["source"],
                target_id=edge_data["target"],
                relationship_type=edge_data["type"],
                evidence=edge_data.get("evidence")
            )
            db.add(edge)

        db.commit()

        return {
            "status": "success",
            "node_count": len(graph_data["nodes"]),
            "edge_count": len(graph_data["edges"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph building failed: {str(e)}")


@app.get("/api/papers/{paper_id}/knowledge-graph")
async def get_knowledge_graph(paper_id: str, db: Session = Depends(get_db)):
    """Get the complete knowledge graph for a paper"""
    nodes = db.query(KGNode).filter(KGNode.paper_id == paper_id).all()
    edges = db.query(KGEdge).filter(KGEdge.paper_id == paper_id).all()

    return {
        "nodes": [
            {
                "id": n.id,
                "type": n.type,
                "subtype": n.subtype,
                "label": n.label,
                "dom_node_id": n.dom_node_id,
                **n.data  # Unpack JSONB data
            }
            for n in nodes
        ],
        "edges": [
            {
                "id": e.id,
                "source": e.source_id,
                "target": e.target_id,
                "type": e.relationship_type,
                "evidence": e.evidence
            }
            for e in edges
        ]
    }


@app.get("/api/papers/{paper_id}/knowledge-graph/node/{node_id}")
async def get_node_neighbors(paper_id: str, node_id: str, db: Session = Depends(get_db)):
    """Get a node and its immediate neighbors (for navigation)"""
    node = db.query(KGNode).filter(
        KGNode.paper_id == paper_id,
        KGNode.id == node_id
    ).first()

    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Get outgoing edges (what this node uses/mentions)
    outgoing = db.query(KGEdge).filter(KGEdge.source_id == node_id).all()
    # Get incoming edges (what uses/mentions this node)
    incoming = db.query(KGEdge).filter(KGEdge.target_id == node_id).all()

    return {
        "node": {
            "id": node.id,
            "type": node.type,
            "label": node.label,
            "dom_node_id": node.dom_node_id,
            **node.data
        },
        "outgoing": [
            {
                "target": e.target_id,
                "type": e.relationship_type,
                "evidence": e.evidence
            }
            for e in outgoing
        ],
        "incoming": [
            {
                "source": e.source_id,
                "type": e.relationship_type,
                "evidence": e.evidence
            }
            for e in incoming
        ]
    }


@app.delete("/api/papers/{paper_id}/knowledge-graph")
async def delete_knowledge_graph(paper_id: str, db: Session = Depends(get_db)):
    """Delete the knowledge graph for a paper (for rebuilding)"""
    db.query(KGEdge).filter(KGEdge.paper_id == paper_id).delete()
    db.query(KGNode).filter(KGNode.paper_id == paper_id).delete()
    db.commit()
    return {"status": "success"}
```

---

## Phase 3: Frontend Visualization

### React Flow Integration

**Install Dependencies**:
```bash
cd frontend
npm install reactflow
```

**Component Structure**:
```
frontend/components/reader/
├── KnowledgeGraphView.tsx    # Main graph visualization
├── GraphNode.tsx              # Custom node renderer
└── NavigationPanel.tsx        # Updated to toggle TOC/Graph
```

### KnowledgeGraphView Component

```tsx
// frontend/components/reader/KnowledgeGraphView.tsx

"use client";

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GraphNode } from './GraphNode';

const nodeTypes: NodeTypes = {
  symbol: GraphNode,
  definition: GraphNode,
  theorem: GraphNode,
  equation: GraphNode,
};

interface KnowledgeGraphViewProps {
  paperId: string;
  onNavigate: (domNodeId: string) => void;
}

export function KnowledgeGraphView({ paperId, onNavigate }: KnowledgeGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/papers/${paperId}/knowledge-graph`)
      .then(res => res.json())
      .then(data => {
        // Convert API format to React Flow format
        const flowNodes: Node[] = data.nodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          data: {
            label: n.label,
            ...n,
            onNavigate: () => onNavigate(n.dom_node_id)
          },
          position: { x: 0, y: 0 }, // Will be auto-layouted
        }));

        const flowEdges: Edge[] = data.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.type,
          type: 'smoothstep',
        }));

        // Auto-layout (simple grid for now, could use dagre later)
        const layouted = autoLayout(flowNodes, flowEdges);

        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [paperId, setNodes, setEdges, onNavigate]);

  if (loading) return <div className="p-4 text-sm text-slate-500">Loading graph...</div>;
  if (error) return <div className="p-4 text-sm text-red-600">Error: {error}</div>;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

// Simple grid layout (replace with dagre for hierarchical layout)
function autoLayout(nodes: Node[], edges: Edge[]): { nodes: Node[], edges: Edge[] } {
  const cols = Math.ceil(Math.sqrt(nodes.length));

  nodes.forEach((node, i) => {
    node.position = {
      x: (i % cols) * 250,
      y: Math.floor(i / cols) * 150
    };
  });

  return { nodes, edges };
}
```

### Custom Graph Node

```tsx
// frontend/components/reader/GraphNode.tsx

import { Handle, Position } from 'reactflow';
import { LatexText } from './LatexText';

export function GraphNode({ data }: { data: any }) {
  const colors = {
    symbol: 'bg-blue-50 border-blue-300',
    definition: 'bg-green-50 border-green-300',
    theorem: 'bg-purple-50 border-purple-300',
    equation: 'bg-amber-50 border-amber-300',
  };

  const color = colors[data.type as keyof typeof colors] || 'bg-slate-50 border-slate-300';

  return (
    <div
      className={`px-3 py-2 rounded-lg border-2 ${color} cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={data.onNavigate}
    >
      <Handle type="target" position={Position.Top} />

      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
        {data.type}
      </div>

      <LatexText text={data.label} className="text-sm font-medium" />

      {data.context && (
        <div className="text-xs text-slate-600 mt-1 max-w-[200px]">
          {data.context}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### Update NavigationPanel to Toggle Between TOC and Graph

```tsx
// frontend/components/reader/NavigationPanel.tsx

"use client";

import { useState } from 'react';
import { List, Network } from 'lucide-react';
import { TableOfContents } from './TableOfContents';
import { KnowledgeGraphView } from './KnowledgeGraphView';

interface NavigationPanelProps {
  paperId: string;
  toc: any[];
  onNavigate: (dataId: string) => void;
}

export default function NavigationPanel({ paperId, toc, onNavigate }: NavigationPanelProps) {
  const [mode, setMode] = useState<'toc' | 'graph'>('toc');

  return (
    <div className="h-full flex flex-col">
      {/* Toggle buttons */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setMode('toc')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
            mode === 'toc'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <List size={16} />
          Sections
        </button>
        <button
          onClick={() => setMode('graph')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
            mode === 'graph'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Network size={16} />
          Graph
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'toc' ? (
          <div className="h-full overflow-y-auto p-4">
            <TableOfContents toc={toc} onNavigate={onNavigate} />
          </div>
        ) : (
          <KnowledgeGraphView paperId={paperId} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}
```

---

## Implementation Timeline

### Phase 0: Compile-Time Metadata Extraction (2-3 days)
- Day 1: Implement `CompilationResult` dataclass and extraction functions
- Day 2: Update compiler, database schema, and API endpoints
- Day 3: Test with sample papers, update frontend to use pre-extracted data

### Phase 1: LangGraph Pipeline (5-6 days - Faster due to Phase 0!)
- Day 1: Set up LangGraph scaffold, implement data loader
- Day 2-3: Implement symbol + definition extraction agents
- Day 4: Implement theorem extraction (HTML + LaTeX source)
- Day 5: Implement dependency extraction agent
- Day 6: Implement graph builder + testing

### Phase 2: Storage & API (2-3 days)
- Day 7: Database migration (add kg_nodes, kg_edges tables)
- Day 8: Implement API endpoints
- Day 9: Test graph building pipeline end-to-end

### Phase 3: Frontend Visualization (3-4 days)
- Day 10: Install React Flow, create KnowledgeGraphView component
- Day 11: Implement custom node rendering
- Day 12: Update NavigationPanel with toggle
- Day 13: Polish + test navigation

### Total: ~13-16 days (including Phase 0 prep work)

---

## Testing Strategy

### Unit Tests
- [ ] Test section parsing on sample HTML
- [ ] Test symbol extraction with mock LLM responses
- [ ] Test definition extraction
- [ ] Test dependency resolution logic
- [ ] Test graph builder output format

### Integration Tests
- [ ] End-to-end: Paper HTML → Graph JSON
- [ ] Test with real arXiv papers (different domains)
- [ ] Test API endpoints (create, fetch, delete graph)

### Manual Testing
- [ ] Verify graph accuracy on known papers
- [ ] Test graph visualization performance (100+ nodes)
- [ ] Test navigation: click node → scroll to section

---

## Future Enhancements (Post-MVP)

### Advanced Features
- **Hierarchical Layout**: Use `dagre` for better graph organization
- **Graph Filtering**: Show only symbols, or only theorems, etc.
- **Search in Graph**: Find nodes by name/type
- **Subgraph Views**: Focus on theorem dependencies only
- **Interactive Exploration**: Click node → show immediate neighbors
- **Graph Export**: Export to GraphML, Cytoscape format

### Agent Improvements
- **Math Formula Parsing**: Extract individual terms from equations
- **Proof Structure**: Map proof steps to logical dependencies
- **Citation Linking**: Connect cited papers to claims
- **Semantic Clustering**: Group related concepts visually

---

## Open Questions

1. **LLM Costs**: Running Claude Sonnet on every section could be expensive
   - Solution: Cache results, only rebuild when paper changes
   - Alternative: Use Claude Haiku for simpler extractions

2. **Graph Layout**: Grid layout is simple but not semantic
   - Solution: Use `dagre` for hierarchical layout based on dependencies
   - Alternative: Force-directed layout (d3-force)

3. **Incremental Updates**: Should we support adding tooltips to the graph?
   - User-created tooltips could become nodes
   - Tooltips could link to existing graph concepts

4. **Multi-paper Graphs**: Should we connect graphs across papers?
   - e.g., "This theorem uses concept from [Paper B]"
   - Requires cross-paper entity resolution

---

## Success Criteria

### MVP Complete When:
- [x] Agent pipeline extracts symbols, definitions, theorems, dependencies
- [x] Graph stored in PostgreSQL (simplified: JSONB on Paper model)
- [x] API endpoint returns graph JSON
- [x] Frontend renders graph with React Flow
- [x] Clicking node navigates to corresponding section in paper
- [x] Toggle between TOC and Graph view works
- [x] **Bonus:** Real-time progress tracking via SSE
- [x] **Bonus:** Parallel extraction for faster builds
- [x] **Bonus:** LaTeX rendering in graph nodes

### Known Limitations (Acceptable for MVP):
- Simple grid layout (not hierarchical)
- No multi-paper connections
- No incremental updates (rebuild required)
- No graph filtering/search
- LLM extraction may miss edge cases
- SSE requires direct backend connection (bypasses Next.js proxy)

---

## Future Improvements

- [ ] Hierarchical layout using `dagre`
- [ ] Graph filtering by node type
- [ ] Search within graph
- [ ] Migrate to dedicated `kg_nodes` / `kg_edges` tables for better querying
- [ ] Support for figures and tables as node types
- [ ] Cross-paper entity linking
