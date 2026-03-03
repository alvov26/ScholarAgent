# Tooltip Suggestion SSE Streaming Plan

## Overview
Implement Server-Sent Events (SSE) streaming for tooltip suggestions, similar to the knowledge graph build progress system.

## Architecture

### Backend Components

1. **Global Progress Tracker**
   ```python
   tooltip_suggestion_progress: Dict[str, Dict[str, Any]] = {}
   # Format: {paper_id: {stage: str, message: str, progress: Optional[int]}}
   ```

2. **SSE Endpoint**
   - `GET /api/papers/{paper_id}/tooltips/suggest/progress`
   - Streams progress updates every 500ms
   - States: `starting`, `analyzing`, `filtering`, `generating`, `complete`, `error`

3. **Background Task**
   - POST to `/api/papers/{paper_id}/tooltips/suggest` triggers background task
   - Returns immediately with 202 Accepted
   - Updates progress dict during execution
   - Final result stored and retrievable

4. **Progress Callback Integration**
   - `suggest_tooltips()` already has `progress_callback` parameter
   - Callback updates global `tooltip_suggestion_progress` dict
   - Debug logging via `SCHOLAR_DEBUG` environment variable

### Progress States

1. **starting**: Initial state when request received
2. **analyzing**: Loading and analyzing KG
3. **filtering**: LLM filtering entities by expertise
4. **generating**: Generating tooltip content
5. **complete**: Finished with result count
6. **error**: Failed with error message

### Frontend Components

1. **Progress UI** (similar to KG build)
   - Show progress bar/spinner during suggestion
   - Display current stage message
   - Toast notification on completion/error

2. **EventSource Connection**
   - Connect to SSE endpoint when suggestion starts
   - Update UI with progress messages
   - On complete: fetch suggestions and show modal

## Implementation Steps

1. ✅ Add `progress_callback` to `suggest_tooltips()` and `filter_entities_by_expertise()`
2. ✅ Add debug logging with `SCHOLAR_DEBUG` env var
3. ⏳ Create global `tooltip_suggestion_progress` dict
4. ⏳ Implement SSE endpoint `GET /api/papers/{paper_id}/tooltips/suggest/progress`
5. ⏳ Convert POST `/tooltips/suggest` to background task pattern
6. ⏳ Wire up progress callbacks to update global dict
7. ⏳ Frontend: Add SSE listener and progress UI
8. ⏳ Frontend: Update button states during async operation

## Notes

- Reuse KG build progress pattern for consistency
- Progress callback already integrated into agent code
- Debug mode controlled by `SCHOLAR_DEBUG=true` environment variable
- SSE allows real-time updates without polling overhead
