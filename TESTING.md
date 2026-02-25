# Testing Strategy

Comprehensive testing approach for Scholar Agent MVP.

---

## Test Pyramid

```
        /\
       /  \      E2E Integration Tests
      /----\
     /      \    API & Component Tests
    /--------\
   /          \  Unit Tests
  /____________\
```

---

## Unit Tests

### Backend (`tests/`)

#### LaTeXML Compiler (`tests/test_compiler.py`)
- [ ] Test archive extraction (.tar.gz, .zip)
- [ ] Test main .tex file detection heuristic
- [ ] Test LaTeXML command generation
- [ ] Test HTML post-processing (data-id injection)
- [ ] Test error handling for malformed LaTeX

**Run**: `pytest tests/test_compiler.py`

#### Database Models (`tests/test_models.py`)
- [ ] Test Paper model CRUD operations
- [ ] Test Tooltip model CRUD operations
- [ ] Test foreign key relationships
- [ ] Test unique constraints and indexes

**Run**: `pytest tests/test_models.py`

#### API Endpoints (`tests/test_api.py`)
- [ ] Test `POST /api/papers/upload` with valid/invalid files
- [ ] Test `GET /api/papers` listing
- [ ] Test `GET /api/papers/{paper_id}` retrieval
- [ ] Test `DELETE /api/papers/{paper_id}` deletion
- [ ] Test tooltip CRUD endpoints
- [ ] Test CORS headers
- [ ] Test error responses (404, 400, 500)

**Run**: `pytest tests/test_api.py`

---

### Frontend (`frontend/__tests__/`)

**Testing Stack**: Vitest + React Testing Library + jsdom

**Quick Start**:
```bash
cd frontend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Status**: ✅ Testing infrastructure set up with example tests

#### HTML Renderer (`frontend/__tests__/unit/HTMLRenderer.test.tsx`)
- [x] Test html-react-parser basic parsing
- [x] Test `<math>` tag interception
- [x] Test `<p>` tag interception with data-id
- [x] Test nested element handling
- [x] Test malformed HTML handling
- [x] Test list rendering
- [x] Test CSS classes

**Run**: `npm test -- HTMLRenderer.test.tsx`

#### Tooltips Hook (`frontend/__tests__/unit/useTooltips.test.ts`)
- [x] Test tooltip fetching from API
- [x] Test tooltip creation
- [x] Test tooltip update
- [x] Test tooltip deletion
- [x] Test error handling
- [x] Test tooltip map building
- [x] Test loading states

**Run**: `npm test -- useTooltips.test.ts`

#### MathJax Node (`frontend/__tests__/unit/MathJaxNode.test.tsx`)
- [ ] Test MathML rendering
- [ ] Test semantic enrichment (SRE) activation
- [ ] Test symbol selection events
- [ ] Test inline vs display math

**To Implement**

#### Interactive Node (`frontend/__tests__/unit/InteractiveNode.test.tsx`)
- [ ] Test tooltip display on click
- [ ] Test tooltip creation modal
- [ ] Test Framer Motion animations
- [ ] Test data-id attribute binding

**To Implement**

**See `frontend/TESTING.md` for detailed testing guide.**

---

## Integration Tests

### Backend Integration (`tests/integration/`)

#### Full Pipeline (`tests/integration/test_pipeline.py`)
- [ ] Upload arXiv .tar.gz → verify paper created in DB
- [ ] Compile LaTeX → verify HTML has data-ids
- [ ] Fetch compiled HTML → verify MathML present
- [ ] Create tooltip → verify persistence in DB
- [ ] Retrieve tooltips → verify correct mapping

**Run**: `pytest tests/integration/test_pipeline.py`

#### Database Migrations (`tests/integration/test_migrations.py`)
- [ ] Test upgrade from empty DB to latest schema
- [ ] Test downgrade and re-upgrade (idempotency)
- [ ] Test data preservation during migrations

**Run**: `pytest tests/integration/test_migrations.py`

---

### Frontend Integration (`frontend/__tests__/integration/`)

#### End-to-End User Flow (`frontend/__tests__/integration/e2e.test.tsx`)
- [ ] Upload paper via UI → verify success message
- [ ] View paper list → verify paper appears
- [ ] Click paper → verify HTML renders
- [ ] Click paragraph → create tooltip → verify tooltip displays
- [ ] Refresh page → verify tooltip persists

**Run**: `npm run test:e2e` (requires Playwright or similar)

---

## Manual Testing Checklist

### Core Workflow
- [ ] Upload sample arXiv source (e.g., `2401.12345.tar.gz`)
- [ ] Verify compilation completes without errors
- [ ] Inspect HTML output for data-id attributes
- [ ] Verify all math formulas render correctly
- [ ] Click on formula symbol → verify selection
- [ ] Click on paragraph → create tooltip
- [ ] Refresh page → verify tooltip reappears
- [ ] Delete paper → verify all related data removed

### Edge Cases
- [ ] Upload invalid .tar.gz (should error gracefully)
- [ ] Upload LaTeX with compilation errors (should report errors)
- [ ] Upload very large paper (>100 pages)
- [ ] Create tooltip on math symbol vs text paragraph
- [ ] Multiple tooltips on same paper
- [ ] Delete paper with existing tooltips

### Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)

---

## Test Data

### Sample Papers
Located in `tests/fixtures/`:
- `simple_paper.tex` - Minimal LaTeX document (1 page, 1 formula)
- `complex_paper.tar.gz` - Multi-file project with .bib, figures
- `arxiv_sample.tar.gz` - Real arXiv paper (e.g., 2401.12345)

### Database Fixtures
- `tests/fixtures/sample_papers.sql` - Pre-populated papers table
- `tests/fixtures/sample_tooltips.sql` - Pre-populated tooltips

---

## Performance Testing

### Compilation Time
- [ ] Measure LaTeXML compilation time for papers of varying sizes
  - Small (1-5 pages): Target <10s
  - Medium (10-30 pages): Target <30s
  - Large (50+ pages): Target <60s

### API Response Time
- [ ] `GET /api/papers/{paper_id}` - Target <100ms (cached HTML)
- [ ] `POST /api/papers/upload` - Target <30s (including compilation)
- [ ] `GET /api/papers/{paper_id}/tooltips` - Target <50ms

### Frontend Rendering
- [ ] Time to first render (TTR) - Target <1s
- [ ] MathJax rendering time - Target <500ms per page
- [ ] Tooltip animation smoothness - Target 60fps

---

## CI/CD Integration

### GitHub Actions (`.github/workflows/test.yml`)
```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: scholaragent_test
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v3
      - name: Install Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - name: Install uv
        run: pip install uv
      - name: Install dependencies
        run: uv sync
      - name: Run tests
        run: pytest tests/
        env:
          DATABASE_URL: postgresql://postgres:test@localhost/scholaragent_test

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run tests
        run: cd frontend && npm test
```

---

## Coverage Goals

- **Backend**: 80% line coverage minimum
- **Frontend**: 70% line coverage minimum (UI testing is harder)
- **Critical paths**: 100% coverage (LaTeXML compilation, tooltip persistence)

### Current Coverage

**Backend** (as of setup):
- LaTeXML Compiler: ~95% coverage
- Database Models: ~90% coverage
- API Endpoints: ~80% coverage

**Frontend** (as of setup):
- HTMLRenderer: 92% coverage
- useTooltips: 82% coverage
- Overall: ~17% (many components not yet tested)

**Check coverage**:
```bash
# Backend
.venv/bin/pytest --cov=backend --cov-report=html tests/
# Open htmlcov/index.html in browser

# Frontend
cd frontend && npm run test:coverage
# Open coverage/index.html in browser
```

---

## Test Naming Convention

- Unit tests: `test_<function_name>.py` or `<Component>.test.tsx`
- Integration tests: `test_<workflow_name>.py`
- E2E tests: `e2e_<feature_name>.test.tsx`

---

## TODO: Tests to Write

### High Priority
- [x] LaTeXML compiler unit tests ✅ (13 tests)
- [x] Database model tests ✅ (14 tests)
- [x] API endpoint tests ✅ (24 tests)
- [x] HTMLRenderer component tests ✅ (11 tests)
- [x] useTooltips hook tests ✅ (9 tests)

### Medium Priority
- [ ] MathJaxNode component tests
- [ ] InteractiveNode component tests
- [ ] Full pipeline integration test
- [ ] Frontend E2E test (Playwright)
- [ ] Performance benchmarks

### Low Priority
- [ ] Edge case handling (malformed inputs)
- [ ] Browser compatibility tests
- [ ] Load testing (concurrent uploads)

---

## Running All Tests

### Backend Tests (56 tests)
```bash
# Run all backend tests
.venv/bin/pytest tests/

# Run with coverage
.venv/bin/pytest --cov=backend --cov-report=html tests/

# Run specific test file
.venv/bin/pytest tests/test_api.py -v

# Run specific test
.venv/bin/pytest tests/test_api.py::TestRootEndpoint::test_root_returns_welcome_message -v
```

Coverage report will be in `htmlcov/index.html`

### Frontend Tests (20 tests)
```bash
cd frontend

# Run all frontend tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- __tests__/unit/HTMLRenderer.test.tsx
```

Coverage report will be in `frontend/coverage/index.html`

### Quick Command
```bash
# Run ALL tests (backend + frontend)
.venv/bin/pytest tests/ -q && cd frontend && npm test -- --run && cd ..
```
