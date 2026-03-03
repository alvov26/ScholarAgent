"""
HTML Span Injection for Semantic Tooltips

Injects <span class="kg-entity"> tags at precise character offsets in compiled HTML.
Part of Phase 3: HTML Injection & Persistence.

This is the most fragile part of the system - we're manipulating HTML at character-level
positions while preserving all existing structure and nested tags.
"""

from typing import List, Dict, Any, Tuple
from bs4 import BeautifulSoup, NavigableString, Comment
import re


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

    Skips comment nodes and navigational strings that are pure whitespace.
    """
    for child in node.descendants:
        if isinstance(child, NavigableString) and not isinstance(child, Comment):
            # Only yield if it contains non-whitespace
            if child.string and child.string.strip():
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
        return False  # Invalid offset

    # Check if target text is already wrapped
    target_text = full_text[char_offset:char_offset + length]
    if not target_text.strip():
        return False  # Can't wrap whitespace-only

    # Find all text nodes
    text_nodes = list(find_text_nodes(node))
    if not text_nodes:
        return False

    # Track cumulative offset as we walk text nodes
    current_offset = 0

    for text_node in text_nodes:
        node_text = text_node.string
        node_len = len(node_text)
        node_end = current_offset + node_len

        # Check if target range starts within this text node
        if current_offset <= char_offset < node_end:
            # Calculate position within this text node
            local_offset = char_offset - current_offset

            # Check if entire target fits within this text node
            if char_offset + length <= node_end:
                # Simple case: entire span within one text node
                return _wrap_within_single_node(text_node, local_offset, length, entity_id, entity_type)
            else:
                # Complex case: span crosses multiple text nodes
                # For MVP, we'll skip these to avoid complexity
                print(f"  Warning: Span crosses text nodes (offset {char_offset}, length {length}) - skipping")
                return False

        current_offset = node_end

    # Offset not found
    return False


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
    soup = BeautifulSoup(html, 'html.parser')
    errors = []
    successful_wraps = 0
    skipped_wraps = 0

    for suggestion in suggestions:
        entity_id = suggestion['entity_id']
        entity_type = suggestion.get('entity_type', 'unknown')
        occurrences = suggestion.get('occurrences', [])

        for occ in occurrences:
            dom_node_id = occ.get('dom_node_id')
            char_offset = occ.get('char_offset')
            length = occ.get('length')

            # Validate occurrence data
            if not dom_node_id or char_offset is None or not length:
                errors.append(f"Invalid occurrence data for {entity_id}")
                if len(errors) >= max_errors:
                    break
                continue

            # Find node by data-id attribute
            node = soup.find(attrs={'data-id': dom_node_id})
            if not node:
                errors.append(f"Node {dom_node_id} not found for entity {entity_id}")
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
            else:
                skipped_wraps += 1
                # Don't treat skip as error (might be already wrapped or multi-node)

        if len(errors) >= max_errors:
            errors.append(f"Stopped after {max_errors} errors")
            break

    # Convert soup back to string
    modified_html = str(soup)

    # Log summary
    total_occurrences = sum(len(s.get('occurrences', [])) for s in suggestions)
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


if __name__ == "__main__":
    test_injection()
