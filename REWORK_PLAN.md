# Scholar Agent MVP Rework Plan

## Overview
Complete pivot from PDF-markdown-heuristic pipeline to LaTeX-first HTML5 compilation with node-level interactivity.

---

## Phase 1: Cleanup (Remove Obsolete Code)

### Backend Removals
- ❌ `backend/app/parser/pdf_parser.py` - Remove LlamaParse integration
- ❌ `backend/app/parser/tex_parser.py` - Remove pypandoc markdown conversion
- ❌ `backend/app/parser/latex_structure_parser.py` - Remove (replaced by LaTeXML)
- ❌ `backend/app/parser/math_extractor.py` - Remove (MathML from LaTeXML)
- ❌ `backend/app/agents/glossary_agent.py` - Defer to post-MVP
- ❌ `backend/app/database/vector_store.py` - Defer to post-MVP
- ⚠️ `backend/app/api/main.py` - Heavy refactoring needed (see Phase 2)

### Frontend Removals
- ❌ Remove `react-markdown` dependency
- ❌ Remove `remark-math` dependency
- ❌ Remove `rehype-mathjax` dependency
- ❌ Remove `rehype-raw` dependency
- ❌ Remove `remark-gfm` dependency
- ⚠️ Refactor components to use `html-react-parser` instead

### Dependency Cleanup
- **Python** (`pyproject.toml`):
  - Remove: `llama-index`, `llama-parse`, `pypandoc`, `pypandoc-binary`
  - Keep: `fastapi`, `uvicorn`, `python-multipart`, `httpx`, `python-dotenv`
  - Add: `psycopg2-binary` (PostgreSQL), `sqlalchemy`, `alembic` (migrations)

- **Node** (`package.json`):
  - Remove: `react-markdown`, `remark-math`, `rehype-mathjax`, `rehype-raw`, `remark-gfm`
  - Keep: `mathjax-full`, `framer-motion`, `lucide-react`, `clsx`, `tailwind-merge`
  - Add: `html-react-parser`

---

## Phase 2: New Backend Architecture

### 2.1: LaTeXML Compilation Service
**File**: `backend/app/compiler/latexml_compiler.py`

**Responsibilities**:
- Unpack `.tar.gz` archives
- Detect main `.tex` file (smart heuristic: documentclass, begin{document})
- Run LaTeXML via Docker (engrafo image)
- Parse HTML5 output
- **Post-process**: Inject stable `data-id` attributes to all content nodes
  - Hash-based IDs: `data-id="sha256(paper_id + node_path)"`
  - Apply to: `<p>`, `<section>`, `<math>`, `<span>`, headings, etc.

**Docker Integration**:
```python
import docker
import subprocess

def compile_latex_to_html(source_dir: Path, output_dir: Path):
    # Option 1: Use arxiv-vanity/engrafo Docker image
    # Option 2: Use official latexml Docker image
    # Run: latexml --dest=output.xml main.tex
    #      latexmlpost --dest=output.html output.xml --format=html5
```

### 2.2: Database Schema (PostgreSQL)
**File**: `backend/app/database/models.py`

```python
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Paper(Base):
    __tablename__ = "papers"
    id = Column(String, primary_key=True)  # SHA256 hash
    filename = Column(String)
    arxiv_id = Column(String, nullable=True)
    html_content = Column(Text)  # Compiled HTML
    uploaded_at = Column(DateTime)
    tooltips = relationship("Tooltip", back_populates="paper")

class Tooltip(Base):
    __tablename__ = "tooltips"
    id = Column(String, primary_key=True)
    paper_id = Column(String, ForeignKey("papers.id"))
    dom_node_id = Column(String)  # The data-id from HTML
    user_id = Column(String, default="default")  # MVP: single user
    content = Column(Text)
    created_at = Column(DateTime)
    paper = relationship("Paper", back_populates="tooltips")

__table_args__ = (
    Index("idx_paper_node", "paper_id", "dom_node_id"),
)
```

**File**: `backend/app/database/connection.py`
- Setup SQLAlchemy engine, session management
- Alembic for migrations

### 2.3: Refactored API Endpoints
**File**: `backend/app/api/main.py`

**New Endpoints**:
```python
# Paper Management
POST   /api/papers/upload        # Upload .tar.gz, compile to HTML, store
GET    /api/papers               # List all papers
GET    /api/papers/{paper_id}    # Get compiled HTML + metadata
DELETE /api/papers/{paper_id}    # Delete paper + tooltips

# Tooltip Management
GET    /api/papers/{paper_id}/tooltips               # Get all tooltips for paper
POST   /api/papers/{paper_id}/tooltips               # Create tooltip
PUT    /api/papers/{paper_id}/tooltips/{tooltip_id}  # Update tooltip
DELETE /api/papers/{paper_id}/tooltips/{tooltip_id}  # Delete tooltip

# arXiv Integration (optional for MVP)
POST   /api/papers/upload/arxiv  # Download arXiv source, compile
```

**Remove Old Endpoints**:
- `/paper/{paper_id}/markdown` (no more markdown)
- `/paper/{paper_id}/latex` (no more structured JSON)
- `/paper/{paper_id}/content` (no more PDF items)

---

## Phase 3: New Frontend Architecture

### 3.1: Install Dependencies
```bash
cd frontend
npm install html-react-parser
npm uninstall react-markdown remark-math rehype-mathjax rehype-raw remark-gfm
```

### 3.2: Core Components

**File**: `frontend/components/reader/HTMLRenderer.tsx`
```tsx
import parse, { Element, domToReact } from 'html-react-parser';
import { MathJaxNode } from './MathJaxNode';
import { InteractiveParagraph } from './InteractiveParagraph';

export function HTMLRenderer({ html }: { html: string }) {
  return parse(html, {
    replace: (node) => {
      if (node instanceof Element) {
        // Intercept <math> tags for MathJax SRE
        if (node.name === 'math') {
          return <MathJaxNode mathml={node} />;
        }

        // Intercept <p> tags for tooltip anchoring
        if (node.name === 'p' && node.attribs['data-id']) {
          return (
            <InteractiveParagraph dataId={node.attribs['data-id']}>
              {domToReact(node.children)}
            </InteractiveParagraph>
          );
        }
      }
    }
  });
}
```

**File**: `frontend/components/reader/MathJaxNode.tsx`
```tsx
import { useEffect, useRef } from 'react';
import { mathjax } from 'mathjax-full/js/mathjax';
import { MathML } from 'mathjax-full/js/input/mathml';
import { SVG } from 'mathjax-full/js/output/svg';

export function MathJaxNode({ mathml }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize MathJax with SRE
    const mjx = mathjax.document(document, {
      InputJax: new MathML(),
      OutputJax: new SVG({ fontCache: 'local' }),
      enrichSpeech: 'deep',  // Enable semantic enrichment
    });

    // Render MathML to SVG with SRE
    // Make nodes clickable for symbol selection
  }, [mathml]);

  return <div ref={containerRef} className="math-node" />;
}
```

**File**: `frontend/components/reader/InteractiveParagraph.tsx`
```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTooltips } from '@/hooks/useTooltips';

export function InteractiveParagraph({ dataId, children }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { tooltips, createTooltip } = useTooltips();

  const tooltip = tooltips[dataId];

  return (
    <p
      data-id={dataId}
      onClick={() => setShowTooltip(!showTooltip)}
      className="relative cursor-pointer hover:bg-yellow-50"
    >
      {children}
      <AnimatePresence>
        {showTooltip && tooltip && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-10 bg-white shadow-lg rounded p-2"
          >
            {tooltip.content}
          </motion.div>
        )}
      </AnimatePresence>
    </p>
  );
}
```

### 3.3: Hooks

**File**: `frontend/hooks/useTooltips.ts`
```tsx
import { useState, useEffect } from 'react';

export function useTooltips(paperId: string) {
  const [tooltips, setTooltips] = useState<Record<string, Tooltip>>({});

  useEffect(() => {
    // Fetch tooltips from API
    fetch(`/api/papers/${paperId}/tooltips`)
      .then(res => res.json())
      .then(data => {
        const map = {};
        data.forEach(t => map[t.dom_node_id] = t);
        setTooltips(map);
      });
  }, [paperId]);

  const createTooltip = async (domNodeId: string, content: string) => {
    const res = await fetch(`/api/papers/${paperId}/tooltips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dom_node_id: domNodeId, content }),
    });
    const newTooltip = await res.json();
    setTooltips(prev => ({ ...prev, [domNodeId]: newTooltip }));
  };

  return { tooltips, createTooltip };
}
```

---

## Phase 4: Testing Strategy

### 4.1: Backend Tests
- LaTeXML compilation with sample arXiv papers
- HTML post-processing (data-id injection)
- API CRUD operations for tooltips
- Database migrations

### 4.2: Frontend Tests
- HTML parsing with `html-react-parser`
- MathJax SRE rendering
- Tooltip creation/display
- Selection of math symbols

### 4.3: Integration Tests
- End-to-end: Upload arXiv source → Compile → Display → Create tooltip → Persist

---

## Phase 5: Migration Path

### For Existing Data
If you have cached papers, you'll need to:
1. Keep old upload files in `storage/uploads/`
2. Re-compile them through LaTeXML pipeline
3. Discard old markdown/JSON caches

### Database Setup
```bash
# Install PostgreSQL
sudo pacman -S postgresql  # For Arch Linux

# Initialize database
sudo -u postgres initdb -D /var/lib/postgres/data
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb scholaragent

# Run migrations
cd backend
alembic init alembic
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

---

## Implementation Order

1. ✅ Update Design Document
2. ✅ Create this rework plan
3. ⬜ Phase 1: Cleanup obsolete code
4. ⬜ Phase 2: Backend rework
   - Install PostgreSQL, setup SQLAlchemy
   - Implement LaTeXML compiler
   - Refactor API endpoints
5. ⬜ Phase 3: Frontend rework
   - Install `html-react-parser`
   - Implement HTMLRenderer + MathJax components
   - Build tooltip UI
6. ⬜ Phase 4: Testing
7. ⬜ Phase 5: Documentation update

---

## Risk Assessment

### High Risk
- **LaTeXML Docker integration**: May need debugging for arxiv-specific packages
- **MathJax SRE**: Complex API, may need trial/error for symbol selection
- **DOM ID stability**: Hash-based IDs must be deterministic across re-compilations

### Medium Risk
- **PostgreSQL setup**: Local dev environment setup
- **Frontend refactor**: Large change from markdown to HTML parsing

### Low Risk
- **Dependency removal**: Straightforward cleanup
- **API design**: Similar to existing structure

---

## Success Criteria

- ✅ Can upload arXiv `.tar.gz` and compile to HTML5
- ✅ HTML contains stable `data-id` attributes on all content nodes
- ✅ Frontend renders HTML with interactive math (MathJax SRE)
- ✅ Can click on paragraph/math symbol to create tooltip
- ✅ Tooltips persist in PostgreSQL and reload on page refresh
- ✅ No PDF parsing, no markdown conversion, no heuristics

---

## Timeline Estimate

- **Phase 1 (Cleanup)**: 1-2 hours
- **Phase 2 (Backend)**: 6-8 hours
- **Phase 3 (Frontend)**: 6-8 hours
- **Phase 4 (Testing)**: 3-4 hours
- **Phase 5 (Documentation)**: 1-2 hours

**Total**: ~20-24 hours of focused work
