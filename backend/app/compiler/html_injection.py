"""
HTML Span Utilities for Semantic Tooltips

Provides utility functions for managing tooltip spans in compiled HTML:
- remove_tooltip_spans: Remove spans for a specific entity
- validate_html_integrity: Validate HTML structure after modification

Note: Span injection is now handled by ai_html_injection.py using LLM-based approach.
"""

from typing import Tuple
from bs4 import BeautifulSoup


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

    for span in spans:
        try:
            # Replace span with its text content
            span.unwrap()
        except Exception as e:
            print(f"Warning: Failed to unwrap span for entity {entity_id}: {e}")
            # If unwrap fails, try to at least remove the span and keep its text
            if span.parent:
                span.replace_with(span.get_text())

    return soup.decode(formatter='html')


def validate_html_integrity(original_html: str, modified_html: str) -> Tuple[bool, str]:
    """
    Validate that HTML modification didn't break structure.

    Checks:
    - HTML is still parseable
    - No major structure changes (same number of sections, paragraphs)
    - Math tags preserved

    Args:
        original_html: The original HTML before modification
        modified_html: The HTML after modification

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        original_soup = BeautifulSoup(original_html, 'html.parser')
        modified_soup = BeautifulSoup(modified_html, 'html.parser')

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

        return True, ""

    except Exception as e:
        return False, f"Validation failed: {e}"
