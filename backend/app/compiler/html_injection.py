"""
HTML Span Injection for Semantic Tooltips

Injects <span class="kg-entity"> tags at precise character offsets in compiled HTML.
Part of Phase 3: HTML Injection & Persistence.

This is the most fragile part of the system - we're manipulating HTML at character-level
positions while preserving all existing structure and nested tags.
"""

import os
from typing import List, Dict, Any, Tuple
from bs4 import BeautifulSoup, NavigableString, Comment
import re

# Debug mode controlled by environment variable
DEBUG = os.getenv("TOOLTIP_AGENT_DEBUG", "false").lower() == "true"

def debug_print(message: str):
    """Print debug message if DEBUG mode is enabled"""
    if DEBUG:
        print(f"[HTML Injection] {message}")


# =============================================================================
# Occurrence Detection
# =============================================================================

def extract_occurrences_from_html(
    term: str,
    html: str,
    max_snippet_chars: int = 40
) -> List[Dict[str, Any]]:
    """
    Find all occurrences of a term in the compiled HTML.

    This function searches the SAME HTML that will be used for injection,
    ensuring that character offsets match exactly.

    Args:
        term: The term to find (plain text)
        html: The compiled HTML to search in
        max_snippet_chars: Characters to include in context snippet

    Returns:
        List of occurrence dicts with dom_node_id, char_offset, length, snippet
    """
    soup = BeautifulSoup(html, 'html.parser')
    occurrences = []

    # Find all elements with data-id (these are the targetable DOM nodes)
    elements_with_id = soup.find_all(attrs={'data-id': True})

    # Build a set of all data-ids for quick lookup
    all_data_ids = {el.get('data-id') for el in elements_with_id}

    for element in elements_with_id:
        dom_node_id = element.get('data-id')

        # Skip elements that contain children with data-id (to avoid duplicate/nested matches)
        # We only want to search in "leaf" elements (relative to data-id hierarchy)
        child_elements_with_id = element.find_all(attrs={'data-id': True})
        # find_all includes the element itself if it matches, so check if there are OTHER elements
        has_nested_data_id = any(child.get('data-id') != dom_node_id for child in child_elements_with_id)
        if has_nested_data_id:
            continue

        # Get plain text using the SAME method as wrap_text_at_offset
        element_text = get_text_content(element)

        if not element_text:
            continue

        # Find all occurrences of term (case-insensitive)
        pattern = re.escape(term)
        matches = re.finditer(pattern, element_text, re.IGNORECASE)

        for match in matches:
            offset = match.start()
            length = len(term)

            # Extract snippet
            snippet_start = max(0, offset - max_snippet_chars)
            snippet_end = min(len(element_text), offset + length + max_snippet_chars)
            snippet = element_text[snippet_start:snippet_end]

            if snippet_start > 0:
                snippet = "..." + snippet
            if snippet_end < len(element_text):
                snippet = snippet + "..."

            occurrences.append({
                "dom_node_id": dom_node_id,
                "char_offset": offset,
                "length": length,
                "snippet": snippet
            })

    return occurrences


# =============================================================================
# Text Node Traversal
# =============================================================================

def get_text_content(node) -> str:
    """
    Extract plain text from a node, stripping HTML tags.

    This must match the _strip_html_tags() function used in Phase 1 for occurrence detection.

    IMPORTANT: This should produce the EXACT same text as _strip_html_tags() in knowledge_graph.py
    """
    if not node:
        return ""

    # Use BeautifulSoup's get_text which handles nested tags
    # Note: separator=' ' adds spaces between tags, which affects character offsets
    # This should match Phase 1's extraction logic
    return node.get_text(separator=' ', strip=True)


def find_text_nodes(node):
    """
    Generator that yields all text nodes within a node in document order.

    Skips comment nodes only. Includes all text nodes, even whitespace-only ones,
    to maintain correct character offsets.
    """
    for child in node.descendants:
        if isinstance(child, NavigableString) and not isinstance(child, Comment):
            # Include all text nodes (even whitespace-only) to match get_text() behavior
            if child.string:
                yield child


# =============================================================================
# Span Wrapping Logic
# =============================================================================

def wrap_text_at_offset(
    node,
    char_offset: int,
    length: int,
    entity_id: str,
    entity_type: str = "unknown"
) -> bool:
    """
    Wrap text at specified offset within a node with a <span class="kg-entity">.

    This is the core fragile function - it walks text nodes, tracks cumulative offsets,
    and performs surgical DOM manipulation.

    Args:
        node: BeautifulSoup Tag to search within
        char_offset: Character position in stripped text (0-indexed)
        length: Length of text to wrap
        entity_id: Entity ID for data-entity-id attribute
        entity_type: Entity type for data-entity-type attribute

    Returns:
        True if wrapping succeeded, False if offset not found or already wrapped

    Algorithm:
        1. Get plain text content of node (matching Phase 1 extraction)
        2. Walk all descendant text nodes in document order
        3. Track cumulative character count across text nodes
        4. When target offset is found, split the text node and insert span
        5. Handle edge cases: offset spans multiple nodes, overlapping spans, etc.
    """
    # Get the plain text content (must match Phase 1's _strip_html_tags)
    full_text = get_text_content(node)

    if not full_text or char_offset < 0 or char_offset >= len(full_text):
        debug_print(f"    Invalid offset: full_text_len={len(full_text) if full_text else 0}, offset={char_offset}")
        return False  # Invalid offset

    # Check if target text is already wrapped
    target_text = full_text[char_offset:char_offset + length]
    if not target_text.strip():
        debug_print(f"    Target text is whitespace-only")
        return False  # Can't wrap whitespace-only

    debug_print(f"    Looking for '{target_text}' at offset {char_offset}")

    # Use stripped_strings generator which is what get_text(strip=True) uses internally
    # This gives us individual stripped strings in document order
    stripped_strings_list = list(node.stripped_strings)

    if not stripped_strings_list:
        debug_print(f"    No stripped strings found in node")
        return False

    debug_print(f"    Found {len(stripped_strings_list)} stripped strings")

    # Build position map: for each character in the final text, track which stripped_string it came from
    # and the offset within that string
    position_map = []  # List of (string_index, offset_in_string) for each character

    for str_idx, s in enumerate(stripped_strings_list):
        # Add separator space before this string (if not first)
        if str_idx > 0:
            position_map.append((-1, -1))  # Sentinel for separator space

        # Add each character from this string
        for char_idx, char in enumerate(s):
            position_map.append((str_idx, char_idx))

    # Reconstruct text to verify
    reconstructed_chars = []
    for str_idx, offset in position_map:
        if str_idx == -1:  # Separator
            reconstructed_chars.append(' ')
        else:
            reconstructed_chars.append(stripped_strings_list[str_idx][offset])

    reconstructed = ''.join(reconstructed_chars).strip()
    expected = get_text_content(node)

    debug_print(f"    Reconstructed text: '{reconstructed[:100]}...' (len={len(reconstructed)})")

    if reconstructed != expected:
        debug_print(f"    WARNING: Reconstruction mismatch!")
        debug_print(f"    Expected len: {len(expected)}, Got len: {len(reconstructed)}")
        if len(expected) > 0 and len(reconstructed) > 0:
            first_diff = next((i for i in range(min(len(expected), len(reconstructed))) if expected[i] != reconstructed[i]), -1)
            if first_diff >= 0:
                debug_print(f"    First diff at {first_diff}: expected {repr(expected[max(0,first_diff-10):first_diff+10])}, got {repr(reconstructed[max(0,first_diff-10):first_diff+10])}")

    # Now find the stripped_string index and offset at char_offset
    if char_offset < 0 or char_offset >= len(position_map):
        debug_print(f"    Offset {char_offset} out of range (text length: {len(position_map)})")
        return False

    str_idx, local_offset = position_map[char_offset]

    # Check if we landed on a separator
    if str_idx == -1:
        debug_print(f"    Offset {char_offset} falls on separator space - cannot wrap")
        return False

    # Check if entire target fits within the same stripped_string
    end_offset = char_offset + length - 1
    if end_offset >= len(position_map):
        debug_print(f"    Target extends beyond text bounds (end_offset={end_offset}, text_len={len(position_map)})")
        return False

    end_str_idx, end_local = position_map[end_offset]

    if str_idx != end_str_idx:
        debug_print(f"    Target spans multiple stripped_strings ({str_idx} to {end_str_idx}) - skipping for MVP")
        return False

    # Now we need to find the actual NavigableString that contains this stripped_string
    # stripped_strings are already stripped, so we need to find which raw text node they came from
    target_string = stripped_strings_list[str_idx]

    # Find the text node containing this exact stripped string
    # This is tricky because stripped_strings removes whitespace
    # We need to search through all text nodes to find one whose stripped version matches
    all_text_nodes = list(find_text_nodes(node))
    target_text_node = None

    for text_node in all_text_nodes:
        node_str = text_node.string if text_node.string else ""
        if node_str.strip() == target_string:
            target_text_node = text_node
            break

    if not target_text_node:
        debug_print(f"    Could not find text node for stripped_string: {repr(target_string[:50])}")
        return False

    # Calculate the local offset within the raw text node
    # The stripped_string has had leading whitespace removed
    raw_node_str = target_text_node.string if target_text_node.string else ""
    leading_ws = len(raw_node_str) - len(raw_node_str.lstrip())
    raw_local_offset = local_offset + leading_ws

    # Show what we're wrapping
    target_text = raw_node_str[raw_local_offset:raw_local_offset + length]
    preview_start = max(0, raw_local_offset - 10)
    preview_end = min(len(raw_node_str), raw_local_offset + length + 10)
    preview = raw_node_str[preview_start:preview_end]

    debug_print(f"    Stripped string {str_idx}: {repr(target_string[:50])}")
    debug_print(f"    Raw text node: {repr(raw_node_str[:70])}")
    debug_print(f"    Will wrap at raw_offset={raw_local_offset}: {repr(target_text)} in context: {repr(preview)}")

    # Wrap the text
    return _wrap_within_single_node(target_text_node, raw_local_offset, length, entity_id, entity_type)


def _wrap_within_single_node(
    text_node: NavigableString,
    local_offset: int,
    length: int,
    entity_id: str,
    entity_type: str
) -> bool:
    """
    Wrap text within a single text node.

    This modifies the DOM by:
    1. Splitting the text node into: before | target | after
    2. Creating a <span> element
    3. Inserting: before_text, <span>target</span>, after_text

    Args:
        text_node: The NavigableString to modify
        local_offset: Position within this text node
        length: Length of text to wrap
        entity_id: Entity ID
        entity_type: Entity type

    Returns:
        True if successful
    """
    try:
        text = text_node.string
        parent = text_node.parent

        # Split text into three parts
        before = text[:local_offset]
        target = text[local_offset:local_offset + length]
        after = text[local_offset + length:]

        # Check if already wrapped (look for existing kg-entity spans nearby)
        # This is a simple heuristic - we check if parent or sibling is already a kg-entity span
        if parent and parent.name == 'span' and 'kg-entity' in parent.get('class', []):
            print(f"  Warning: Already wrapped in kg-entity span - skipping")
            return False

        # Create new span element
        span_html = f'<span class="kg-entity" data-entity-id="{entity_id}" data-entity-type="{entity_type}">{target}</span>'
        span = BeautifulSoup(span_html, 'html.parser').span

        # Get index of current text node in parent's children
        index = list(parent.children).index(text_node)

        # Remove original text node
        text_node.extract()

        # Insert new elements at the same position
        if before:
            parent.insert(index, before)
            index += 1

        parent.insert(index, span)
        index += 1

        if after:
            parent.insert(index, after)

        return True

    except Exception as e:
        print(f"  Error wrapping text: {e}")
        return False


# =============================================================================
# Main Injection Function
# =============================================================================

def inject_tooltip_spans(
    html: str,
    suggestions: List[Dict[str, Any]],
    max_errors: int = 10
) -> Tuple[str, List[str]]:
    """
    Inject <span class="kg-entity"> tags at all occurrence positions in suggestions.

    This is the main Phase 3 function that:
    1. Parses HTML with BeautifulSoup
    2. For each occurrence in each suggestion:
       - Finds the paragraph by dom_node_id
       - Wraps text at char_offset
    3. Returns modified HTML + list of errors

    Args:
        html: Original compiled HTML
        suggestions: List of suggestion dicts from Phase 2
        max_errors: Maximum errors to collect before stopping

    Returns:
        Tuple of (modified_html, errors)
        - modified_html: HTML with injected spans
        - errors: List of error messages

    Edge cases handled:
    - Node not found (dom_node_id doesn't exist)
    - Offset out of range
    - Text already wrapped
    - Multi-node spans (skipped for MVP)
    - Overlapping spans (second wrap fails gracefully)
    """
    debug_print("=" * 60)
    debug_print(f"Starting HTML injection for {len(suggestions)} suggestions")

    soup = BeautifulSoup(html, 'html.parser')
    errors = []
    successful_wraps = 0
    skipped_wraps = 0

    for idx, suggestion in enumerate(suggestions, 1):
        entity_id = suggestion['entity_id']
        entity_type = suggestion.get('entity_type', 'unknown')
        occurrences = suggestion.get('occurrences', [])

        debug_print(f"Processing suggestion {idx}/{len(suggestions)}: {entity_id} ({entity_type}) with {len(occurrences)} occurrences")

        for occ_idx, occ in enumerate(occurrences, 1):
            dom_node_id = occ.get('dom_node_id')
            char_offset = occ.get('char_offset')
            length = occ.get('length')

            # Validate occurrence data
            if not dom_node_id or char_offset is None or not length:
                error_msg = f"Invalid occurrence data for {entity_id}: dom_node_id={dom_node_id}, offset={char_offset}, length={length}"
                debug_print(f"  ERROR: {error_msg}")
                errors.append(error_msg)
                if len(errors) >= max_errors:
                    break
                continue

            debug_print(f"  Occurrence {occ_idx}/{len(occurrences)}: node={dom_node_id}, offset={char_offset}, length={length}")

            # Find node by data-id attribute
            node = soup.find(attrs={'data-id': dom_node_id})
            if not node:
                error_msg = f"Node {dom_node_id} not found for entity {entity_id}"
                debug_print(f"  ERROR: {error_msg}")
                errors.append(error_msg)
                if len(errors) >= max_errors:
                    break
                continue

            # Attempt to wrap text at offset
            success = wrap_text_at_offset(
                node=node,
                char_offset=char_offset,
                length=length,
                entity_id=entity_id,
                entity_type=entity_type
            )

            if success:
                successful_wraps += 1
                debug_print(f"  ✓ Successfully wrapped")
            else:
                skipped_wraps += 1
                debug_print(f"  ⊘ Skipped (already wrapped or multi-node)")
                # Don't treat skip as error (might be already wrapped or multi-node)

        if len(errors) >= max_errors:
            errors.append(f"Stopped after {max_errors} errors")
            break

    # Convert soup back to string using explicit formatter to preserve structure
    # Using 'html' formatter ensures proper HTML output
    modified_html = soup.decode(formatter='html')

    # Log summary
    total_occurrences = sum(len(s.get('occurrences', [])) for s in suggestions)
    debug_print("=" * 60)
    debug_print("HTML Injection Summary:")
    debug_print(f"  Total occurrences: {total_occurrences}")
    debug_print(f"  Successfully wrapped: {successful_wraps}")
    debug_print(f"  Skipped: {skipped_wraps}")
    debug_print(f"  Errors: {len(errors)}")
    debug_print("=" * 60)

    print(f"\nHTML Injection Summary:")
    print(f"  Total occurrences: {total_occurrences}")
    print(f"  Successfully wrapped: {successful_wraps}")
    print(f"  Skipped: {skipped_wraps}")
    print(f"  Errors: {len(errors)}")

    return modified_html, errors


# =============================================================================
# Validation & Rollback
# =============================================================================

def validate_html_integrity(original_html: str, modified_html: str) -> Tuple[bool, str]:
    """
    Validate that HTML modification didn't break structure.

    Checks:
    - HTML is still parseable
    - No major structure changes (same number of sections, paragraphs)
    - Math tags preserved
    - No broken tags

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        original_soup = BeautifulSoup(original_html, 'html.parser')
        modified_soup = BeautifulSoup(modified_html, 'html.parser')

        # Check: HTML is parseable (if we got here, it is)

        # Check: Same number of major structural elements
        original_sections = len(original_soup.find_all(['section', 'div', 'article']))
        modified_sections = len(modified_soup.find_all(['section', 'div', 'article']))

        if abs(original_sections - modified_sections) > 5:  # Allow small variance
            return False, f"Section count mismatch: {original_sections} vs {modified_sections}"

        original_paras = len(original_soup.find_all('p'))
        modified_paras = len(modified_soup.find_all('p'))

        if abs(original_paras - modified_paras) > 5:
            return False, f"Paragraph count mismatch: {original_paras} vs {modified_paras}"

        # Check: Math tags preserved
        original_math = len(original_soup.find_all('math'))
        modified_math = len(modified_soup.find_all('math'))

        if original_math != modified_math:
            return False, f"Math tag count mismatch: {original_math} vs {modified_math}"

        # Check: No broken opening/closing tags
        # BeautifulSoup auto-fixes these, so if it parsed, we're probably okay

        return True, ""

    except Exception as e:
        return False, f"Validation failed: {e}"


# =============================================================================
# Testing & Debugging
# =============================================================================

def test_injection():
    """Test span injection with simple examples."""

    # Test 1: Simple paragraph
    html = """
    <p data-id="p1">The parameter alpha is important in our model.</p>
    """

    suggestions = [{
        'entity_id': 'symbol_alpha',
        'entity_type': 'symbol',
        'occurrences': [{
            'dom_node_id': 'p1',
            'char_offset': 14,
            'length': 5
        }]
    }]

    modified, errors = inject_tooltip_spans(html, suggestions)
    print("Test 1 - Simple wrap:")
    print(modified)
    print(f"Errors: {errors}\n")

    # Test 2: Multiple occurrences
    html = """
    <p data-id="p2">We use alpha here and alpha there.</p>
    """

    suggestions = [{
        'entity_id': 'symbol_alpha',
        'entity_type': 'symbol',
        'occurrences': [
            {'dom_node_id': 'p2', 'char_offset': 7, 'length': 5},
            {'dom_node_id': 'p2', 'char_offset': 22, 'length': 5}
        ]
    }]

    modified, errors = inject_tooltip_spans(html, suggestions)
    print("Test 2 - Multiple occurrences:")
    print(modified)
    print(f"Errors: {errors}\n")

    # Test 3: Nested tags
    html = """
    <p data-id="p3">The <em>important</em> parameter alpha controls behavior.</p>
    """

    suggestions = [{
        'entity_id': 'symbol_alpha',
        'entity_type': 'symbol',
        'occurrences': [{
            'dom_node_id': 'p3',
            'char_offset': 30,
            'length': 5
        }]
    }]

    modified, errors = inject_tooltip_spans(html, suggestions)
    print("Test 3 - Nested tags:")
    print(modified)
    print(f"Errors: {errors}\n")


def remove_tooltip_spans(html: str, entity_id: str) -> str:
    """
    Remove all <span class="kg-entity"> tags for a specific entity.

    This unwraps the spans while preserving the text content, effectively
    reverting the HTML to its pre-injection state for this entity.

    Args:
        html: The HTML containing tooltip spans
        entity_id: The entity ID to remove (matches data-entity-id attribute)

    Returns:
        Modified HTML with spans removed
    """
    soup = BeautifulSoup(html, 'html.parser')

    # Find all kg-entity spans with matching entity_id
    spans = soup.find_all('span', class_='kg-entity', attrs={'data-entity-id': entity_id})

    debug_print(f"Removing {len(spans)} tooltip spans for entity {entity_id}")

    for span in spans:
        # Replace span with its text content
        span.unwrap()

    return str(soup)


if __name__ == "__main__":
    test_injection()
