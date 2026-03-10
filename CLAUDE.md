# Scholar Agent

Interactive academic paper reader that compiles arXiv LaTeX sources into HTML5 with semantic annotations.

## Quick Start

```bash
# Backend (from project root)
uv run uvicorn backend.app.api.main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev

# Full stack with Electron
npm run dev:desktop
```

## Project Structure

```
ScholarAgent/
├── backend/
│   ├── app/
│   │   ├── api/main.py          # FastAPI endpoints
│   │   ├── agents/              # LangGraph pipelines (knowledge graph, tooltips)
│   │   ├── compiler/            # LaTeXML compilation + HTML injection
│   │   └── database/            # SQLAlchemy models (Paper, Tooltip)
│   └── alembic/                 # Database migrations
├── frontend/
│   ├── app/                     # Next.js pages
│   ├── components/reader/       # Paper viewer components
│   ├── hooks/                   # React hooks (useTooltips, etc.)
│   └── lib/colors.ts            # Design system constants
├── tests/                       # Backend pytest tests
└── storage/                     # Uploaded papers + compiled HTML
```

## Key Commands

| Task | Command |
|------|---------|
| Run backend | `uv run uvicorn backend.app.api.main:app --reload` |
| Run frontend | `cd frontend && npm run dev` |
| Run tests (backend) | `.venv/bin/pytest tests/` |
| Run tests (frontend) | `cd frontend && npm test` |
| Database migration | `cd backend && alembic upgrade head` |
| New migration | `cd backend && alembic revision -m "description"` |

## Architecture

### Data Flow
```
arXiv .tar.gz → LaTeXML (Docker) → HTML5 + MathML → PostgreSQL
                                         ↓
                              data-id injection
                                         ↓
                              Knowledge Graph extraction (LLM)
                                         ↓
                              Semantic tooltip injection
```

### Tech Stack
- **Backend**: FastAPI, PostgreSQL, SQLAlchemy, Alembic
- **Frontend**: Next.js, html-react-parser, MathJax 4, Framer Motion, React Flow
- **Agents**: LangGraph, Claude Sonnet (via langchain-anthropic)
- **Compilation**: LaTeXML via Docker (`latexml/ar5ivist`)

## Core Features

### 1. LaTeX Compilation
- Upload `.tar.gz` → compile to HTML5 with MathML
- Inject `data-id` attributes for tooltip anchoring
- Extract sections, equations, citations at compile time

### 2. Knowledge Graph
- LLM extracts symbols, definitions, theorems from paper
- Tracks occurrence positions for each entity
- Visualized with React Flow (left panel)

### 3. Semantic Tooltips
- Agent suggests tooltips based on user expertise level
- Injects `<span class="kg-entity">` at occurrence positions
- Tooltips persist across all occurrences of a term

### 4. Manual Annotations
- Users can add paragraph-level comments
- Tooltips anchored to `data-id` on blocks

## API Endpoints

### Papers
- `POST /api/papers/upload` - Upload and compile paper
- `GET /api/papers/{id}` - Get paper with HTML + metadata
- `POST /api/papers/{id}/compile` - Recompile paper

### Knowledge Graph
- `POST /api/papers/{id}/build-knowledge-graph` - Build KG (SSE progress)
- `GET /api/papers/{id}/knowledge-graph` - Get graph data

### Tooltips
- `GET /api/papers/{id}/tooltips` - List tooltips
- `POST /api/papers/{id}/tooltips` - Create tooltip
- `POST /api/papers/{id}/tooltips/suggest` - Suggest semantic tooltips
- `POST /api/papers/{id}/tooltips/apply` - Apply suggested tooltips

## Environment Variables

```bash
# .env (project root)
DATABASE_URL=postgresql://scholaragent:scholaragent@localhost/scholaragent
ANTHROPIC_API_KEY=sk-ant-...

# Optional - Knowledge Graph
KG_MAX_SECTIONS=5      # Limit sections for KG extraction (0 = all)
KG_DEBUG=1             # Enable KG extraction debug logs

# Optional - Debug Flags (set to "true" to enable)
HTML_INJECTION_DEBUG=true      # Debug HTML span injection agent
TOOLTIP_AGENT_DEBUG=true       # Debug tooltip suggestion agent
```

## Database

### Models
- **Paper**: id, filename, html_content, knowledge_graph (JSONB), sections_data, equations_data
- **Tooltip**: id, paper_id, entity_id (semantic) OR dom_node_id (paragraph), content

### Migrations
```bash
cd backend
alembic revision -m "add new column"
alembic upgrade head
```

## Testing

```bash
# Backend (56 tests)
.venv/bin/pytest tests/ -v

# Frontend (65 tests)
cd frontend && npm test

# With coverage
.venv/bin/pytest --cov=backend tests/
cd frontend && npm run test:coverage
```

## Documentation

| File | Purpose |
|------|---------|
| `Design Document.md` | Architecture overview |
| `SETUP.md` | Development environment setup |
| `TESTING.md` | Test strategy and guidelines |
| `AGENTS.md` | Custom slash commands |
| `KNOWLEDGE_GRAPH_SCAFFOLD.md` | KG pipeline architecture |
| `KNOWLEDGE_GRAPH_TODOS.md` | Current KG backlog |
| `frontend/lib/COLOR_PALETTE.md` | UI color guidelines |
| `frontend/DESIGN_SYSTEM.md` | Component patterns |

## Common Tasks

### Add a new API endpoint
1. Add route in `backend/app/api/main.py`
2. Add Pydantic models for request/response
3. Write tests in `tests/test_api.py`

### Add a frontend component
1. Create in `frontend/components/`
2. Use colors from `frontend/lib/colors.ts`
3. Write tests in `frontend/__tests__/`

### Modify database schema
1. Update model in `backend/app/database/models.py`
2. Create migration: `cd backend && alembic revision -m "description"`
3. Apply: `alembic upgrade head`

### Extend knowledge graph extraction
1. Update agents in `backend/app/agents/knowledge_graph.py`
2. Add Pydantic models for new entity types
3. Update `build_graph()` to convert to nodes
4. Update frontend `GraphNode.tsx` for styling

## Debugging

### Backend logs
```bash
# Enable debug mode
SCHOLAR_DEBUG=true uv run uvicorn backend.app.api.main:app --reload
```

### Database inspection
```bash
psql -U scholaragent -d scholaragent
\dt                    # List tables
SELECT * FROM papers;  # Query papers
```

### Frontend dev tools
- React DevTools for component tree
- Network tab for API calls
- Check SSE streams at `/api/papers/{id}/build-knowledge-graph/progress`
