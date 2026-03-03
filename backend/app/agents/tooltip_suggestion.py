"""
Tooltip Suggestion Agent

Filters knowledge graph entities based on user expertise and generates tooltip content.
Part of Phase 2: Semantic Tooltips implementation.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate


# =============================================================================
# Pydantic Models for Structured Output
# =============================================================================

class FilterOutput(BaseModel):
    """Output from entity filtering agent"""
    selected_entity_ids: List[str] = Field(description="IDs of entities that should have tooltips")
    reasoning: Optional[str] = Field(default=None, description="Brief explanation of filtering decisions")


# =============================================================================
# Filtering Agent
# =============================================================================

FILTER_SYSTEM_PROMPT = """You are an academic paper annotation assistant.
Your job is to select which terms from a knowledge graph should have tooltips,
based on the reader's expertise level.

Guidelines by expertise level:

BEGINNER:
- Annotate most technical terms, mathematical symbols, and domain-specific concepts
- Skip only universal terms everyone knows (e.g., "number", "set", "function" in basic contexts)
- Include standard mathematical notation if it has specific meaning in this paper
- Goal: Help reader build foundational understanding

INTERMEDIATE:
- Annotate domain-specific jargon, paper-specific notation, and novel concepts
- Skip common terms from undergraduate education in the field
- Include specialized methods, algorithms, or mathematical objects
- Goal: Bridge gap between general knowledge and paper-specific contributions

EXPERT:
- Annotate only paper-specific innovations, novel notation, or redefined concepts
- Skip standard terminology and well-known results from the literature
- Include only terms that are unique to this paper or used in non-standard ways
- Goal: Highlight what's new or different in this work

Important:
- Be selective but not too aggressive - better to over-annotate than miss important terms
- Consider the context: a common term used in an unusual way should be annotated
- Mathematical symbols are often worth annotating even for experts (unless trivial like i, j, k)
"""

FILTER_USER_PROMPT = """User expertise level: {expertise_level}

Knowledge graph entities from the paper:

SYMBOLS:
{symbols_list}

DEFINITIONS:
{definitions_list}

THEOREMS:
{theorems_list}

Based on the user's expertise level, select which entities should have tooltips.

Return a JSON object with:
- selected_entity_ids: array of entity IDs to annotate
- reasoning: brief explanation (optional)

Example:
{{
  "selected_entity_ids": ["symbol_alpha_t", "def_ELBO", "thm_3.2"],
  "reasoning": "For intermediate users, focusing on paper-specific notation and key theoretical results"
}}
"""


def filter_entities_by_expertise(
    entities: List[Dict[str, Any]],
    expertise_level: str
) -> List[Dict[str, Any]]:
    """
    Use LLM to filter entities based on user expertise.

    Args:
        entities: List of all KG nodes (symbols, definitions, theorems)
        expertise_level: "beginner" | "intermediate" | "expert"

    Returns:
        Filtered list of entities that should have tooltips
    """
    if not entities:
        return []

    # Validate expertise level
    valid_levels = ["beginner", "intermediate", "expert"]
    if expertise_level not in valid_levels:
        expertise_level = "intermediate"  # Default fallback

    # Group entities by type for better prompt formatting
    symbols = [e for e in entities if e.get('type') == 'symbol']
    definitions = [e for e in entities if e.get('type') == 'definition']
    theorems = [e for e in entities if e.get('type') == 'theorem']

    # Format entity lists for prompt
    def format_symbols(symbols_list):
        return "\n".join([
            f"- {s['id']}: {s.get('symbol', s.get('label', ''))} - {s.get('context', '')[:100]}"
            for s in symbols_list[:50]  # Limit to avoid token overflow
        ]) or "(none)"

    def format_definitions(defs_list):
        return "\n".join([
            f"- {d['id']}: {d.get('term', d.get('label', ''))} - {d.get('summary', d.get('definition_text', ''))[:100]}"
            for d in defs_list[:50]
        ]) or "(none)"

    def format_theorems(thms_list):
        return "\n".join([
            f"- {t['id']}: {t.get('label', '')} - {t.get('summary', t.get('statement', ''))[:100]}"
            for t in thms_list[:50]
        ]) or "(none)"

    symbols_text = format_symbols(symbols)
    definitions_text = format_definitions(definitions)
    theorems_text = format_theorems(theorems)

    # Create prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", FILTER_SYSTEM_PROMPT),
        ("user", FILTER_USER_PROMPT)
    ])

    # Call LLM with structured output
    llm = ChatAnthropic(model="claude-sonnet-4-5-20250929")
    structured_llm = llm.with_structured_output(FilterOutput)

    chain = prompt | structured_llm

    try:
        response = chain.invoke({
            "expertise_level": expertise_level,
            "symbols_list": symbols_text,
            "definitions_list": definitions_text,
            "theorems_list": theorems_text
        })

        # Filter entities by selected IDs
        selected_ids = set(response.selected_entity_ids)
        filtered = [e for e in entities if e.get('id') in selected_ids]

        print(f"  Filtering: {len(entities)} entities → {len(filtered)} selected (expertise: {expertise_level})")
        if response.reasoning:
            print(f"  Reasoning: {response.reasoning}")

        return filtered

    except Exception as e:
        print(f"  Warning: Entity filtering failed ({e}), returning all entities")
        # Fallback: return all entities if filtering fails
        return entities


# =============================================================================
# Tooltip Content Generation
# =============================================================================

def generate_tooltip_content(entity: Dict[str, Any]) -> str:
    """
    Generate tooltip content from KG node data.

    Phase 1 (MVP): Simple template from KG fields
    Phase 2 (Future): Add LLM refinement for clarity

    Args:
        entity: KG node dict with fields like label, context, definition_text, statement

    Returns:
        Tooltip content string (plain text or markdown)
    """
    entity_type = entity.get('type', '')

    if entity_type == 'symbol':
        # For symbols: use context field
        context = entity.get('context', '')
        if context:
            return context
        else:
            return f"Mathematical symbol: {entity.get('label', entity.get('symbol', ''))}"

    elif entity_type == 'definition':
        # For definitions: use summary (concise) or definition_text (detailed)
        summary = entity.get('summary', '')
        definition_text = entity.get('definition_text', '')

        if summary and definition_text:
            # Use summary as primary, with option to see full definition
            return f"{summary}\n\nFull definition: {definition_text}"
        elif summary:
            return summary
        elif definition_text:
            return definition_text
        else:
            return f"Definition of {entity.get('label', entity.get('term', ''))}"

    elif entity_type == 'theorem':
        # For theorems: use summary with reference to full statement
        summary = entity.get('summary', '')
        statement = entity.get('statement', '')
        theorem_label = entity.get('label', f"{entity.get('type', 'Theorem')} {entity.get('number', '')}")

        if summary:
            content = f"{theorem_label}: {summary}"
            if statement and len(statement) < 200:
                # Include statement if it's short enough
                content += f"\n\nStatement: {statement}"
            return content
        elif statement:
            return f"{theorem_label}: {statement}"
        else:
            return theorem_label

    else:
        # Fallback for unknown types
        return entity.get('context', entity.get('summary', entity.get('label', 'See knowledge graph')))


# =============================================================================
# Main Suggestion Function
# =============================================================================

def suggest_tooltips(
    knowledge_graph: Dict[str, Any],
    user_expertise: str,
    entity_type_filter: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Main function to suggest tooltips based on knowledge graph.

    Args:
        knowledge_graph: The KG dict from paper.knowledge_graph
        user_expertise: "beginner" | "intermediate" | "expert"
        entity_type_filter: Optional list of types to include (e.g., ["symbol", "definition"])

    Returns:
        Dict with:
        - suggestions: List of TooltipSuggestion dicts
        - total_entities: Total count before filtering
        - suggested_count: Count after filtering
    """
    if not knowledge_graph or 'nodes' not in knowledge_graph:
        return {
            "suggestions": [],
            "total_entities": 0,
            "suggested_count": 0
        }

    all_entities = knowledge_graph['nodes']
    total_count = len(all_entities)

    # Apply type filter if specified
    if entity_type_filter:
        entities_to_consider = [
            e for e in all_entities
            if e.get('type') in entity_type_filter
        ]
    else:
        entities_to_consider = all_entities

    # Filter by expertise
    filtered_entities = filter_entities_by_expertise(entities_to_consider, user_expertise)

    # Generate suggestions
    suggestions = []
    for entity in filtered_entities:
        # Generate tooltip content
        tooltip_content = generate_tooltip_content(entity)

        # Extract occurrences (from Phase 1)
        occurrences = entity.get('occurrences', [])

        suggestion = {
            "entity_id": entity['id'],
            "entity_label": entity.get('label', entity.get('symbol', entity.get('term', 'Unknown'))),
            "entity_type": entity.get('type', 'unknown'),
            "tooltip_content": tooltip_content,
            "occurrences": occurrences
        }

        suggestions.append(suggestion)

    return {
        "suggestions": suggestions,
        "total_entities": total_count,
        "suggested_count": len(suggestions)
    }
