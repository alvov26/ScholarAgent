#scholar_agent
## Outline

>Agent-enhanced paper reader, providing the user with a markdown document, eagerly enriched with tooltips, tree-like structure to navigate, RAG to answer questions.

## Features

Must:
- Automatic tooltips to terms and math symbols, persistent across the document, editable by the user
	- Symbol Glossary Agent: scan LaTeX blocks to build a "Project Glossary" with context-aware resolution (link back to definition source)
	- Shoud also be able to enhance / deepen or shorten the tooltip
- Logical Flow Map: Tree-like structure for the agent and the user to navigate the paper
	- Not just the headers/subheaders, but the actual logical narrative (Motivation → Core Hypothesis → Proof → Validation)
- Question answering with RAG based on the structure

Should:
- User can step in to edit the tooltips, or chat with the agent to enhance a tooltip
- User profile-dependent tooltip generation:
	- Considers user expertise (e.g. "ML Master Student") to prioritize/skip tooltips.
	- Supports manual customization: user can explicitly specify areas of expertise or ignorance.
- Reference Peeking: fetch abstracts/TLDRs of cited papers using Semantic Scholar API on hover.

Could:
- Deep Reference Peeking: analyze cited papers to show locally relevant fragments instead of just abstracts.

Won't:
- Writing papers yourself
- Math animations (e.g. Manim integration)


## Stages

1. Document Cracking
	- PDF-to-Markdown (LlamaParse primary; Marker or Docling as alternatives)
	- Structure Parsing (LlamaIndex), sectioning
2. Initial Prep
	1. Symbol resolution & Project Glossary extraction
	2. Tooltip generation (based on user profile & expertise overrides)
3. Serving
	- Frontend
		- Framework: Next.js
		- Markdown Renderer: `MDX`
			- Interactive tooltips using `Radix UI Popovers` or `Framer Motion`
		- Math Renderer: `KaTex`
	- Backend
		- Server: FastAPI
		- RAG Hierarchy: LlamaIndex (`PropertyGraphIndex` for Graph-RAG)
		- Database: `PostgreSQL` + `pgvector` or `LanceDB` for combined relational metadata and vector storage

