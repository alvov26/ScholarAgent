# Phase 2 Complete: Tooltip Suggestion Endpoint

## Summary

Successfully implemented the tooltip suggestion API endpoint that filters knowledge graph entities based on user expertise and generates tooltip content.

## Changes Made

### 1. Created Pydantic Models for API

**File:** `backend/app/api/main.py`

Added request/response models:

```python
class TooltipSuggestionRequest(BaseModel):
    """Request for tooltip suggestions"""
    user_expertise: str  # "beginner" | "intermediate" | "expert"
    entity_types: Optional[List[str]] = None  # ["symbol", "definition", "theorem"]

class OccurrenceData(BaseModel):
    """A single occurrence of an entity"""
    section_id: str
    dom_node_id: str
    char_offset: int
    length: int
    snippet: str

class TooltipSuggestion(BaseModel):
    """A suggested tooltip"""
    entity_id: str
    entity_label: str
    entity_type: str
    tooltip_content: str
    occurrences: List[OccurrenceData]

class TooltipSuggestionResponse(BaseModel):
    """Response from suggestion endpoint"""
    suggestions: List[TooltipSuggestion]
    total_entities: int
    suggested_count: int
```

### 2. Created Tooltip Suggestion Agent

**File:** `backend/app/agents/tooltip_suggestion.py`

Implemented three main functions:

#### `filter_entities_by_expertise(entities, expertise_level)`
Uses Claude to filter entities based on user expertise:

**Beginner:**
- Annotates most technical terms, mathematical symbols, domain-specific concepts
- Skips only universal terms (e.g., "number", "set")
- Goal: Build foundational understanding

**Intermediate:**
- Annotates domain-specific jargon, paper-specific notation, novel concepts
- Skips common undergraduate-level terms
- Goal: Bridge knowledge gap to paper contributions

**Expert:**
- Annotates only paper-specific innovations, novel notation, redefined concepts
- Skips standard terminology and well-known results
- Goal: Highlight what's new or different

**LLM Prompt:**
```python
FILTER_SYSTEM_PROMPT = """You are an academic paper annotation assistant.
Your job is to select which terms from a knowledge graph should have tooltips,
based on the reader's expertise level.

Guidelines by expertise level:
[... detailed filtering criteria ...]
"""
```

**Structured Output:**
```python
class FilterOutput(BaseModel):
    selected_entity_ids: List[str]
    reasoning: Optional[str]
```

#### `generate_tooltip_content(entity)`
Creates tooltip text from KG data using templates:

**Symbols:**
```python
# Returns: "Noise scaling parameter at timestep t"
return entity.get('context', '')
```

**Definitions:**
```python
# Returns: "Evidence Lower Bound Objective\n\nFull definition: A variational bound..."
return f"{summary}\n\nFull definition: {definition_text}"
```

**Theorems:**
```python
# Returns: "Theorem 3.2: The reverse process converges to the data distribution"
return f"{theorem_label}: {summary}"
```

#### `suggest_tooltips(knowledge_graph, user_expertise, entity_type_filter)`
Main orchestration function:
1. Loads KG nodes
2. Applies type filter (optional)
3. Calls filtering agent
4. Generates tooltip content for each selected entity
5. Returns suggestions with occurrence data

### 3. Created API Endpoint

**File:** `backend/app/api/main.py`

Added:
```python
@app.post("/api/papers/{paper_id}/tooltips/suggest", response_model=TooltipSuggestionResponse)
async def suggest_tooltips_endpoint(paper_id, request, db)
```

**Endpoint Features:**
- Validates paper exists
- Checks KG has been built
- Validates expertise level ("beginner"/"intermediate"/"expert")
- Validates entity_types filter if provided
- Calls suggestion agent
- Returns structured response with occurrences
- Comprehensive error handling

## API Usage

### Request

```bash
POST /api/papers/{paper_id}/tooltips/suggest
Content-Type: application/json

{
  "user_expertise": "intermediate",
  "entity_types": ["symbol", "definition"]  // optional
}
```

### Response

```json
{
  "suggestions": [
    {
      "entity_id": "symbol_alpha_t",
      "entity_label": "α_t",
      "entity_type": "symbol",
      "tooltip_content": "Noise scaling parameter at timestep t",
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
    },
    {
      "entity_id": "def_ELBO",
      "entity_label": "ELBO",
      "entity_type": "definition",
      "tooltip_content": "Evidence Lower Bound Objective\n\nFull definition: A variational bound...",
      "occurrences": [...]
    }
  ],
  "total_entities": 47,
  "suggested_count": 12
}
```

### Error Responses

**404 - Paper not found:**
```json
{
  "detail": "Paper not found"
}
```

**400 - KG not built:**
```json
{
  "detail": "Knowledge graph not built. Please build the knowledge graph first."
}
```

**400 - Invalid expertise:**
```json
{
  "detail": "Invalid expertise level. Must be one of: beginner, intermediate, expert"
}
```

**500 - Server error:**
```json
{
  "detail": "Failed to suggest tooltips: <error details>"
}
```

## Testing

### Unit Tests

```python
# Test 1: Tooltip content generation
from backend.app.agents.tooltip_suggestion import generate_tooltip_content

symbol = {
    'type': 'symbol',
    'label': 'α_t',
    'context': 'Noise scaling parameter'
}
content = generate_tooltip_content(symbol)
assert content == 'Noise scaling parameter'

# Test 2: Definition content
definition = {
    'type': 'definition',
    'label': 'ELBO',
    'summary': 'Evidence Lower Bound',
    'definition_text': 'A variational bound...'
}
content = generate_tooltip_content(definition)
assert 'Evidence Lower Bound' in content
assert 'Full definition' in content

# Test 3: Theorem content
theorem = {
    'type': 'theorem',
    'label': 'Theorem 3.2',
    'number': '3.2',
    'summary': 'Convergence result'
}
content = generate_tooltip_content(theorem)
assert 'Theorem 3.2' in content
assert 'Convergence result' in content
```

### Integration Tests

```bash
# 1. Start backend
cd frontend
npm run dev:backend

# 2. Test endpoint with curl (requires existing paper with KG)
curl -X POST http://localhost:8000/api/papers/{paper_id}/tooltips/suggest \
  -H "Content-Type: application/json" \
  -d '{"user_expertise": "intermediate"}'

# Expected: JSON response with suggestions

# 3. Test with different expertise levels
curl ... -d '{"user_expertise": "beginner"}'
curl ... -d '{"user_expertise": "expert"}'

# Expected: Different numbers of suggestions based on filtering

# 4. Test with entity type filter
curl ... -d '{"user_expertise": "intermediate", "entity_types": ["symbol"]}'

# Expected: Only symbol entities returned
```

### Manual Testing Workflow

1. **Upload and compile a paper**
2. **Build knowledge graph** (ensure Phase 1 occurrences are tracked)
3. **Call suggestion endpoint:**
   ```python
   import requests

   response = requests.post(
       'http://localhost:8000/api/papers/{paper_id}/tooltips/suggest',
       json={
           'user_expertise': 'intermediate',
           'entity_types': ['symbol', 'definition']
       }
   )

   data = response.json()
   print(f"Total entities: {data['total_entities']}")
   print(f"Suggested: {data['suggested_count']}")

   for suggestion in data['suggestions'][:5]:
       print(f"\n{suggestion['entity_label']} ({suggestion['entity_type']}):")
       print(f"  Content: {suggestion['tooltip_content'][:80]}...")
       print(f"  Occurrences: {len(suggestion['occurrences'])}")
   ```

4. **Verify filtering:**
   - Beginner should suggest more entities
   - Expert should suggest fewer
   - All suggestions should have occurrence data from Phase 1

## Performance Characteristics

### LLM Calls

**Per request:**
- 1 LLM call for entity filtering
- 0 LLM calls for content generation (template-based)

**Cost estimate (for 50-entity paper):**
- Input tokens: ~2000 (entity list + prompt)
- Output tokens: ~200 (selected IDs + reasoning)
- Model: Claude Sonnet 4
- Cost: ~$0.01 per request

**Optimization strategies:**
- Cache filtering results per expertise level
- Reuse across multiple users with same expertise
- Pre-filter trivial entities before LLM call

### Response Time

**Typical:**
- KG load from DB: ~10ms
- LLM filtering call: ~1-2s
- Content generation: ~1ms per entity
- Total: ~1.5-2.5s

**Optimization opportunities (Phase 3):**
- Run filtering in background after KG build
- Store pre-filtered suggestions in Paper model
- Add `suggested_tooltips` JSON field

## Known Limitations

### 1. Filtering Accuracy
- LLM may occasionally include/exclude incorrectly
- Depends on prompt quality and entity context
- **Mitigation:** User can manually adjust in preview modal (Phase 4)

### 2. Content Quality
- Templates are simple (no rephrasing)
- May be too terse for beginners
- **Future:** Add "Refine Definition" button with LLM rephrasing

### 3. Token Limits
- Large KGs (200+ entities) may exceed prompt limits
- Currently limited to first 50 entities per type
- **Future:** Batch processing or pagination

### 4. LaTeX Rendering
- Tooltip content is plain text/markdown
- May contain LaTeX syntax ($\alpha_t$) without rendering
- **Future:** Frontend renders LaTeX in tooltips

## Files Created/Modified

### Created:
- `backend/app/agents/tooltip_suggestion.py`:
  - `FilterOutput` Pydantic model
  - `filter_entities_by_expertise()` agent
  - `generate_tooltip_content()` template function
  - `suggest_tooltips()` orchestration function

### Modified:
- `backend/app/api/main.py`:
  - Added `TooltipSuggestionRequest` model
  - Added `OccurrenceData` model
  - Added `TooltipSuggestion` model
  - Added `TooltipSuggestionResponse` model
  - Added `POST /api/papers/{paper_id}/tooltips/suggest` endpoint

## Backward Compatibility

- No database changes (uses existing `knowledge_graph` JSON field)
- No breaking changes to existing tooltip endpoints
- New endpoint is additive only

## Next Steps (Phase 3)

Phase 3 will implement HTML injection:

1. **Create `POST /api/papers/{paper_id}/tooltips/apply` endpoint**
   - Accept suggestions from `/suggest`
   - Inject `<span>` tags at occurrence positions
   - Persist modified HTML
   - Create Tooltip records with `entity_id`

2. **Implement `inject_tooltip_spans()` function**
   - Parse HTML with BeautifulSoup
   - Find paragraphs by `dom_node_id`
   - Wrap text at `char_offset` positions
   - Handle overlapping spans

3. **Database migration**
   - Add `entity_id` column to Tooltip table
   - Index for performance

## Completion Checklist

- [x] Create Pydantic models for suggestion API
- [x] Implement `filter_entities_by_expertise()` agent
- [x] Implement `generate_tooltip_content()` template function
- [x] Create `POST /api/papers/{paper_id}/tooltips/suggest` endpoint
- [x] Write comprehensive prompts for filtering
- [x] Add validation for expertise levels and entity types
- [x] Test tooltip content generation
- [x] Test API endpoint integration
- [x] Document API usage and response format

**Phase 2 Status: ✅ COMPLETE**

Ready to proceed to Phase 3: HTML Injection & Persistence
