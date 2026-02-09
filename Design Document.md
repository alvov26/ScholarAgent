#scholar_agent
## Outline

>Agent-enhanced paper reader, providing the user with a markdown document, eagerly enriched with tooltips, tree-like structure to navigate, RAG to answer questions.

## Features

Must:
- Automatic tooltips to terms and math symbols, persistent across the document, editable by the user
	- Shoud also be able to enhance / deepen or shorten the tooltip
- Tree-like structure for the agent and the user to navigate the paper
	- Not just the headers/subheaders, but the actual narrative of the paper
- Question answering with RAG based on the structure

Should:
- User can step in to edit the tooltips, or chat with the agent to enhance a tooltip
- User profile-dependent tooltip generation (when agent is tasked with initial processing of the document, considers user expertise to prioritize making tooltips for terms they may find difficult, skipping the rest)

Could:
- `3b1b/manim` to animate harder math derivations
- Attach references, locally relevant snippets from papers linked in the bibliography

Won't:
- Writing papers yourself


## Stages

1. Document Cracking
	- PDF-to-Markdown (MathPix API)
	- Structure Parsing (LlamaIndex), sectioning
2. Initial Prep
	1. Symbol resolution
	2. Tooltip generation (based on user profile - how competent in the field, what needs explanation)
3. Serving
	- Frontend
		- Framework: Next.js
		- Markdown Renderer: `react-markdown` or `MDX`
			- `rehype-remark` for interactive tooltip injection
		- Math Renderer: `KaTex`
	- Backend
		- Server: FastAPI
		- RAG Hierarchy: LlamaIndex
		- Database: small local vector store + postgres or other DB for metadata (e.g. user edits to definitions)

