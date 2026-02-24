# Project Agents

Custom agents for Scholar Agent development. Use these slash commands for specialized tasks.

---

## /latex-compile
**Purpose**: Compile LaTeX sources to HTML using LaTeXML.

**Tasks**:
- Analyze LaTeX source structure and identify main .tex file
- Run LaTeXML compilation (via Docker or direct command)
- Parse compilation errors and suggest fixes
- Validate HTML output structure
- Verify MathML generation for formulas
- Check for bibliography resolution (.bib/.bbl files)

**When to use**: When working on LaTeX → HTML compilation pipeline, debugging compilation errors, or validating output structure.

---

## /db-migrate
**Purpose**: Manage PostgreSQL database schema changes using Alembic.

**Tasks**:
- Create new Alembic migration files
- Review migration scripts for correctness
- Run upgrades/downgrades
- Inspect current schema state
- Troubleshoot migration errors
- Suggest optimal indexes and constraints

**When to use**: When modifying database schema (adding tables, columns, indexes), or troubleshooting migration issues.

---

## /test-integration
**Purpose**: Run and analyze end-to-end integration tests.

**Tasks**:
- Execute full workflow: upload → compile → display → tooltip
- Verify HTML structure and data-id attributes
- Test API endpoints (CRUD operations)
- Validate tooltip persistence in database
- Check frontend rendering (MathJax, html-react-parser)
- Generate test reports

**When to use**: After major changes to verify full system functionality, or when debugging cross-layer issues.

---

## /frontend-debug
**Purpose**: Debug frontend rendering and interaction issues.

**Tasks**:
- Analyze React component trees and state
- Debug html-react-parser parsing issues
- Troubleshoot MathJax SRE rendering
- Inspect tooltip positioning and animations (Framer Motion)
- Review DOM structure and data-id attributes
- Check event handlers and user interactions

**When to use**: When investigating frontend bugs, rendering issues, or interaction problems with tooltips/math.

---

## /api-design
**Purpose**: Review and refine FastAPI endpoint design.

**Tasks**:
- Ensure RESTful patterns and conventions
- Validate request/response schemas
- Check error handling and status codes
- Review CORS configuration
- Suggest performance optimizations
- Verify authentication/authorization (when added)

**When to use**: When designing new endpoints, refactoring existing API, or reviewing API architecture.

---

## /docker-setup
**Purpose**: Manage Docker containers for LaTeXML compilation.

**Tasks**:
- Configure LaTeXML Docker image (engrafo or official)
- Set up volume mounts for source files
- Debug container execution issues
- Optimize container performance
- Review Docker Compose configuration
- Troubleshoot permission issues

**When to use**: When setting up LaTeXML environment, debugging container issues, or optimizing compilation performance.

---

## /cleanup-code
**Purpose**: Remove obsolete code during the rework phase.

**Tasks**:
- Identify and remove unused imports
- Delete deprecated parser files (PDF, markdown)
- Clean up obsolete API endpoints
- Remove unused dependencies from pyproject.toml and package.json
- Update import statements after deletions
- Verify no broken references remain

**When to use**: During Phase 1 of rework (cleanup), or periodic maintenance to remove dead code.
