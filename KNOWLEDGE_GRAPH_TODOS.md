# Knowledge Graph Polish Tasks

## High Priority

### Extraction Quality
- [ ] **Better context for dependency extraction** - Include symbol/theorem/definition summaries (not just names) when extracting relationships. Currently only passes entity names to the dependency agent.
- [ ] **Source text quotes** - Store direct quotes from LaTeX source to locate entities in original text
  - [ ] Add `source_quote` field to Symbol/Definition/Theorem models
- [ ] **Sub-paragraph entity spans** - Inject `<span>` tags around entity mentions within paragraphs
  - Currently the finest granularity is paragraph-level (`data-id` on `<p>`)
  - Goal: wrap individual mentions (e.g., "Theorem 3.2", "α_t") in hoverable spans linked to KG nodes
  - Challenges:
    - Fuzzy text matching ("Theorem 3.2" vs "Thm. 3.2" vs "the theorem")
    - LaTeX symbol variations in rendered HTML vs source
    - Preserving existing HTML structure (MathML, nested tags)
    - Avoiding false positives (e.g., "L" as symbol vs "L" in "Loss")
  - Approach: Agent takes (paragraph HTML + KG entities) → returns character spans for injection
  - Could run as post-processing step after graph build, or on-demand per section
- [ ] **Formula/equation entity type** - Add support for named formulas (e.g., "KTO loss", "ELBO") as a distinct node type
  - Could be a subtype of definition, or a new type that links to its component symbols

### Frontend UX
- [ ] **Relationship evidence display** - Show `evidence_text` from relationship metadata
  - Options: hover tooltip on edges, edge click panel, or info panel when edge selected
- [ ] **Auto-generate tooltip drafts** - For important terms, pre-populate tooltip content from KG data
  - Could trigger after graph build: "Generate tooltips for key concepts?"

## Medium Priority

### User Interaction
- [ ] **User-added definitions** - Allow users to manually add entities to the knowledge graph
  - "Add to Knowledge Graph" context menu on selected text
  - Triggers incremental extraction for that selection
  - Focuses/highlights the new node after addition
- [ ] **Graph filtering** - Filter nodes by type (show only theorems, hide symbols, etc.)
- [ ] **Search within graph** - Find nodes by name/content

### Extraction Improvements
- [ ] **Symbol scoping** - Track symbol scope to handle reused notation
  - Same symbol may mean different things in different sections
  - Consider `scope_section_id` or `valid_from`/`valid_to` section ranges
  - May be complex - could defer to post-MVP
- [ ] **Deduplication improvements** - Current dedup is by lowercase name only
  - Consider semantic similarity for near-duplicates
  - Handle LaTeX variations (e.g., `\alpha` vs `α`)

## Low Priority / Future

### Layout & Visualization
- [ ] **Hierarchical layout** - Use dagre for dependency-based positioning
- [ ] **Subgraph views** - Focus on specific theorem and its dependencies
- [ ] **Edge bundling** - Reduce visual clutter for dense graphs

### Integration
- [ ] **Cross-paper linking** - Connect entities across different papers
- [ ] **Citation integration** - Link KG nodes to cited papers via Semantic Scholar

---

## Technical Debt
- [ ] Edge validation in `build_graph` only skips when *both* nodes missing (line 684) - should skip if *either* is missing
- [ ] Consider migrating from JSONB to dedicated `kg_nodes`/`kg_edges` tables for better querying
- [ ] Add caching for LLM calls to avoid re-extraction on rebuild