# IDE-Style Layout Implementation Plan

## Overview
Transform the current single-panel paper reader into a three-panel IDE-style interface:
- **Left Panel**: Navigation (Table of Contents)
- **Middle Panel**: Paper content (existing)
- **Right Panel**: Tooltip management

---

## Current State

### What We Have
- Single-panel paper reader with inline content
- Block-level tooltip annotations (keyed to `data-id` attributes)
- Tooltip creation modal with two fields:
  - "What are we annotating" (selected text)
  - Annotation content
- Visual indicators:
  - Blue left border for blocks with tooltips
  - Highlight on hover/selection
- Backend: Paper and Tooltip models with CRUD operations

### What's Missing
- Three-panel layout structure
- Table of contents navigation
- Dedicated tooltip list/management panel
- Fuzzy text highlighting within blocks
- Tooltip prioritization/pinning system

---

## Implementation Phases

### Phase 1: Layout Restructure
**Goal**: Establish three-panel foundation

#### Tasks
- [ ] Create main layout component with three panels
- [ ] Implement resizable panels with drag handles
  - Use library like `react-resizable-panels` or `allotment`
  - Support collapse/expand for left and right panels
  - Persist panel widths and collapsed state to localStorage
- [ ] Add panel visibility toggle buttons (hide/show sidebars)
- [ ] Apply JetBrains "islands" styling (card-like sections with spacing)
- [ ] Update PaperLoader to use new layout
- [ ] Migrate existing paper content to middle panel

#### Technical Implementation
- **Panel Library**: Use `react-resizable-panels` (good TypeScript support, maintained)
- **LocalStorage Keys**:
  - `reader-left-panel-width`
  - `reader-right-panel-width`
  - `reader-left-panel-collapsed`
  - `reader-right-panel-collapsed`
- **Styling**: Tailwind with custom classes for "islands" theme
- **Desktop-only**: No responsive breakpoints needed

#### Files to Modify
- `frontend/components/reader/PaperLoader.tsx` - Main layout container
- New file: `frontend/components/reader/Layout.tsx` or similar
- CSS updates for panel styling

---

### Phase 2: Left Panel - Table of Contents

#### Goal
Display hierarchical document structure from LaTeX sections, enable navigation.

#### Tasks
- [ ] Extract section structure from document
- [ ] Render collapsible tree component
- [ ] Implement click-to-scroll navigation with brief highlight/flash effect
- [ ] Highlight current section based on scroll position
- [ ] Handle edge cases (no sections → show "No table of contents available")

#### Section Extraction Strategy

**Option A: Parse LaTeX Source**
- Extract `\section{}`, `\subsection{}`, etc. before compilation
- Store in database as structured JSON
- **Pros**: Accurate, matches author's intent
- **Cons**: Requires parsing LaTeX, handling edge cases

**Option B: Parse Compiled HTML**
- Extract `<h1>`, `<h2>`, etc. from compiled output
- Generate TOC on frontend
- **Pros**: Simpler, works with what user sees
- **Cons**: Depends on LaTeXML output format

**Option C: LaTeXML TOC Feature**
- LaTeXML might have built-in TOC generation
- Check if `--navigationtoc` flag or similar exists
- **Pros**: Leverage existing tool
- **Cons**: Need to verify capability

**Recommended**: Start with **Option B** (parse HTML) for MVP simplicity.

#### Data Structure
```typescript
interface TOCNode {
  id: string          // Link to data-id in HTML
  title: string       // Section title
  level: number       // 1=section, 2=subsection, etc.
  children: TOCNode[] // Nested sections
}
```

#### UI Components
- Collapsible tree (use existing library or custom?)
- Current section indicator (bold, highlighted)
- Scroll-to-section smooth scrolling

#### Files to Create/Modify
- New: `frontend/components/reader/TableOfContents.tsx`
- New: `frontend/utils/parseTOC.ts` (extraction logic)
- Modify: `frontend/components/reader/PaperLoader.tsx` (integrate TOC)

---

### Phase 3: Right Panel - Tooltip List

#### Goal
Display all tooltips for current paper with smart prioritization and management.

#### Tasks
- [ ] Create tooltip list component with section grouping
- [ ] Implement grouping strategy pattern (allow swapping between section/flat/etc.)
- [ ] Add expand/collapse for individual tooltips
- [ ] Implement pinning functionality
- [ ] Add tooltip CRUD from panel (edit/delete)
- [ ] Handle empty state ("No tooltips yet" message)

#### Tooltip Display Logic

**Grouping Strategy** (Strategy Pattern)
- Default: Group by section
- Interface allows switching to: flat list, by date, by tag (future)
- Strategy defined in separate class/module for easy swapping

**Prioritization Rules** (within each section)
1. Pinned tooltips at top (always expanded)
2. Unpinned tooltips below (all collapsed initially)
3. User can manually reorder within sections (stored in `display_order`)

**Visual States**
- Pinned: Pin icon, always expanded
- Collapsed: Shows only "selected text" + short preview
- Expanded: Shows full content with edit/delete actions
- Card-style with spacing (JetBrains islands theme)

#### Database Schema Updates

**Current Tooltip Model**
```python
class Tooltip(Base):
    id: int
    paper_id: str
    node_id: str
    content_text: str
    content_type: str  # 'text' or 'latex'
    created_at: datetime
    updated_at: datetime
```

**Proposed Additions**
```python
class Tooltip(Base):
    # ... existing fields ...
    selected_text: str = None      # The text being annotated (fuzzy match target)
    is_pinned: bool = False        # User-pinned tooltip
    display_order: int = None      # Custom user ordering (nullable)
```

**Migration Required**: Yes, add new columns.

#### UI Components
- Tooltip card (collapsed state)
- Tooltip detail (expanded state)
- Pin button
- Edit/delete actions
- Group headers (if grouping by section)

#### Files to Create/Modify
- New: `frontend/components/reader/TooltipPanel.tsx`
- New: `frontend/components/reader/TooltipCard.tsx`
- Modify: `backend/app/database/models.py` (schema changes)
- New: Alembic migration for schema updates
- Modify: `frontend/hooks/useTooltips.ts` (support new fields)

---

### Phase 4: Fuzzy Text Highlighting

#### Goal
Highlight the specific text within a block that the tooltip refers to.

#### Tasks
- [ ] Implement fuzzy text search within HTML blocks
- [ ] Add CSS for highlighted terms
- [ ] Handle multiple overlapping highlights
- [ ] Update InteractiveNode to show highlights
- [ ] Handle edge cases (text not found, special characters)

#### Highlighting Strategy

**Approach**: Client-side text matching and DOM manipulation

1. When rendering a block with tooltips:
   - For each tooltip, check if `selected_text` exists
   - Search for text within the block's innerHTML
   - Wrap matches in `<mark>` or `<span class="highlight">`

2. Handle overlapping highlights:
   - Multiple tooltips might reference text in same block
   - Use different colors or combine highlights

3. Fuzzy matching:
   - Exact match first
   - If not found, try case-insensitive
   - If still not found, try word boundaries
   - If all fail, don't highlight (just show block border)

#### Implementation Options

**Option A: Mark.js Library**
- Use `mark.js` for highlighting
- Handles multiple instances, case sensitivity, etc.
- **Pros**: Battle-tested, feature-rich
- **Cons**: Another dependency

**Option B: Custom Implementation**
- Write own text search and `<mark>` insertion
- **Pros**: Full control, no dependency
- **Cons**: More code to maintain, edge cases

**Recommended**: **Option A** (mark.js) for robustness.

#### Visual Design
```css
/* Example styling */
.tooltip-highlight {
  background-color: rgba(59, 130, 246, 0.2); /* Light blue */
  border-bottom: 2px solid rgb(59, 130, 246);
  cursor: pointer;
}

.tooltip-highlight.pinned {
  background-color: rgba(245, 158, 11, 0.2); /* Amber for pinned */
}
```

#### Files to Create/Modify
- Modify: `frontend/components/reader/InteractiveNode.tsx`
- New: `frontend/utils/highlightText.ts`
- Update: CSS for highlight styles

---

## Database Schema Changes

### Tooltip Table Updates

```sql
-- Migration: Add columns for tooltip enhancements

ALTER TABLE tooltips ADD COLUMN selected_text VARCHAR(500);
ALTER TABLE tooltips ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE tooltips ADD COLUMN display_order INTEGER;

-- Index for performance
CREATE INDEX idx_tooltips_pinned ON tooltips(is_pinned);
CREATE INDEX idx_tooltips_order ON tooltips(display_order);
```

### API Updates Required

**Update Tooltip Endpoints**
- `POST /api/papers/{paper_id}/tooltips` - Accept new fields
- `PUT /api/papers/{paper_id}/tooltips/{tooltip_id}` - Support updating pin status
- `GET /api/papers/{paper_id}/tooltips` - Return new fields

No breaking changes if new fields are optional.

---

## Technical Decisions Summary

### All Decisions Finalized
1. ✅ Three-panel layout (left: TOC, middle: paper, right: tooltips)
2. ✅ Option B for tooltip panel (list with section grouping)
3. ✅ Hybrid approach for selection (block + fuzzy text)
4. ✅ Parse HTML for TOC (Option B)
5. ✅ Use mark.js for text highlighting
6. ✅ **Resizable panels** with collapse/expand functionality (IDE-style)
7. ✅ **Desktop-only** - no mobile/tablet support needed for MVP
8. ✅ **Panel visibility toggles** - users can hide/show left and right panels
9. ✅ **Tooltip grouping** by section with strategy pattern for flexibility
10. ✅ **Visual style**: JetBrains "islands" theme (card-like sections with spacing)
11. ✅ **Panel state persistence**: Save to localStorage (widths, collapsed state)
12. ✅ **TOC interaction**: Scroll + brief highlight/flash on section click
13. ✅ **Tooltip display**: Section-based, ordered by user preference (pinned first)
14. ✅ **Initial tooltip state**: All collapsed except pinned ones
15. ✅ **Empty states**: Show helpful messages ("No tooltips yet", "No table of contents available")

---

## Implementation Order

### Recommended Sequence
1. **Phase 1**: Layout restructure (foundation)
2. **Phase 2**: Left panel TOC (straightforward, clear requirements)
3. **Phase 3**: Right panel tooltip list (most complex)
4. **Phase 4**: Fuzzy text highlighting (enhancement on top)

### Reasoning
- Layout first provides structure for everything else
- TOC is independent and easier to implement
- Tooltip panel is most complex, benefits from seeing full layout
- Highlighting is polish, can be done last

---

## Testing Strategy

### Unit Tests Needed
- [ ] TOC parsing from HTML
- [ ] Tooltip relevance detection
- [ ] Text highlighting with various edge cases
- [ ] Panel resize behavior

### Integration Tests
- [ ] Navigate via TOC → scroll to section
- [ ] Create tooltip → appears in right panel
- [ ] Pin tooltip → stays at top
- [ ] Scroll paper → tooltips highlight/unhighlight

### Manual Testing
- [ ] Responsive layout on different screen sizes
- [ ] Performance with long papers (100+ pages)
- [ ] Performance with many tooltips (100+)
- [ ] Highlighting with special characters, LaTeX, etc.

---

## Future Enhancements (Post-MVP)

### Knowledge Graph Tab
- Agent-generated concept relationships
- Visual graph view (D3.js, Cytoscape.js?)
- Switch between TOC and graph view

### Tooltip Linking
- Links between related tooltips
- "See also" references
- Graph of tooltip relationships

### Advanced Selection
- Precise character-offset selection (Approach 1 from discussion)
- LaTeXML enhancement for granular `data-id` (Approach 2)
- Multi-block selections

### Collaborative Features
- Share tooltips between users
- Comments on tooltips
- Version history

---

## Open Questions

1. **Performance**: How do we handle papers with 1000+ tooltips?
   - Virtualized list for tooltip panel?
   - Pagination or infinite scroll?

2. **Data Model**: Should tooltip links be first-class?
   - Add `tooltip_links` table now or later?
   - Schema: `{from_tooltip_id, to_tooltip_id, relationship_type}`

3. **Export/Import**: Should users be able to export their annotations?
   - JSON export of all tooltips?
   - Markdown export with inline annotations?

4. **Search**: Do we need search within tooltips?
   - Filter tooltip list by text?
   - Highlight matching tooltips?

---

## Timeline Estimate

*(Rough estimates, adjust based on your velocity)*

- **Phase 1 (Layout)**: 1-2 days
- **Phase 2 (TOC)**: 2-3 days
- **Phase 3 (Tooltip Panel)**: 3-4 days (including DB changes)
- **Phase 4 (Highlighting)**: 1-2 days

**Total**: ~7-11 days for MVP implementation

---

## Success Criteria

### MVP Complete When:
- ✅ Three-panel layout works on desktop
- ✅ TOC displays and navigates correctly
- ✅ All tooltips visible in right panel
- ✅ Pin/unpin functionality works
- ✅ Relevant tooltips highlight when term is visible
- ✅ Selected text highlights within blocks (fuzzy match)
- ✅ CRUD operations work from tooltip panel
- ✅ Tests pass for new functionality

### Known Limitations (Acceptable for MVP):
- No mobile/responsive layout
- No panel resizing
- No drag-and-drop reordering
- No tooltip linking
- Simple fuzzy matching (not perfect precision)
- No search/filter in tooltip panel
