# Scholar Agent - Project Context

Quick reference for Claude Code when working on this project.

---

## Project Overview

**Name**: Scholar Agent
**Purpose**: Interactive, web-based academic paper reader that compiles arXiv LaTeX sources into accessible HTML5 with node-level interactivity and persistent tooltips.

**Philosophy**: LaTeX-first, deterministic pipeline. No PDF parsing heuristics, no markdown intermediaries.

---

## Current State

- **Branch**: `rework`
- **Status**: Pre-MVP, major refactoring in progress
- **Last Updated**: 2026-02-24

### Technology Stack

**Backend**:
- Python 3.12+ (managed via `uv`)
- FastAPI
- PostgreSQL (to be added)
- LaTeXML (via Docker)

**Frontend**:
- Next.js 16.1.6
- React 19.2.4
- TypeScript
- Tailwind CSS

**Key Dependencies**:
- `mathjax-full` - Math rendering with semantic enrichment
- `framer-motion` - Tooltip animations
- `html-react-parser` - HTML to React component parsing (to be added)

---

## Architecture

### Pipeline Flow
```
arXiv .tar.gz → LaTeXML → HTML5 + MathML → Post-process (inject data-ids) → Store in DB → Serve to frontend → Interactive rendering
```

### Key Components

1. **LaTeXML Compiler** (`backend/app/compiler/`)
   - Unpacks archives, detects main .tex file
   - Runs LaTeXML via Docker (engrafo image)
   - Post-processes HTML to inject stable `data-id` attributes

2. **Database** (PostgreSQL)
   - `papers` table: paper metadata + compiled HTML
   - `tooltips` table: user annotations keyed by `(paper_id, dom_node_id)`

3. **FastAPI Backend** (`backend/app/api/main.py`)
   - Paper upload/compilation endpoints
   - Tooltip CRUD operations
   - CORS configured for localhost:3000

4. **Frontend Renderer** (`frontend/components/reader/`)
   - `HTMLRenderer`: Uses `html-react-parser` to intercept HTML tags
   - `MathJaxNode`: Renders MathML with semantic enrichment (SRE)
   - `InteractiveParagraph`: Clickable text nodes for tooltip creation

---

## Critical Design Decisions

### 1. Stable DOM IDs
All content nodes in compiled HTML must have deterministic `data-id` attributes:
```
data-id="sha256(paper_id + node_path)"
```
This ensures tooltips persist across re-compilations.

### 2. No Markdown
Direct HTML rendering via `html-react-parser` instead of markdown conversion. More reliable, less heuristics.

### 3. MathML Only
LaTeXML outputs MathML natively. MathJax consumes MathML for semantic enrichment (SRE), enabling precise symbol selection.

### 4. Single User (MVP)
No authentication for MVP. All tooltips use `user_id="default"`.

---

## Directory Structure

```
ScholarAgent/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routes
│   │   ├── compiler/      # LaTeXML integration (NEW)
│   │   ├── database/      # PostgreSQL models & connection (NEW)
│   │   └── parser/        # DEPRECATED - to be removed
│   └── alembic/           # Database migrations (NEW)
├── frontend/
│   ├── app/               # Next.js pages
│   ├── components/
│   │   └── reader/        # HTML renderer, MathJax, tooltips
│   └── hooks/             # useTooltips, etc.
├── storage/
│   ├── uploads/           # Original .tar.gz files
│   └── cache/             # DEPRECATED - will be removed
├── input/                 # Test papers
├── Design Document.md     # Requirements & architecture
├── REWORK_PLAN.md         # Detailed refactor roadmap
├── AGENTS.md              # Custom slash commands
├── TESTING.md             # Testing strategy
└── SETUP.md               # Environment setup guide
```

---

## Common Commands

### Development
```bash
# Backend only (from frontend/ dir, due to package.json scripts)
npm run dev:backend

# Frontend only
npm run dev

# Full stack (Next.js + FastAPI + Electron)
npm run dev:desktop
```

### Database (once PostgreSQL is set up)
```bash
# Create database
createdb scholaragent

# Run migrations
cd backend
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"
```

### Testing
```bash
# Backend tests
pytest tests/

# Frontend tests
cd frontend
npm test
```

---

## What's Being Removed (Phase 1 Cleanup)

### Backend
- `backend/app/parser/pdf_parser.py` - LlamaParse integration
- `backend/app/parser/tex_parser.py` - pypandoc markdown conversion
- `backend/app/parser/latex_structure_parser.py` - Old LaTeX parsing
- `backend/app/parser/math_extractor.py` - Replaced by LaTeXML MathML
- `backend/app/agents/glossary_agent.py` - Deferred to post-MVP
- `backend/app/database/vector_store.py` - Deferred to post-MVP

### Frontend
- `react-markdown` dependency
- `remark-math`, `rehype-mathjax`, `rehype-raw`, `remark-gfm` dependencies

### Python Dependencies
- `llama-index`, `llama-parse`, `pypandoc`, `pypandoc-binary`

---

## What's Being Added

### Backend
- `backend/app/compiler/latexml_compiler.py` - LaTeXML integration
- `backend/app/database/models.py` - SQLAlchemy models
- `backend/app/database/connection.py` - DB session management
- `backend/alembic/` - Migration framework
- Dependencies: `psycopg2-binary`, `sqlalchemy`, `alembic`

### Frontend
- `html-react-parser` dependency
- `frontend/components/reader/HTMLRenderer.tsx`
- `frontend/components/reader/MathJaxNode.tsx`
- `frontend/components/reader/InteractiveParagraph.tsx`
- `frontend/hooks/useTooltips.ts`

---

## Known Issues / TODOs

- [ ] LaTeXML Docker setup not yet implemented
- [ ] PostgreSQL not yet installed/configured
- [ ] Old parser code still present (pending cleanup)
- [ ] Frontend still uses react-markdown (pending refactor)
- [ ] No tests for new architecture yet

---

## Testing Strategy

### Unit Tests
- LaTeXML compilation (mock Docker calls)
- HTML post-processing (data-id injection)
- Database CRUD operations
- API endpoint responses

### Integration Tests
- Full pipeline: upload arXiv source → compile → store → retrieve
- Tooltip persistence: create → save → reload → verify

### Frontend Tests
- HTML parsing with `html-react-parser`
- MathJax SRE rendering
- Tooltip creation and display
- Symbol selection in formulas

---

## Sample Test Paper

Located at `input/2602.02383v2.pdf` (will need arXiv source instead for new pipeline).

---

## Useful Resources

- **LaTeXML Docs**: https://dlmf.nist.gov/LaTeXML/
- **Engrafo (LaTeXML Docker)**: https://github.com/arxiv-vanity/engrafo
- **MathJax SRE Docs**: https://docs.mathjax.org/en/latest/options/accessibility.html
- **html-react-parser**: https://github.com/remarkablemark/html-react-parser

---

## Notes for Claude Code

- Always check `Design Document.md` for requirements
- Refer to `REWORK_PLAN.md` for implementation phases
- Use `/latex-compile`, `/db-migrate`, etc. agents for specialized tasks
- Test changes incrementally (don't break existing functionality during refactor)
- Preserve `data-id` attributes in all HTML manipulations
