"""
AI-powered HTML Span Injection Agent

Uses LangGraph workflow with Claude to inject <span class="kg-entity"> tags into HTML.
This agent processes sections in sequence, using structured outputs for reliable span placement.

Pipeline:
1. Initialize - Parse HTML and prepare entity list
2. Process Sections - For each section, use LLM to inject spans
3. Validate & Apply - Validate text integrity and apply changes
4. Finalize - Return modified HTML with injection stats
"""

import os
import re
from typing import TypedDict, List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from bs4 import BeautifulSoup

from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate

# Import shared utilities from knowledge_graph agent
from backend.app.agents.knowledge_graph import (
    run_with_retry,
    TimeoutException,
)

load_dotenv()


# =============================================================================
# State Schema
# =============================================================================

class InjectionState(TypedDict):
    """Shared state for HTML injection workflow"""
    # Input
    html_content: str
    sections_data: List[Dict[str, Any]]
    suggestions: List[Dict[str, Any]]

    # Processed entity list
    entities: List[Dict[str, str]]

    # Tracking
    current_html: str
    sections_processed: int
    sections_total: int

    # Output
    modified_html: str
    injection_count: int
    errors: List[str]


# =============================================================================
# Pydantic Models for Structured Output
# =============================================================================

class SpanInjection(BaseModel):
    """A single span injection location"""
    original_text: str = Field(
        description="The exact text fragment to wrap (must match exactly in the HTML)"
    )
    entity_id: str = Field(
        description="The entity_id to use in data-entity-id attribute"
    )
    entity_type: str = Field(
        description="The entity_type to use in data-entity-type attribute"
    )


class SectionInjectionOutput(BaseModel):
    """Output from section injection - list of spans to inject"""
    injections: List[SpanInjection] = Field(
        default_factory=list,
        description="List of text spans to wrap with kg-entity tags"
    )
    reasoning: str = Field(
        description="Brief explanation of which terms were found and wrapped"
    )


# =============================================================================
# Prompt Templates
# =============================================================================

INJECTION_SYSTEM_PROMPT = """You are an HTML annotation assistant. Your task is to identify text spans in HTML content that should be wrapped with semantic annotation tags.

You will be given:
1. HTML content from a research paper section
2. A list of entities (terms) to find and annotate

For each entity term that appears in the TEXT CONTENT of the HTML:
1. Find the exact text as it appears (case-insensitive matching is OK, but return the exact text from the HTML)
2. Report it for annotation with the corresponding entity_id and entity_type

IMPORTANT RULES:
- Only match terms in the visible TEXT content, not in HTML attributes or tag names
- Do NOT match text inside <math>, <mi>, <mo>, <annotation> or other MathML tags
- Do NOT match text that is already inside a <span class="kg-entity"> tag
- Match whole words/phrases only (don't match "the" inside "theorem")
- Return the EXACT text as it appears in the HTML (preserve case)
- If a term appears multiple times, report each occurrence separately

Example:
If looking for "gradient descent" in "We use Gradient Descent for optimization. The gradient descent method..."
Report two injections:
1. original_text: "Gradient Descent", entity_id: "def_gradient_descent", entity_type: "definition"
2. original_text: "gradient descent", entity_id: "def_gradient_descent", entity_type: "definition"
"""

INJECTION_USER_PROMPT = """HTML Content:
```html
{html_content}
```

Entities to find and annotate:
{entity_list}

Find all occurrences of these entity terms in the text content and report them for annotation."""


# =============================================================================
# Agent Functions
# =============================================================================

def _strip_html_tags(html: str) -> str:
    """Remove HTML tags from text for cleaner content."""
    if not html:
        return ""
    soup = BeautifulSoup(html, 'html.parser')
    return soup.get_text(separator=' ', strip=True)


def initialize_injection(state: InjectionState) -> InjectionState:
    """
    Initialize the injection workflow.

    Prepares entity list and validates inputs.
    """
    print(f"[HTML Injection] Initializing...")

    # Build entity list from suggestions
    entities = []
    for s in state["suggestions"]:
        label = s.get("entity_label")
        if label and len(label) >= 2:  # Skip single-char entities
            entities.append({
                "label": label,
                "entity_id": s.get("entity_id", ""),
                "entity_type": s.get("entity_type", "unknown")
            })

    # Count processable sections using text length (same as knowledge_graph.py)
    sections_total = sum(
        1 for s in state["sections_data"]
        if len(_strip_html_tags(s.get("content_html", ""))) >= 50
    )

    print(f"[HTML Injection] Found {len(entities)} entities to inject across {sections_total} sections")

    return {
        **state,
        "entities": entities,
        "current_html": state["html_content"],
        "sections_processed": 0,
        "sections_total": sections_total,
        "injection_count": 0,
        "errors": [],
    }


def process_sections(state: InjectionState) -> InjectionState:
    """
    Process all sections using LLM to identify injection points.

    For each section:
    1. Extract content_html and convert to plain text for LLM
    2. Use LLM to find entity occurrences
    3. Apply injections directly to the parsed HTML DOM
    """
    if not state["entities"]:
        print("[HTML Injection] No entities to inject, skipping")
        return {
            **state,
            "modified_html": state["current_html"],
        }

    llm = ChatAnthropic(
        model=os.getenv("HTML_INJECTION_MODEL", "claude-haiku-4-5-20251001"),
        max_tokens=8000,
    )
    structured_llm = llm.with_structured_output(SectionInjectionOutput)

    prompt = ChatPromptTemplate.from_messages([
        ("system", INJECTION_SYSTEM_PROMPT),
        ("user", INJECTION_USER_PROMPT)
    ])

    chain = prompt | structured_llm

    # Format entity list for prompt
    entity_list_str = "\n".join(
        f"- Term: \"{e['label']}\" → entity_id: \"{e['entity_id']}\", entity_type: \"{e['entity_type']}\""
        for e in state["entities"]
    )

    # Parse the full HTML document once - we'll modify this DOM directly
    soup = BeautifulSoup(state["current_html"], 'html.parser')

    errors = list(state["errors"])
    total_injections = 0
    sections_processed = 0

    debug = os.getenv("HTML_INJECTION_DEBUG", "false").lower() == "true"

    # Filter sections the same way knowledge_graph.py does
    sections_to_process = [
        s for s in state["sections_data"]
        if len(_strip_html_tags(s.get("content_html", ""))) >= 50
    ]

    print(f"[HTML Injection] Processing {len(sections_to_process)} sections with content...")

    for idx, section in enumerate(sections_to_process, 1):
        content_html = section.get("content_html", "")
        section_title = section.get("title", "Untitled")[:40]
        section_id = section.get("id", "")

        # Get plain text for LLM (same as knowledge_graph.py)
        content_text = _strip_html_tags(content_html)

        sections_processed += 1

        print(f"[HTML Injection] [{sections_processed}/{len(sections_to_process)}] {section_title}...", end=" ", flush=True)

        if debug:
            print(f"\n  Section ID: {section_id}")
            print(f"  Content preview ({len(content_text)} chars): {content_text[:150]}...")
            print(f"  Looking for entities: {[e['label'] for e in state['entities']]}")

        try:
            # Call LLM with plain text (simpler and more reliable)
            invoke_args = {
                "html_content": content_html[:12000],
                "entity_list": entity_list_str,
            }

            if debug:
                print(f"  Calling LLM...")

            response = run_with_retry(
                func=chain.invoke,
                max_retries=2,
                base_delay=1.0,
                timeout_seconds=60,
                func_args=(invoke_args,)
            )

            if debug:
                print(f"  LLM response: {len(response.injections)} injections")
                if response.reasoning:
                    print(f"  Reasoning: {response.reasoning[:150]}...")

            if not response.injections:
                print("(no matches)")
                continue

            if debug:
                print(f"  Injections to apply:")
                for inj in response.injections:
                    print(f"    - \"{inj.original_text}\" → {inj.entity_id}")

            # Apply injections directly to the soup DOM
            injection_count = _apply_injections_to_soup(
                soup,
                section_id,
                response.injections,
                debug
            )

            if injection_count > 0:
                total_injections += injection_count
                print(f"✓ ({injection_count} spans)")
            else:
                print("(no valid injections)")

        except TimeoutException:
            errors.append(f"Section '{section_title}': Timeout during LLM call")
            print("⏱ timeout")
        except Exception as e:
            errors.append(f"Section '{section_title}': {str(e)}")
            print(f"✗ error: {e}")
            if debug:
                import traceback
                traceback.print_exc()

    # Serialize the modified DOM back to HTML
    modified_html = str(soup)

    print(f"[HTML Injection] Complete: {total_injections} spans injected, {len(errors)} errors")

    return {
        **state,
        "current_html": modified_html,
        "modified_html": modified_html,
        "sections_processed": sections_processed,
        "injection_count": total_injections,
        "errors": errors,
    }


def _apply_injections_to_soup(
    soup: BeautifulSoup,
    section_id: str,
    injections: List[SpanInjection],
    debug: bool = False
) -> int:
    """
    Apply span injections directly to the BeautifulSoup DOM.

    This modifies the soup in-place, searching the entire document
    for text matches and wrapping them with kg-entity spans.

    Args:
        soup: The BeautifulSoup object to modify (modified in-place)
        section_id: The section ID (for scoping, currently unused but available)
        injections: List of SpanInjection objects from the LLM
        debug: Whether to print debug info

    Returns:
        Number of successful injections
    """
    count = 0

    # Sort injections by length (longest first) to avoid partial replacements
    sorted_injections = sorted(injections, key=lambda x: len(x.original_text), reverse=True)

    # Track already-wrapped text to avoid double-wrapping
    wrapped_texts = set()

    for injection in sorted_injections:
        original = injection.original_text

        if not original or len(original) < 2:
            if debug:
                print(f"    Skipping too short: \"{original}\"")
            continue

        # Skip if we've already wrapped this text
        if original.lower() in wrapped_texts:
            if debug:
                print(f"    Skipping already processed: \"{original}\"")
            continue

        # Find and wrap all occurrences in the DOM
        injection_count = _wrap_text_in_soup(
            soup,
            original,
            injection.entity_id,
            injection.entity_type,
            debug
        )

        if injection_count > 0:
            count += injection_count
            wrapped_texts.add(original.lower())
            if debug:
                print(f"    Applied {injection_count}x: \"{original}\"")
        else:
            if debug:
                print(f"    No matches found for: \"{original}\"")

    return count


def _wrap_text_in_soup(
    soup: BeautifulSoup,
    text: str,
    entity_id: str,
    entity_type: str,
    debug: bool = False
) -> int:
    """
    Find and wrap all occurrences of text in the soup with kg-entity spans.

    Args:
        soup: BeautifulSoup object to modify in-place
        text: The text to find and wrap
        entity_id: Entity ID for the span
        entity_type: Entity type for the span
        debug: Whether to print debug info

    Returns:
        Number of wrappings performed
    """
    count = 0

    # We need to iterate carefully because we're modifying the tree
    # Find all text nodes, then process them
    # Use list() to avoid iterator invalidation
    text_nodes = list(soup.find_all(string=True))

    for text_node in text_nodes:
        # Skip if inside problematic elements
        parent = text_node.parent
        if not parent:
            continue

        if parent.name in ['script', 'style', 'math', 'annotation', 'mi', 'mo', 'mn', 'mtext', 'mrow']:
            continue

        # Skip if already inside a kg-entity span
        if parent.name == 'span' and 'kg-entity' in parent.get('class', []):
            continue

        # Check ancestors too - don't wrap if any ancestor is kg-entity or math
        dominated_by_skip = False
        for ancestor in parent.parents:
            if ancestor.name == 'math':
                dominated_by_skip = True
                break
            if ancestor.name == 'span' and 'kg-entity' in ancestor.get('class', []):
                dominated_by_skip = True
                break
        if dominated_by_skip:
            continue

        # Check if this text node contains our target (case-insensitive)
        node_text = str(text_node)
        if text.lower() not in node_text.lower():
            continue

        # Find all occurrences (case-insensitive but preserve original case)
        pattern = re.compile(re.escape(text), re.IGNORECASE)
        matches = list(pattern.finditer(node_text))

        if not matches:
            continue

        # Build replacement HTML by processing matches from end to start
        new_text = node_text
        for match in reversed(matches):
            matched_text = match.group()
            span_html = f'<span class="kg-entity" data-entity-id="{entity_id}" data-entity-type="{entity_type}">{matched_text}</span>'
            new_text = new_text[:match.start()] + span_html + new_text[match.end():]
            count += 1

        # Replace the text node with the new HTML
        new_soup = BeautifulSoup(new_text, 'html.parser')
        text_node.replace_with(new_soup)

    return count


def finalize_injection(state: InjectionState) -> InjectionState:
    """
    Finalize the injection workflow.

    Ensures modified_html is set and logs summary.
    """
    print(f"\n[HTML Injection] Summary:")
    print(f"  Sections processed: {state['sections_processed']}/{state['sections_total']}")
    print(f"  Spans injected: {state['injection_count']}")
    print(f"  Errors: {len(state['errors'])}")

    return state


# =============================================================================
# LangGraph Workflow
# =============================================================================

def create_injection_workflow() -> StateGraph:
    """Create the LangGraph workflow for HTML span injection."""
    workflow = StateGraph(InjectionState)

    # Add nodes
    workflow.add_node("initialize", initialize_injection)
    workflow.add_node("process_sections", process_sections)
    workflow.add_node("finalize", finalize_injection)

    # Define edges (sequential pipeline)
    workflow.set_entry_point("initialize")
    workflow.add_edge("initialize", "process_sections")
    workflow.add_edge("process_sections", "finalize")
    workflow.add_edge("finalize", END)

    return workflow


# =============================================================================
# Public API
# =============================================================================

def inject_spans_with_ai(
    html_content: str,
    sections_data: List[Dict[str, Any]],
    suggestions: List[Dict[str, Any]]
) -> Tuple[str, List[str]]:
    """
    Inject <span class="kg-entity"> tags using AI model.

    This is the main entry point, compatible with the existing API.

    Args:
        html_content: The full HTML document to modify
        sections_data: List of section dicts with 'content_html' and 'id' fields
        suggestions: List of entity dicts with entity_id, entity_label, entity_type

    Returns:
        Tuple of (modified_html, errors)
    """
    if not html_content:
        return html_content, ["No HTML content provided"]

    if not suggestions:
        return html_content, []

    workflow = create_injection_workflow()
    app = workflow.compile()

    initial_state: InjectionState = {
        "html_content": html_content,
        "sections_data": sections_data or [],
        "suggestions": suggestions,
        "entities": [],
        "current_html": "",
        "sections_processed": 0,
        "sections_total": 0,
        "modified_html": "",
        "injection_count": 0,
        "errors": [],
    }

    result = app.invoke(initial_state)

    return result["modified_html"] or html_content, result["errors"]


# =============================================================================
# CLI for Testing
# =============================================================================

if __name__ == "__main__":
    # Simple test
    test_html = """
    <div>
        <p data-id="p1">The gradient descent algorithm is widely used in machine learning.</p>
        <p data-id="p2">We apply gradient descent to minimize the loss function.</p>
    </div>
    """

    test_sections = [
        {
            "id": "sec1",
            "title": "Introduction",
            "content_html": '<p data-id="p1">The gradient descent algorithm is widely used in machine learning.</p>\n<p data-id="p2">We apply gradient descent to minimize the loss function.</p>'
        }
    ]

    test_suggestions = [
        {
            "entity_id": "def_gradient_descent",
            "entity_label": "gradient descent",
            "entity_type": "definition"
        },
        {
            "entity_id": "def_loss_function",
            "entity_label": "loss function",
            "entity_type": "definition"
        }
    ]

    print("Testing HTML injection agent...")
    modified, errors = inject_spans_with_ai(test_html, test_sections, test_suggestions)

    print("\nOriginal HTML:")
    print(test_html)
    print("\nModified HTML:")
    print(modified)
    print(f"\nErrors: {errors}")
