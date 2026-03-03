# Semantic Tooltips Implementation Plan

## Overview

Transform tooltips from paragraph-level "comments" to intelligent, semantic annotations that:
1. **Link to knowledge graph entities** (symbols, definitions, theorems)
2. **Apply to all occurrences** of a term throughout the document
3. **Are agent-suggested** based on user expertise level
4. **Persist in HTML** via injected `<span>` tags at compile time

This feature bridges the knowledge graph and the reading experience, making papers interactive and contextual.

---

## Current State vs. Target State

### Current State ❌
- **Tooltips are paragraph-level comments**
  - Keyed to `data-id` on `<p>`, `<section>`, etc.
  - Appear only on that specific block
  - No connection to knowledge graph
- **Knowledge graph exists but is disconnected**
  - Extracts entities (symbols, definitions, theorems)
  - Visualized separately in graph view
  - No integration with paper reading experience
- **Manual tooltip creation only**
  - User must type all content
  - No suggestions or pre-population

### Target State ✅
- **Semantic tooltips linked to entities**
  - Associated with KG nodes (e.g., `symbol_alpha_t`)
  - Appear on **all occurrences** of that entity
  - Content auto-generated from KG data
- **Terms are wrapped in HTML**
  - `<span class="kg-entity" data-entity-id="symbol_alpha_t">α_t</span>`
  - Clickable/hoverable throughout document
  - Persisted in HTML (survive page reload)
- **Agent-suggested tooltips**
  - User clicks "Suggest Tooltips"
  - Agent filters entities by expertise level
  - Batch creates tooltips for relevant terms
- **Dual tooltip types**
  - **Semantic tooltips**: Apply document-wide (have `entity_id`)
  - **Paragraph comments**: Apply to one block (no `entity_id`)

---

## Architecture

### High-Level Flow

```
1. User compiles LaTeX → HTML with block-level data-ids
2. User builds Knowledge Graph → Entities extracted with occurrence positions
3. User clicks "Suggest Tooltips" (selects expertise level)
   ↓
4. Backend filters entities by expertise
5. Backend generates tooltip content from KG data
6. Backend returns suggestions (entity + occurrences + content)
   ↓
7. Frontend shows preview modal (user reviews/edits)
8. User clicks "Apply Selected"
   ↓
9. Backend injects <span> tags at occurrence positions
10. Backend persists modified HTML + Tooltip records
11. Frontend reloads → terms are wrapped and interactive
```

---

## Core Design Decisions

### Decision 1: HTML Tag Injection Strategy

**Problem:** How do we make specific terms (not just paragraphs) interactive?

**Solution:** Backend injects `<span>` tags at character offsets, persists modified HTML

**Rationale:**
- Tooltips must survive page reload (not runtime-only)
- Backend has full context (KG data + occurrence positions)
- Allows offline operation (wrapped spans don't need API calls to render)

**Implementation:**
```python
def inject_tooltip_spans(html: str, suggestions: List[Dict]) -> Tuple[str, List[str]]:
    """
    Inject <span class="kg-entity" data-entity-id="..."> tags at specified positions.

    Args:
        html: Original compiled HTML
        suggestions: List of {entity_id, occurrences: [{dom_node_id, char_offset, length}]}

    Returns:
        (modified_html, errors)
    """
    soup = BeautifulSoup(html, 'html.parser')
    errors = []

    for suggestion in suggestions:
        for occ in suggestion['occurrences']:
            try:
                node = soup.find(attrs={'data-id': occ['dom_node_id']})
                if not node:
                    errors.append(f"Node {occ['dom_node_id']} not found")
                    continue

                # Wrap text at offset (handles nested HTML carefully)
                wrap_text_at_offset(
                    node,
                    occ['char_offset'],
                    occ['length'],
                    entity_id=suggestion['entity_id']
                )
            except Exception as e:
                errors.append(f"Failed to wrap {occ}: {e}")

    return str(soup), errors
```

**Challenge:** Wrapping text while preserving nested HTML (e.g., `<em>`, `<math>`)

**Solution:** DOM tree traversal - walk text nodes, calculate cumulative offsets

---

### Decision 2: Term Occurrence Detection

**Problem:** How do we find all instances of "α_t" in the document?

**Solution:** Extend KG extraction agents to track occurrence positions during initial scan

**Rationale:**
- Already scanning sections for entity extraction
- LLM sees context (can distinguish "H" as Hilbert space vs. entropy)
- Avoids duplicate API calls (reuse KG extraction work)
- Stores positions in KG node data for reuse

**Implementation:**
```python
# In knowledge_graph.py - update Pydantic models

class Symbol(BaseModel):
    symbol: str
    context: str
    latex_form: str
    # NEW: Track all occurrences
    occurrences: List[Dict] = Field(default_factory=list)
    # [{"section_id": "s3.2", "dom_node_id": "p_123", "char_offset": 45, "length": 2, "snippet": "..."}]

# In symbol_extraction agent

def symbol_extraction(state: GraphState) -> GraphState:
    """Extract symbols and track their positions"""

    for section in state["sections"]:
        response = llm.invoke(...)  # Existing extraction

        # NEW: For each symbol, find occurrence positions
        section_text = strip_html_tags(section["content_html"])

        for symbol in response.symbols:
            # Hybrid approach:
            # 1. Try plain text search first (cheap)
            offsets = find_all_occurrences_plaintext(section_text, symbol.symbol)

            # 2. If ambiguous (short symbol, many matches), use LLM
            if len(offsets) > 10 or len(symbol.symbol) < 3:
                offsets = find_occurrences_llm(section_text, symbol, section["id"])

            for offset in offsets:
                symbol.occurrences.append({
                    "section_id": section["id"],
                    "dom_node_id": section["dom_node_id"],
                    "char_offset": offset,
                    "length": len(symbol.symbol),
                    "snippet": section_text[offset-20:offset+20]  # Context
                })

    # Store in state
    state["symbols"] = [s.dict() for s in all_symbols]
    return state
```

**Optimization:** Use Mark.js for plain text terms (cheap, fast), LLM only for ambiguous cases

---

### Decision 3: Tooltip Suggestion & Filtering

**Problem:** Don't want to annotate ALL entities (too cluttered)

**Solution:** Agent filters entities based on user expertise level

**Implementation:**
```python
def filter_entities_by_expertise(
    entities: List[Dict],
    expertise_level: str  # "beginner" | "intermediate" | "expert"
) -> List[Dict]:
    """
    Use LLM to select entities worth annotating.

    Criteria by expertise:
    - Beginner: Annotate most terms, skip only universals ("number", "set")
    - Intermediate: Annotate domain-specific terms, skip common ML terms
    - Expert: Annotate only novel/paper-specific concepts
    """

    system_prompt = """You are an academic paper annotation assistant.
    Your job is to select which terms from a knowledge graph should have tooltips,
    based on the reader's expertise level."""

    user_prompt = f"""
User expertise: {expertise_level}

Knowledge graph entities:
{format_entities_for_filtering(entities)}

Select entities to annotate. Guidelines:
- Beginner: Annotate most terms to build understanding
- Intermediate: Annotate domain-specific jargon, skip basics
- Expert: Annotate only paper-specific innovations

Return JSON: {{"selected_entity_ids": ["symbol_alpha_t", "def_ELBO", ...]}}
"""

    llm = ChatAnthropic(model="claude-sonnet-4")
    response = llm.with_structured_output(FilterOutput).invoke([
        ("system", system_prompt),
        ("user", user_prompt)
    ])

    return [e for e in entities if e['id'] in response.selected_entity_ids]
```

**Cost optimization:** Single LLM call per paper (not per entity)

---

### Decision 4: Tooltip Content Generation

**Problem:** What text should appear in tooltips?

**Solution (MVP):** Copy from knowledge graph data

**Implementation:**
```python
def generate_tooltip_content(entity: Dict) -> str:
    """
    Generate tooltip content from KG node data.

    Phase 1 (MVP): Simple template from KG fields
    Phase 2: Add LLM refinement for clarity
    """
    if entity['type'] == 'symbol':
        return entity.get('context', entity['label'])
        # Example: "Noise scaling parameter at timestep t"

    elif entity['type'] == 'definition':
        return entity.get('definition_text', f"Definition of {entity['label']}")
        # Example: "A stochastic process that gradually adds noise to data"

    elif entity['type'] == 'theorem':
        return f"{entity['label']}: {entity.get('statement', 'See theorem statement')}"
        # Example: "Theorem 3.2: The reverse process converges to the data distribution"

    else:
        return entity.get('context', entity['label'])
```

**Future enhancement:** Add "Refine Definition" button
- User clicks → modal opens
- LLM rephrases for clarity: `"Make this definition more accessible: {content}"`
- User accepts/edits/rejects

---

### Decision 5: Dual Tooltip Types

**Problem:** Users may want both semantic (term-wide) and paragraph-specific comments

**Solution:** Support two tooltip modes via `entity_id` field

**Database Schema:**
```python
class Tooltip(Base):
    __tablename__ = "tooltips"

    id = Column(String(64), primary_key=True)
    paper_id = Column(String(64), ForeignKey("papers.id"), nullable=False)

    # Dual mode:
    # 1. Semantic tooltip (entity_id is set, dom_node_id is NULL)
    #    → Applies to all occurrences of that entity
    # 2. Paragraph comment (entity_id is NULL, dom_node_id is set)
    #    → Applies to one specific block

    entity_id = Column(String(128), nullable=True)      # NEW: e.g., "symbol_alpha_t"
    dom_node_id = Column(String(128), nullable=True)    # e.g., "p_123"

    user_id = Column(String(64), default="default")
    target_text = Column(String(512), nullable=True)    # Display label
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False)
    display_order = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    paper = relationship("Paper", back_populates="tooltips")
```

**Frontend Behavior:**
```tsx
// When hovering over <span class="kg-entity" data-entity-id="symbol_alpha_t">
const tooltip = tooltips.find(t => t.entity_id === "symbol_alpha_t");
// Shows on ALL <span> elements with that entity_id

// When clicking on a paragraph (no entity span)
const tooltip = tooltips.find(t => t.dom_node_id === currentParagraphId);
// Shows only for that paragraph
```

---

## Implementation Phases

### Phase 1: Extend KG Scaffold to Track Occurrences (3-5 days)

**Goal:** During entity extraction, record exact positions where terms appear

**Tasks:**
- [ ] Update Pydantic models (`Symbol`, `Definition`, `Theorem`) to include `occurrences: List[Dict]`
- [ ] Modify extraction agents to track positions:
  - [ ] `symbol_extraction` - find symbol offsets in section text
  - [ ] `definition_extraction` - track definition term positions
  - [ ] `theorem_extraction` - track theorem label positions
- [ ] Implement `find_all_occurrences_plaintext()` utility (regex/Mark.js-style)
- [ ] Implement `find_occurrences_llm()` for ambiguous cases (optional, can defer)
- [ ] Test: Build KG for sample paper, verify `knowledge_graph.nodes[].occurrences` populated
- [ ] Update `knowledge_graph` JSON schema documentation

**Example Output:**
```json
{
  "nodes": [
    {
      "id": "symbol_alpha_t",
      "type": "symbol",
      "label": "α_t",
      "context": "Noise scaling parameter at timestep t",
      "latex": "\\alpha_t",
      "occurrences": [
        {
          "section_id": "s3.2",
          "dom_node_id": "p_456",
          "char_offset": 45,
          "length": 2,
          "snippet": "...where α_t represents the noise..."
        },
        {
          "section_id": "s4.1",
          "dom_node_id": "p_789",
          "char_offset": 12,
          "length": 2,
          "snippet": "Using α_t from Section 3..."
        }
      ]
    }
  ]
}
```

---

### Phase 2: Tooltip Suggestion Endpoint (4-6 days)

**Goal:** API to filter entities and prepare tooltip suggestions

**Tasks:**
- [ ] Create Pydantic models for API:
  ```python
  class TooltipSuggestionRequest(BaseModel):
      user_expertise: str  # "beginner" | "intermediate" | "expert"
      entity_types: Optional[List[str]]  # ["symbol", "definition"], optional filter

  class TooltipSuggestion(BaseModel):
      entity_id: str
      entity_label: str
      entity_type: str
      tooltip_content: str
      occurrences: List[Dict]

  class TooltipSuggestionResponse(BaseModel):
      suggestions: List[TooltipSuggestion]
      total_entities: int
      suggested_count: int
  ```

- [ ] Implement `filter_entities_by_expertise()` agent
  - [ ] Write prompt for entity filtering
  - [ ] Use structured output (Pydantic)
  - [ ] Test with different expertise levels

- [ ] Implement `generate_tooltip_content()` template function
  - [ ] Handle symbol, definition, theorem types
  - [ ] Format nicely (2-3 sentences)

- [ ] Create endpoint `POST /api/papers/{paper_id}/tooltips/suggest`
  - [ ] Load KG from database
  - [ ] Filter entities
  - [ ] Generate content
  - [ ] Return suggestions

- [ ] Test: Send request with expertise="intermediate", verify reasonable subset returned

**Example Request:**
```json
POST /api/papers/abc123/tooltips/suggest
{
  "user_expertise": "intermediate",
  "entity_types": ["symbol", "definition"]
}
```

**Example Response:**
```json
{
  "suggestions": [
    {
      "entity_id": "symbol_alpha_t",
      "entity_label": "α_t",
      "entity_type": "symbol",
      "tooltip_content": "Noise scaling parameter at timestep t. Controls the amount of noise added in the forward diffusion process.",
      "occurrences": [...]
    },
    ...
  ],
  "total_entities": 47,
  "suggested_count": 12
}
```

---

### Phase 3: HTML Injection & Persistence (5-7 days)

**Goal:** Inject `<span>` tags at occurrence positions and persist modified HTML

**Tasks:**
- [ ] Implement `inject_tooltip_spans()` function
  - [ ] Parse HTML with BeautifulSoup
  - [ ] For each occurrence, find paragraph by `dom_node_id`
  - [ ] Implement `wrap_text_at_offset()` - carefully handle nested HTML
  - [ ] Handle edge cases:
    - [ ] Overlapping spans (skip or merge)
    - [ ] Text inside `<math>` tags (skip or special handling)
    - [ ] Multi-line text (char offset calculation)
  - [ ] Return modified HTML + list of errors

- [ ] Create database migration:
  ```bash
  alembic revision -m "add entity_id to tooltips"
  # Add: entity_id VARCHAR(128) NULLABLE
  ```

- [ ] Implement endpoint `POST /api/papers/{paper_id}/tooltips/apply`
  - [ ] Accept suggestions from `/suggest`
  - [ ] Inject spans into HTML
  - [ ] Persist modified HTML to `paper.html_content`
  - [ ] Create Tooltip records (with `entity_id` set, `dom_node_id` NULL)
  - [ ] Return success + errors

- [ ] Test: Apply tooltips to sample paper
  - [ ] Verify spans injected correctly
  - [ ] Reload paper → terms are wrapped
  - [ ] Check database → Tooltip entries created

**Example Request:**
```json
POST /api/papers/abc123/tooltips/apply
{
  "suggestions": [
    {
      "entity_id": "symbol_alpha_t",
      "entity_label": "α_t",
      "tooltip_content": "Noise scaling parameter...",
      "occurrences": [...]
    }
  ]
}
```

**Example Response:**
```json
{
  "success": true,
  "spans_injected": 15,
  "tooltips_created": 1,
  "errors": [
    "Failed to wrap occurrence at p_789:45 - text not found"
  ]
}
```

**Critical Implementation: `wrap_text_at_offset()`**

```python
def wrap_text_at_offset(
    node: bs4.element.Tag,
    char_offset: int,
    length: int,
    entity_id: str
) -> None:
    """
    Wrap text at specified offset within a node.

    Handles nested HTML by walking text nodes and tracking cumulative offset.

    Example:
        Input:  <p>The <em>noise</em> parameter α_t is important.</p>
                                         ^^^^ wrap this (offset=27, length=2)
        Output: <p>The <em>noise</em> parameter <span class="kg-entity"
                data-entity-id="symbol_alpha_t">α_t</span> is important.</p>

    Algorithm:
    1. Walk all descendant text nodes
    2. Track cumulative character count
    3. When offset falls within a text node, split it and insert <span>
    """

    current_offset = 0
    target_start = char_offset
    target_end = char_offset + length

    # Find all text nodes in document order
    for text_node in node.descendants:
        if isinstance(text_node, NavigableString) and not isinstance(text_node, Comment):
            text_len = len(text_node)
            node_end = current_offset + text_len

            # Check if target range overlaps this text node
            if current_offset <= target_start < node_end:
                # Split this text node
                # ... (complex logic to handle partial overlaps)

                # Create span
                span = BeautifulSoup(
                    f'<span class="kg-entity" data-entity-id="{entity_id}"></span>',
                    'html.parser'
                ).span

                # Insert wrapped text
                # ... (more complex logic)

                return  # Done

            current_offset = node_end

    raise ValueError(f"Offset {char_offset} not found in node")
```

**Alternative (if too complex):** Use regex replacement (less robust but simpler)

---

### Phase 4: Frontend Integration (4-5 days)

**Goal:** UI for suggesting, previewing, and displaying semantic tooltips

**Tasks:**

#### 4.1: Suggest Tooltips Button
- [ ] Create `SuggestTooltipsButton.tsx` component
  - [ ] Dropdown to select expertise level
  - [ ] "Suggest Tooltips" button
  - [ ] Loading state during API call
  - [ ] Opens preview modal on success

- [ ] Add button to paper reader UI (toolbar or sidebar)

#### 4.2: Suggestion Preview Modal
- [ ] Create `TooltipSuggestionModal.tsx`
  - [ ] Show list of suggested tooltips
  - [ ] Each suggestion shows:
    - Entity label (e.g., "α_t")
    - Type badge (symbol/definition/theorem)
    - Tooltip content (editable textarea)
    - Occurrence count (e.g., "15 occurrences")
    - Checkbox to include/exclude
  - [ ] "Apply Selected" button → calls `/apply` endpoint
  - [ ] Progress bar during application
  - [ ] Success message + reload paper

- [ ] Test: Suggest → preview → apply → verify tooltips appear

#### 4.3: Entity Hover Tooltip Display
- [ ] Update HTML parser to recognize `<span class="kg-entity">`
  - [ ] Add hover state (highlight on hover)
  - [ ] Show tooltip popover on hover/click
  - [ ] Tooltip content from `Tooltip` table (match by `entity_id`)

- [ ] Create `EntityTooltipPopover.tsx`
  - [ ] Shows tooltip content
  - [ ] "Edit Definition" button → opens edit modal
  - [ ] "Dispute Definition" button → opens feedback form (future)
  - [ ] "Navigate to Definition" → scroll to `first_occurrence_id`

- [ ] CSS styling:
  ```css
  .kg-entity {
    border-bottom: 1px dotted #6366f1;  /* Indigo underline */
    cursor: help;
    transition: background-color 0.2s;
  }

  .kg-entity:hover {
    background-color: rgba(99, 102, 241, 0.1);  /* Light indigo */
  }

  .kg-entity[data-entity-type="symbol"] {
    border-color: #3b82f6;  /* Blue for symbols */
  }

  .kg-entity[data-entity-type="definition"] {
    border-color: #10b981;  /* Green for definitions */
  }

  .kg-entity[data-entity-type="theorem"] {
    border-color: #8b5cf6;  /* Purple for theorems */
  }
  ```

#### 4.4: Tooltip Panel Updates
- [ ] Update `TooltipPanel.tsx` to show semantic tooltips
  - [ ] Group by type: "Semantic Tooltips" section + "Paragraph Comments" section
  - [ ] Semantic tooltips show entity label + occurrence count
  - [ ] Click → scroll to first occurrence (or highlight all)

- [ ] Test: Tooltip panel shows both types correctly

---

### Phase 5: Testing & Polish (2-3 days)

**Tasks:**
- [ ] End-to-end test with real arXiv paper
  - [ ] Compile → Build KG → Suggest Tooltips → Apply → Verify
  - [ ] Test with beginner/intermediate/expert expertise
  - [ ] Verify no HTML corruption

- [ ] Edge case testing:
  - [ ] Paper with 100+ entities (performance)
  - [ ] Overlapping terms (e.g., "α" inside "α_t")
  - [ ] Math-heavy papers (lots of symbols)
  - [ ] Papers with special characters

- [ ] Error handling:
  - [ ] Handle span injection failures gracefully
  - [ ] Show user-friendly error messages
  - [ ] Allow partial application (some tooltips fail, others succeed)

- [ ] Documentation:
  - [ ] Update README with new feature
  - [ ] Add tooltips user guide
  - [ ] Document API endpoints

---

## Database Schema Changes

### Migration: Add `entity_id` to Tooltips

```sql
-- Migration: Add entity_id for semantic tooltips
ALTER TABLE tooltips ADD COLUMN entity_id VARCHAR(128);

-- Index for performance
CREATE INDEX idx_tooltips_entity ON tooltips(entity_id);

-- Constraint: Either entity_id OR dom_node_id must be set (not both null)
-- Enforced at application level (not DB constraint for flexibility)
```

**Updated Tooltip Model:**
```python
class Tooltip(Base):
    __tablename__ = "tooltips"

    id = Column(String(64), primary_key=True)
    paper_id = Column(String(64), ForeignKey("papers.id"), nullable=False)

    # Dual mode: semantic (entity_id) vs. paragraph (dom_node_id)
    entity_id = Column(String(128), nullable=True)      # NEW
    dom_node_id = Column(String(128), nullable=True)

    user_id = Column(String(64), default="default")
    target_text = Column(String(512), nullable=True)
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False)
    display_order = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    paper = relationship("Paper", back_populates="tooltips")

    __table_args__ = (
        Index("idx_paper_node", "paper_id", "dom_node_id"),
        Index("idx_paper_entity", "paper_id", "entity_id"),  # NEW
        Index("idx_paper_user", "paper_id", "user_id"),
    )
```

---

## API Endpoints

### New Endpoints

#### `POST /api/papers/{paper_id}/tooltips/suggest`

**Description:** Suggest tooltips based on knowledge graph and user expertise

**Request Body:**
```json
{
  "user_expertise": "intermediate",  // "beginner" | "intermediate" | "expert"
  "entity_types": ["symbol", "definition"]  // Optional filter
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "entity_id": "symbol_alpha_t",
      "entity_label": "α_t",
      "entity_type": "symbol",
      "tooltip_content": "Noise scaling parameter at timestep t...",
      "occurrences": [
        {
          "section_id": "s3.2",
          "dom_node_id": "p_456",
          "char_offset": 45,
          "length": 2,
          "snippet": "...where α_t represents..."
        }
      ]
    }
  ],
  "total_entities": 47,
  "suggested_count": 12
}
```

**Errors:**
- `404` - Paper or knowledge graph not found
- `400` - Invalid expertise level

---

#### `POST /api/papers/{paper_id}/tooltips/apply`

**Description:** Apply suggested tooltips by injecting spans into HTML and creating Tooltip records

**Request Body:**
```json
{
  "suggestions": [
    {
      "entity_id": "symbol_alpha_t",
      "entity_label": "α_t",
      "tooltip_content": "Noise scaling parameter...",
      "occurrences": [...]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "spans_injected": 15,
  "tooltips_created": 1,
  "errors": [
    "Failed to wrap occurrence at p_789:45 - text not found"
  ]
}
```

**Errors:**
- `404` - Paper not found
- `500` - HTML injection failed (partial application may occur)

**Side Effects:**
- Modifies `paper.html_content` (injects `<span>` tags)
- Creates `Tooltip` records with `entity_id` set

---

### Updated Endpoints

#### `GET /api/papers/{paper_id}/tooltips`

**Response (updated):**
```json
[
  {
    "id": "tooltip_001",
    "entity_id": "symbol_alpha_t",  // NEW: Set for semantic tooltips
    "dom_node_id": null,            // NULL for semantic tooltips
    "target_text": "α_t",
    "content": "Noise scaling parameter...",
    "is_pinned": false,
    "created_at": "2025-03-03T10:00:00Z"
  },
  {
    "id": "tooltip_002",
    "entity_id": null,              // NULL for paragraph comments
    "dom_node_id": "p_123",         // Set for paragraph comments
    "target_text": "This paragraph",
    "content": "User's manual comment...",
    "is_pinned": true,
    "created_at": "2025-03-03T11:00:00Z"
  }
]
```

---

## Frontend Components

### New Components

#### `SuggestTooltipsButton.tsx`
```tsx
interface SuggestTooltipsButtonProps {
  paperId: string;
  onSuggestionsReady: (suggestions: TooltipSuggestion[]) => void;
}

// Shows:
// - Expertise level dropdown (beginner/intermediate/expert)
// - "Suggest Tooltips" button
// - Loading spinner during API call
```

#### `TooltipSuggestionModal.tsx`
```tsx
interface TooltipSuggestionModalProps {
  suggestions: TooltipSuggestion[];
  onApply: (selectedSuggestions: TooltipSuggestion[]) => Promise<void>;
  onCancel: () => void;
}

// Shows:
// - List of suggestions with checkboxes
// - Editable tooltip content
// - Occurrence count badge
// - "Apply Selected" button
// - Progress bar during application
```

#### `EntityTooltipPopover.tsx`
```tsx
interface EntityTooltipPopoverProps {
  entityId: string;
  tooltip: Tooltip;
  onEdit: () => void;
  onNavigateToDefinition: () => void;
}

// Shows on hover of <span class="kg-entity">:
// - Tooltip content
// - "Edit Definition" button
// - "Go to Definition" link
// - Entity type badge
```

### Updated Components

#### `TooltipPanel.tsx`
- Group tooltips into sections:
  - **Semantic Tooltips** (has `entity_id`)
    - Grouped by entity type (symbols, definitions, theorems)
    - Show occurrence count
  - **Paragraph Comments** (has `dom_node_id`)
    - Grouped by section (existing behavior)

---

## User Experience Flow

### Happy Path

1. **User opens paper reader**
   - Sees compiled paper in middle panel
   - Knowledge graph in left panel (already built)

2. **User clicks "Suggest Tooltips" in toolbar**
   - Modal appears: "Select your expertise level"
   - User selects "Intermediate"
   - Clicks "Suggest"

3. **Backend processes request**
   - Loads KG from database
   - Agent filters 47 entities → 12 selected
   - Generates tooltip content from KG data
   - Returns suggestions

4. **Preview modal shows 12 suggestions**
   - User sees:
     - "α_t (symbol) - 15 occurrences"
     - Tooltip: "Noise scaling parameter at timestep t..."
     - Checkbox (checked by default)
   - User unchecks 2 suggestions, edits 1 tooltip
   - Clicks "Apply 10 Selected"

5. **Backend applies tooltips**
   - Injects 10 × N `<span>` tags (N = total occurrences)
   - Persists modified HTML
   - Creates 10 Tooltip records
   - Returns success + 2 errors (edge cases)

6. **Frontend reloads paper**
   - Terms now have dotted underlines
   - Hovering shows tooltip content
   - Clicking navigates to definition
   - Tooltip panel shows "10 Semantic Tooltips"

7. **User hovers over "α_t" in Section 4**
   - Tooltip appears: "Noise scaling parameter..."
   - Same tooltip appears on ALL "α_t" instances (15 total)

---

## Edge Cases & Error Handling

### Edge Case 1: Overlapping Occurrences

**Problem:** Paper has "α" and "α_t" - both are entities

**Solution:**
- Longest match first (wrap "α_t" before "α")
- Or: Skip overlapping spans (log warning)
- User can manually adjust via "Edit Tooltips"

---

### Edge Case 2: Text Not Found at Offset

**Problem:** HTML changed between KG build and tooltip application

**Solution:**
- Log error, skip that occurrence
- Continue with other occurrences
- Show user: "Applied 14/15 tooltips (1 failed)"

---

### Edge Case 3: Symbol in Math Mode

**Problem:** `<math>` tags contain structured MathML, not plain text

**Solution (MVP):** Skip occurrences inside `<math>` tags (only wrap plain text)

**Future:** Parse MathML, wrap `<mi>` elements (requires deeper integration)

---

### Edge Case 4: User Edits HTML Later

**Problem:** Wrapped spans prevent future HTML updates

**Solution:**
- Add "Reset HTML" button (removes all spans, reverts to original)
- Store original HTML in `paper.html_content_original`
- Future: Track HTML version, auto-update spans on recompile

---

### Edge Case 5: Same Symbol, Different Meanings

**Problem:** "H" means Hilbert space (Sec 2), Entropy (Sec 4)

**Solution:**
- Agent filters based on context (includes section title in prompt)
- If ambiguous: Create separate entities (`symbol_H_hilbert`, `symbol_H_entropy`)
- User can manually split/merge via "Dispute Definition"

---

## Performance Considerations

### Concern 1: LLM API Costs

**Problem:** Suggesting tooltips for 50-entity paper = expensive

**Mitigation:**
- Use Claude Haiku for filtering (cheap)
- Use Claude Sonnet only for complex content generation
- Cache suggestions (store in `paper.suggested_tooltips` JSON field)
- Allow user to adjust expertise → regenerate without re-scanning

**Estimated Cost (intermediate expertise):**
- Filter 50 entities → 1 LLM call (Sonnet) → ~$0.01
- Generate 12 tooltips → template (no LLM) → $0
- **Total: ~$0.01 per paper**

---

### Concern 2: HTML Injection Performance

**Problem:** Injecting 100+ spans might be slow

**Mitigation:**
- BeautifulSoup is reasonably fast (~1s for 1MB HTML)
- Run in background task (Celery) for large papers
- Show progress bar: "Applying tooltips... 45/100"

---

### Concern 3: Frontend Rendering

**Problem:** 1000s of `<span>` tags might slow down page

**Mitigation:**
- Spans are static (no JavaScript needed)
- Tooltip hover uses CSS-only (no React re-renders)
- If laggy: Lazy-load tooltips (only attach hover listeners in viewport)

---

## Success Criteria

### MVP Complete When:

- [ ] **KG tracks occurrence positions**
  - `knowledge_graph.nodes[].occurrences` populated during extraction
  - At least 80% of visible symbols tracked correctly

- [ ] **Tooltip suggestion works**
  - User selects expertise → gets filtered entity list
  - Content is reasonable (copied from KG)
  - Suggestions include occurrence count

- [ ] **HTML injection works**
  - Spans injected at correct offsets
  - Modified HTML persists in database
  - Page reload shows wrapped terms

- [ ] **Semantic tooltips display**
  - Hovering entity shows tooltip content
  - Same tooltip appears on all occurrences
  - "Edit Definition" button works

- [ ] **Dual tooltip types coexist**
  - Can create semantic tooltips (via suggestion)
  - Can create paragraph comments (manual)
  - Tooltip panel shows both types

- [ ] **End-to-end flow tested**
  - Compile → Build KG → Suggest → Apply → Read
  - Works on 3-5 diverse arXiv papers
  - No HTML corruption or errors

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: KG occurrence tracking | 3-5 days | `occurrences` field populated |
| Phase 2: Suggestion endpoint | 4-6 days | `/suggest` API works |
| Phase 3: HTML injection | 5-7 days | Spans injected, tooltips persist |
| Phase 4: Frontend integration | 4-5 days | Full UI workflow |
| Phase 5: Testing & polish | 2-3 days | E2E tests pass |
| **Total** | **18-26 days** | **~3.5-5 weeks** |

---

## Future Enhancements (Post-MVP)

### Enhancement 1: LLM-Refined Tooltips
- Add "Refine Definition" button
- Prompt: "Make this definition more accessible for {expertise} readers: {content}"
- User can accept/reject/edit

### Enhancement 2: User Expertise Tracking
- Track which entities user has clicked/skipped
- Infer expertise level automatically
- Adjust future suggestions based on behavior

### Enhancement 3: Cross-Paper Entity Linking
- Link "ELBO" in Paper A to definition in Paper B
- "See also: ELBO definition in [Smith et al. 2023]"

### Enhancement 4: Collaborative Tooltips
- Share tooltip sets between users
- Upvote/downvote definitions
- Community-curated explanations

### Enhancement 5: MathML Integration
- Wrap symbols inside `<math>` tags
- Tooltip appears on MathJax-rendered symbols
- Requires deeper MathML parsing

---

## Open Questions

### Q1: How to handle tooltip versioning?

**Scenario:** User applies tooltips, then rebuilds KG (entities changed)

**Options:**
- A. Auto-update tooltips (risky - might overwrite user edits)
- B. Show "Tooltips out of sync" warning, let user re-apply
- C. Track tooltip version, merge intelligently

**Recommendation:** **B** for MVP (manual re-apply)

---

### Q2: Should tooltips be user-specific or paper-wide?

**Current:** `user_id` column exists but MVP uses "default"

**Future:** If multi-user, semantic tooltips should probably be shared (community benefit)

**Recommendation:** Keep paper-wide for MVP, add user-specific override later

---

### Q3: How to handle conflicting span injections?

**Scenario:** User applies tooltips twice (forgets they already did)

**Options:**
- A. Detect existing spans, skip re-injection
- B. Remove all spans, re-inject fresh
- C. Show error: "Tooltips already applied"

**Recommendation:** **A** (idempotent application)

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| HTML corruption from span injection | Medium | High | Extensive testing, rollback mechanism |
| Occurrence detection inaccurate | Medium | Medium | Start with plain text, iterate to LLM |
| LLM costs too high | Low | Medium | Use caching, cheap models for filtering |
| Performance issues (large papers) | Low | Medium | Background tasks, progress bars |
| User confusion (two tooltip types) | Medium | Low | Clear UI labels, onboarding tooltip |

---

## References

- **Knowledge Graph Plan:** `KNOWLEDGE_GRAPH_PLAN.md`
- **Knowledge Graph TODOs:** `KNOWLEDGE_GRAPH_TODOS.md`
- **IDE Layout Plan:** `IDE_LAYOUT_PLAN.md`
- **Design Document:** `Design Document.md`

---

## Appendix: Code Snippets

### A. Plain Text Occurrence Finder

```python
import re

def find_all_occurrences_plaintext(text: str, term: str) -> List[int]:
    """
    Find all occurrences of term in text (case-sensitive, whole words).

    Returns list of character offsets.
    """
    pattern = r'\b' + re.escape(term) + r'\b'
    return [m.start() for m in re.finditer(pattern, text)]
```

### B. LLM-Based Occurrence Finder (Fallback)

```python
def find_occurrences_llm(
    text: str,
    entity: Dict,
    section_id: str
) -> List[int]:
    """
    Use LLM to find occurrences when plain text search is ambiguous.

    More expensive but handles context (e.g., "H" meaning Hilbert space vs. entropy).
    """

    prompt = f"""
Find all occurrences of the term "{entity['label']}" in this text.

Entity context: {entity['context']}

Text:
{text}

For each occurrence, provide the character offset (0-indexed) from the start.
Only include instances where this specific entity is referenced.

Return JSON: {{"offsets": [45, 123, 456, ...]}}
"""

    llm = ChatAnthropic(model="claude-sonnet-4")
    response = llm.with_structured_output(OccurrenceOutput).invoke(prompt)

    return response.offsets
```

### C. Span Injection Helper

```python
from bs4 import NavigableString, Comment

def wrap_text_at_offset(
    node: bs4.element.Tag,
    char_offset: int,
    length: int,
    entity_id: str
) -> None:
    """
    Wrap text at specified offset with <span class="kg-entity">.

    Handles nested HTML by walking text nodes.
    """

    current_offset = 0

    for child in node.descendants:
        if isinstance(child, NavigableString) and not isinstance(child, Comment):
            text = str(child)
            text_len = len(text)

            # Check if target offset is in this text node
            if current_offset <= char_offset < current_offset + text_len:
                # Calculate position within this text node
                local_offset = char_offset - current_offset

                # Split text: before | target | after
                before = text[:local_offset]
                target = text[local_offset:local_offset + length]
                after = text[local_offset + length:]

                # Create span
                soup = BeautifulSoup(
                    f'<span class="kg-entity" data-entity-id="{entity_id}">{target}</span>',
                    'html.parser'
                )
                span = soup.span

                # Replace original text node with: before + span + after
                parent = child.parent
                index = parent.contents.index(child)

                child.replace_with(before)
                parent.insert(index + 1, span)
                parent.insert(index + 2, after)

                return

            current_offset += text_len

    raise ValueError(f"Offset {char_offset} not found in node")
```

---

**Document Version:** 1.0
**Last Updated:** 2025-03-03
**Status:** Ready for Implementation
