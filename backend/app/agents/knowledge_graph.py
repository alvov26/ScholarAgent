"""
Knowledge Graph Agent Pipeline

Multi-agent workflow using LangGraph to extract semantic structure from papers
and build a navigable knowledge graph.

Pipeline:
1. Data Loader - Fetches pre-extracted metadata from database
2. Symbol Extraction Agent - Identifies mathematical symbols and notation
3. Definition Extraction Agent - Finds formal and informal definitions
4. Theorem Extraction Agent - Extracts theorems, lemmas, corollaries
5. Dependency Extraction Agent - Maps relationships between entities
6. Graph Builder - Assembles final graph structure
"""

import os
from typing import TypedDict, List, Dict, Any, Optional
from pydantic import BaseModel, Field

from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate

# Load environment variables
load_dotenv()


# =============================================================================
# State Schema
# =============================================================================

class GraphState(TypedDict):
    """Shared state passed between agents"""
    paper_id: str
    
    # Pre-extracted data from Phase 0 (already in database)
    sections: List[Dict[str, Any]]
    equations: List[Dict[str, Any]]
    citations: List[Dict[str, Any]]
    latex_source: Optional[str]
    
    # Agent-extracted entities
    symbols: List[Dict[str, Any]]
    definitions: List[Dict[str, Any]]
    theorems: List[Dict[str, Any]]
    
    # Relationships
    relationships: List[Dict[str, Any]]
    
    # Final output
    graph_data: Dict[str, Any]
    
    # Error tracking
    errors: List[str]


# =============================================================================
# Pydantic Models for Structured Output
# =============================================================================

class Symbol(BaseModel):
    """A mathematical symbol extracted from the paper"""
    symbol: str = Field(description="The symbol as it appears (e.g., α_t, x)")
    latex: str = Field(description="LaTeX representation wrapped in dollar signs for rendering (e.g., $\\alpha_t$, $x$)")
    context: str = Field(description="Brief explanation of what it represents (1 sentence)")
    is_definition: bool = Field(description="Is this where the symbol is first defined/introduced?")


class SymbolExtractionOutput(BaseModel):
    """Output from symbol extraction agent"""
    symbols: List[Symbol]


class Definition(BaseModel):
    """A definition extracted from the paper"""
    term: str = Field(description="The term being defined")
    definition_text: str = Field(description="The definition itself")
    is_formal: bool = Field(description="Is this a numbered/formal definition (e.g., 'Definition 3.2')?")
    definition_number: Optional[str] = Field(default=None, description="The number if formal (e.g., '3.2')")


class DefinitionExtractionOutput(BaseModel):
    """Output from definition extraction agent"""
    definitions: List[Definition]


class Theorem(BaseModel):
    """A theorem/lemma/corollary extracted from the paper"""
    type: str = Field(description="One of: theorem, lemma, corollary, proposition")
    number: str = Field(description="The number (e.g., '3.2')")
    name: Optional[str] = Field(default=None, description="Optional name (e.g., 'Convergence Theorem')")
    statement: str = Field(description="The actual theorem statement")


class TheoremExtractionOutput(BaseModel):
    """Output from theorem extraction agent"""
    theorems: List[Theorem]


class Relationship(BaseModel):
    """A relationship between entities"""
    from_entity: str = Field(description="Source entity (name or identifier)")
    to_entity: str = Field(description="Target entity (name or identifier)")
    relationship_type: str = Field(description="One of: uses, depends_on, defines, mentions")
    evidence_text: str = Field(description="Text snippet showing this relationship")


class RelationshipExtractionOutput(BaseModel):
    """Output from dependency extraction agent"""
    relationships: List[Relationship]


# =============================================================================
# Prompt Templates
# =============================================================================

SYMBOL_SYSTEM_PROMPT = """You are a mathematical symbol extractor for academic papers.
Your task is to identify and extract all mathematical symbols, variables, and notation
from a section of text.

For each symbol, provide:
1. The symbol itself (as it appears in text, e.g., α_t, x, W)
2. Its LaTeX representation wrapped in dollar signs (e.g., $\\alpha_t$, $x$, $W$)
3. A brief context (1 sentence explaining what it represents, use $...$ for any math)
4. Whether this is where the symbol is first defined/introduced

Focus on:
- Greek letters (α, β, θ, etc.)
- Subscripted/superscripted variables (x_t, W with superscripts)
- Mathematical operators and functions (∇, L, f)
- Matrix/vector notation (W, b, X)
- Special notation (\\mathcal{{L}}, \\mathbb{{R}})

Skip common mathematical constants (π, e) unless they have special meaning in this paper.

IMPORTANT: Wrap all LaTeX in dollar signs for proper rendering (e.g., $\\alpha_t$, not \\alpha_t)."""

SYMBOL_USER_PROMPT = """Section: {section_title}

Content:
{content_text}

Extract all mathematical symbols and key notation from this section."""


DEFINITION_SYSTEM_PROMPT = """You are a definition extractor for academic papers.
Identify both formal and informal definitions.

A definition includes:
- The term being defined
- The definition text (what it means, use $...$ for any math notation)
- Whether it's formal (numbered, e.g., "Definition 3.2") or informal

Look for patterns like:
- "We define X as..."
- "Let X be..."
- "X is defined as..."
- "Definition N.M: ..."
- Bold/italic terms followed by descriptions
- "X denotes..."

Be precise: only extract statements that actually define a concept, not just mentions.

IMPORTANT: Wrap all LaTeX/math notation in dollar signs for proper rendering (e.g., $\\alpha$, $x \\in \\mathbb{{R}}$)."""

DEFINITION_USER_PROMPT = """Section: {section_title}

Content:
{content_text}

Extract all definitions (formal and informal) from this section."""


THEOREM_SYSTEM_PROMPT = """You are a theorem extractor for academic papers.
Identify all formal mathematical statements: theorems, lemmas, corollaries, propositions.

For each, extract:
- Type (theorem/lemma/corollary/proposition)
- Number (e.g., "3.2")
- Name (if given, e.g., "Convergence Theorem")
- Statement (the actual claim being made, use $...$ for any math notation)

Look for patterns like:
- "Theorem N.M: ..."
- "Lemma N.M (Name): ..."
- "Corollary: ..."
- "Proposition N.M: ..."

Only extract formal statements with clear theorem-like structure, not informal claims.

IMPORTANT: Wrap all LaTeX/math notation in dollar signs for proper rendering (e.g., $f(x) = 0$, $\\forall x \\in X$)."""

THEOREM_USER_PROMPT = """Section: {section_title}

Content:
{content_text}

Extract all theorems, lemmas, corollaries, and propositions from this section."""


DEPENDENCY_SYSTEM_PROMPT = """You are analyzing dependencies in an academic paper.
Identify relationships between concepts:

Relationship types:
- "uses": X uses Y in its proof/derivation/formula
- "depends_on": X logically requires Y to be defined first
- "defines": X defines symbol/term Y
- "extends": X extends or generalizes Y
- "mentions": X references Y

Look for patterns like:
- "By Theorem X..."
- "Using Definition Y..."
- "From Lemma Z, we have..."
- "Recall that..." (refers to earlier concept)
- "As shown in Section..."
- Symbol usage that refers to earlier definitions

Only extract relationships where there's clear textual evidence."""

DEPENDENCY_USER_PROMPT = """Section: {section_title}

Content:
{content_text}

Known entities in this paper:
- Symbols: {symbol_list}
- Definitions: {definition_list}
- Theorems: {theorem_list}

Extract all dependency relationships visible in this section."""


# =============================================================================
# Agent Functions
# =============================================================================

def load_paper_data(state: GraphState) -> GraphState:
    """
    Load pre-extracted metadata from database.

    This replaces parsing - data already extracted at compile time (Phase 0).
    """
    # Handle imports for both module and script execution
    try:
        from backend.app.database.connection import SessionLocal
        from backend.app.database.models import Paper
    except ModuleNotFoundError:
        import sys
        from pathlib import Path
        # Add project root to path
        project_root = Path(__file__).parent.parent.parent.parent
        sys.path.insert(0, str(project_root))
        from backend.app.database.connection import SessionLocal
        from backend.app.database.models import Paper

    db = SessionLocal()
    try:
        paper = db.query(Paper).filter(Paper.id == state["paper_id"]).first()

        if not paper:
            state["errors"].append(f"Paper {state['paper_id']} not found")
            return state

        # Load pre-extracted data
        all_sections = paper.sections_data or []

        # For testing/development: limit to first N sections to avoid long runtimes
        # TODO: Remove this limit for production or make it configurable
        max_sections = int(os.getenv("KG_MAX_SECTIONS", "5"))
        if max_sections > 0 and len(all_sections) > max_sections:
            state["sections"] = all_sections[:max_sections]
            print(f"Note: Processing first {max_sections} sections only (set KG_MAX_SECTIONS=0 to process all)")
        else:
            state["sections"] = all_sections

        state["equations"] = paper.equations_data or []
        state["citations"] = paper.citations_data or []
        state["latex_source"] = paper.latex_source

        return state
    finally:
        db.close()


def _strip_html_tags(html: str) -> str:
    """Remove HTML tags from text for cleaner LLM input."""
    from bs4 import BeautifulSoup
    if not html:
        return ""
    soup = BeautifulSoup(html, 'html.parser')
    return soup.get_text(separator=' ', strip=True)


def extract_symbols(state: GraphState) -> GraphState:
    """Extract mathematical symbols using LLM."""
    print(f"\n[1/4] Extracting symbols from {len(state['sections'])} sections...")

    llm = ChatAnthropic(model="claude-sonnet-4-20250514")
    structured_llm = llm.with_structured_output(SymbolExtractionOutput)

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYMBOL_SYSTEM_PROMPT),
        ("user", SYMBOL_USER_PROMPT)
    ])

    chain = prompt | structured_llm

    symbols = []
    sections_to_process = [s for s in state["sections"] if len(_strip_html_tags(s.get("content_html", ""))) >= 50]

    for idx, section in enumerate(sections_to_process, 1):
        try:
            content_text = _strip_html_tags(section.get("content_html", ""))
            section_title = section.get("title", "Untitled")

            print(f"  [{idx}/{len(sections_to_process)}] {section_title[:50]}...", end=" ", flush=True)
            if os.getenv("KG_DEBUG"):
                print()
                print(f"      Section ID: {section.get('id')}")
                print(f"      Content length: {len(content_text)} chars")
                print(f"      Content preview: {content_text[:200].strip()}...")
                print(f"      Processing...", end=" ", flush=True)

            response = chain.invoke({
                "section_title": section_title,
                "content_text": content_text[:8000]  # Limit context size
            })

            count = len(response.symbols)
            print(f"✓ ({count} symbols)")

            for symbol in response.symbols:
                symbols.append({
                    "symbol": symbol.symbol,
                    "latex": symbol.latex,
                    "context": symbol.context,
                    "is_definition": symbol.is_definition,
                    "section_id": section.get("id"),
                    "dom_node_id": section.get("id"),
                })
        except Exception as e:
            print(f"✗ Error: {str(e)}")
            state["errors"].append(f"Symbol extraction failed for section {section.get('id')}: {str(e)}")

    print(f"  → Total: {len(symbols)} symbols extracted")
    state["symbols"] = symbols
    return state


def extract_definitions(state: GraphState) -> GraphState:
    """Extract definitions using LLM."""
    print(f"\n[2/4] Extracting definitions from {len(state['sections'])} sections...")

    llm = ChatAnthropic(model="claude-sonnet-4-20250514")
    structured_llm = llm.with_structured_output(DefinitionExtractionOutput)

    prompt = ChatPromptTemplate.from_messages([
        ("system", DEFINITION_SYSTEM_PROMPT),
        ("user", DEFINITION_USER_PROMPT)
    ])

    chain = prompt | structured_llm

    definitions = []
    sections_to_process = [s for s in state["sections"] if len(_strip_html_tags(s.get("content_html", ""))) >= 50]

    for idx, section in enumerate(sections_to_process, 1):
        try:
            content_text = _strip_html_tags(section.get("content_html", ""))
            section_title = section.get("title", "Untitled")

            print(f"  [{idx}/{len(sections_to_process)}] {section_title[:50]}...", end=" ", flush=True)
            if os.getenv("KG_DEBUG"):
                print()
                print(f"      Section ID: {section.get('id')}")
                print(f"      Content length: {len(content_text)} chars")
                print(f"      Content preview: {content_text[:200].strip()}...")
                print(f"      Processing...", end=" ", flush=True)

            response = chain.invoke({
                "section_title": section_title,
                "content_text": content_text[:8000]
            })

            count = len(response.definitions)
            print(f"✓ ({count} definitions)")

            for defn in response.definitions:
                definitions.append({
                    "term": defn.term,
                    "definition_text": defn.definition_text,
                    "is_formal": defn.is_formal,
                    "definition_number": defn.definition_number,
                    "section_id": section.get("id"),
                    "dom_node_id": section.get("id"),
                })
        except Exception as e:
            print(f"✗ Error: {str(e)}")
            state["errors"].append(f"Definition extraction failed for section {section.get('id')}: {str(e)}")

    print(f"  → Total: {len(definitions)} definitions extracted")
    state["definitions"] = definitions
    return state


def extract_theorems(state: GraphState) -> GraphState:
    """Extract theorems, lemmas, corollaries using LLM."""
    print(f"\n[3/4] Extracting theorems from {len(state['sections'])} sections...")

    llm = ChatAnthropic(model="claude-sonnet-4-20250514")
    structured_llm = llm.with_structured_output(TheoremExtractionOutput)

    prompt = ChatPromptTemplate.from_messages([
        ("system", THEOREM_SYSTEM_PROMPT),
        ("user", THEOREM_USER_PROMPT)
    ])

    chain = prompt | structured_llm

    theorems = []
    sections_to_process = [s for s in state["sections"] if len(_strip_html_tags(s.get("content_html", ""))) >= 50]

    for idx, section in enumerate(sections_to_process, 1):
        try:
            content_text = _strip_html_tags(section.get("content_html", ""))
            section_title = section.get("title", "Untitled")

            print(f"  [{idx}/{len(sections_to_process)}] {section_title[:50]}...", end=" ", flush=True)
            if os.getenv("KG_DEBUG"):
                print()
                print(f"      Section ID: {section.get('id')}")
                print(f"      Content length: {len(content_text)} chars")
                print(f"      Content preview: {content_text[:200].strip()}...")
                print(f"      Processing...", end=" ", flush=True)

            response = chain.invoke({
                "section_title": section_title,
                "content_text": content_text[:8000]
            })

            count = len(response.theorems)
            print(f"✓ ({count} theorems)")

            for thm in response.theorems:
                theorems.append({
                    "type": thm.type,
                    "number": thm.number,
                    "name": thm.name,
                    "statement": thm.statement,
                    "section_id": section.get("id"),
                    "dom_node_id": section.get("id"),
                })
        except Exception as e:
            print(f"✗ Error: {str(e)}")
            state["errors"].append(f"Theorem extraction failed for section {section.get('id')}: {str(e)}")

    print(f"  → Total: {len(theorems)} theorems extracted")
    state["theorems"] = theorems
    return state


def extract_dependencies(state: GraphState) -> GraphState:
    """Extract relationships between entities."""
    print(f"\n[4/4] Extracting relationships from {len(state['sections'])} sections...")

    llm = ChatAnthropic(model="claude-sonnet-4-20250514")
    structured_llm = llm.with_structured_output(RelationshipExtractionOutput)

    prompt = ChatPromptTemplate.from_messages([
        ("system", DEPENDENCY_SYSTEM_PROMPT),
        ("user", DEPENDENCY_USER_PROMPT)
    ])

    chain = prompt | structured_llm

    # Prepare entity lists for context
    symbol_list = [s["symbol"] for s in state["symbols"]]
    definition_list = [d["term"] for d in state["definitions"]]
    theorem_list = [f"{t['type'].capitalize()} {t['number']}" for t in state["theorems"]]

    print(f"  Context: {len(symbol_list)} symbols, {len(definition_list)} definitions, {len(theorem_list)} theorems")

    relationships = []
    sections_to_process = [s for s in state["sections"] if len(_strip_html_tags(s.get("content_html", ""))) >= 50]

    for idx, section in enumerate(sections_to_process, 1):
        try:
            content_text = _strip_html_tags(section.get("content_html", ""))
            section_title = section.get("title", "Untitled")

            print(f"  [{idx}/{len(sections_to_process)}] {section_title[:50]}...", end=" ", flush=True)
            if os.getenv("KG_DEBUG"):
                print()
                print(f"      Section ID: {section.get('id')}")
                print(f"      Content length: {len(content_text)} chars")
                print(f"      Content preview: {content_text[:200].strip()}...")
                print(f"      Processing...", end=" ", flush=True)

            response = chain.invoke({
                "section_title": section_title,
                "content_text": content_text[:8000],
                "symbol_list": ", ".join(symbol_list[:50]) if symbol_list else "None found",
                "definition_list": ", ".join(definition_list[:30]) if definition_list else "None found",
                "theorem_list": ", ".join(theorem_list[:20]) if theorem_list else "None found",
            })

            count = len(response.relationships)
            print(f"✓ ({count} relationships)")

            for rel in response.relationships:
                relationships.append({
                    "from_entity": rel.from_entity,
                    "to_entity": rel.to_entity,
                    "type": rel.relationship_type,
                    "evidence": rel.evidence_text,
                    "section_id": section.get("id"),
                })
        except Exception as e:
            print(f"✗ Error: {str(e)}")
            state["errors"].append(f"Dependency extraction failed for section {section.get('id')}: {str(e)}")

    print(f"  → Total: {len(relationships)} relationships extracted")
    state["relationships"] = relationships
    return state


def _sanitize_id(name: str) -> str:
    """Convert entity name to valid ID."""
    return name.lower().replace(" ", "_").replace("\\", "").replace("{", "").replace("}", "")[:64]


def _resolve_entity_id(entity_name: str, state: GraphState) -> str:
    """Map entity name to its node ID."""
    entity_lower = entity_name.lower()
    
    # Check symbols
    for symbol in state["symbols"]:
        if symbol["symbol"].lower() == entity_lower or symbol["latex"].lower() == entity_lower:
            return f"symbol_{_sanitize_id(symbol['symbol'])}"
    
    # Check definitions
    for defn in state["definitions"]:
        if defn["term"].lower() == entity_lower:
            return f"def_{_sanitize_id(defn['term'])}"
    
    # Check theorems
    for thm in state["theorems"]:
        thm_label = f"{thm['type']} {thm['number']}".lower()
        if thm_label == entity_lower or thm["number"] == entity_name:
            return f"thm_{thm['number']}"
    
    # Fallback: sanitize the name
    return _sanitize_id(entity_name)


def build_graph(state: GraphState) -> GraphState:
    """Assemble final graph structure from extracted entities."""
    print(f"\n[5/5] Building graph from extracted entities...")
    print(f"  Symbols: {len(state['symbols'])}")
    print(f"  Definitions: {len(state['definitions'])}")
    print(f"  Theorems: {len(state['theorems'])}")
    print(f"  Relationships: {len(state['relationships'])}")

    nodes = []
    edges = []
    seen_node_ids = set()
    
    # Convert symbols to nodes (deduplicate by symbol name)
    seen_symbols = set()
    for symbol in state["symbols"]:
        symbol_key = symbol["symbol"].lower()
        if symbol_key in seen_symbols:
            continue
        seen_symbols.add(symbol_key)
        
        node_id = f"symbol_{_sanitize_id(symbol['symbol'])}"
        if node_id in seen_node_ids:
            continue
        seen_node_ids.add(node_id)
        
        nodes.append({
            "id": node_id,
            "type": "symbol",
            "label": symbol["symbol"],
            "latex": symbol["latex"],
            "context": symbol["context"],
            "dom_node_id": symbol["dom_node_id"],
            "section_id": symbol["section_id"],
        })
    
    # Convert definitions to nodes
    seen_definitions = set()
    for defn in state["definitions"]:
        term_key = defn["term"].lower()
        if term_key in seen_definitions:
            continue
        seen_definitions.add(term_key)
        
        node_id = f"def_{_sanitize_id(defn['term'])}"
        if node_id in seen_node_ids:
            continue
        seen_node_ids.add(node_id)
        
        nodes.append({
            "id": node_id,
            "type": "definition",
            "label": defn["term"],
            "definition": defn["definition_text"],
            "is_formal": defn["is_formal"],
            "definition_number": defn.get("definition_number"),
            "dom_node_id": defn["dom_node_id"],
            "section_id": defn["section_id"],
        })
    
    # Convert theorems to nodes
    for thm in state["theorems"]:
        node_id = f"thm_{thm['number']}"
        if node_id in seen_node_ids:
            continue
        seen_node_ids.add(node_id)
        
        nodes.append({
            "id": node_id,
            "type": "theorem",
            "subtype": thm["type"],
            "label": f"{thm['type'].capitalize()} {thm['number']}",
            "name": thm.get("name"),
            "statement": thm["statement"],
            "dom_node_id": thm["dom_node_id"],
            "section_id": thm["section_id"],
        })
    
    # Convert relationships to edges
    seen_edges = set()
    for rel in state["relationships"]:
        from_id = _resolve_entity_id(rel["from_entity"], state)
        to_id = _resolve_entity_id(rel["to_entity"], state)
        
        # Skip self-references and invalid edges
        if from_id == to_id:
            continue
        
        # Skip edges to non-existent nodes
        if from_id not in seen_node_ids and to_id not in seen_node_ids:
            continue
        
        edge_key = (from_id, to_id, rel["type"])
        if edge_key in seen_edges:
            continue
        seen_edges.add(edge_key)
        
        edges.append({
            "id": f"{from_id}_to_{to_id}_{rel['type']}",
            "source": from_id,
            "target": to_id,
            "type": rel["type"],
            "evidence": rel["evidence"],
        })
    
    state["graph_data"] = {
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "paper_id": state["paper_id"],
            "node_count": len(nodes),
            "edge_count": len(edges),
            "symbol_count": len([n for n in nodes if n["type"] == "symbol"]),
            "definition_count": len([n for n in nodes if n["type"] == "definition"]),
            "theorem_count": len([n for n in nodes if n["type"] == "theorem"]),
        }
    }

    print(f"\n✓ Graph assembly complete!")
    print(f"  → {len(nodes)} unique nodes")
    print(f"  → {len(edges)} edges")

    return state


# =============================================================================
# LangGraph Workflow
# =============================================================================

def create_knowledge_graph_workflow() -> StateGraph:
    """Create the LangGraph workflow for knowledge graph extraction."""
    workflow = StateGraph(GraphState)

    # Add nodes
    workflow.add_node("load_data", load_paper_data)
    workflow.add_node("extract_symbols", extract_symbols)
    workflow.add_node("extract_definitions", extract_definitions)
    workflow.add_node("extract_theorems", extract_theorems)
    workflow.add_node("extract_dependencies", extract_dependencies)
    workflow.add_node("build_graph", build_graph)

    # Define edges
    workflow.set_entry_point("load_data")

    # After loading data, run extractions in parallel
    # These are independent and can run concurrently
    workflow.add_edge("load_data", "extract_symbols")
    workflow.add_edge("load_data", "extract_definitions")
    workflow.add_edge("load_data", "extract_theorems")

    # Dependencies need all three extractions to complete
    workflow.add_edge("extract_symbols", "extract_dependencies")
    workflow.add_edge("extract_definitions", "extract_dependencies")
    workflow.add_edge("extract_theorems", "extract_dependencies")

    # Build graph after dependencies extracted
    workflow.add_edge("extract_dependencies", "build_graph")
    workflow.add_edge("build_graph", END)

    return workflow


def build_kg_for_paper(paper_id: str) -> Dict[str, Any]:
    """
    Build knowledge graph for a paper.
    
    This is the main entry point called by the API.
    
    Args:
        paper_id: The paper ID to build graph for
        
    Returns:
        graph_data: Dict with nodes and edges
    """
    workflow = create_knowledge_graph_workflow()
    app = workflow.compile()
    
    initial_state: GraphState = {
        "paper_id": paper_id,
        "sections": [],
        "equations": [],
        "citations": [],
        "latex_source": None,
        "symbols": [],
        "definitions": [],
        "theorems": [],
        "relationships": [],
        "graph_data": {},
        "errors": [],
    }
    
    result = app.invoke(initial_state)
    
    if result["errors"]:
        print(f"Warnings during extraction: {result['errors']}")
    
    return result["graph_data"]


# =============================================================================
# CLI for Testing
# =============================================================================

if __name__ == "__main__":
    import sys
    import json
    
    if len(sys.argv) < 2:
        print("Usage: python -m backend.app.agents.knowledge_graph <paper_id>")
        sys.exit(1)
    
    paper_id = sys.argv[1]
    print(f"Building knowledge graph for paper: {paper_id}")
    
    graph_data = build_kg_for_paper(paper_id)
    
    print(f"\nExtracted:")
    print(f"  - {graph_data['metadata']['node_count']} nodes")
    print(f"  - {graph_data['metadata']['edge_count']} edges")
    print(f"  - {graph_data['metadata']['symbol_count']} symbols")
    print(f"  - {graph_data['metadata']['definition_count']} definitions")
    print(f"  - {graph_data['metadata']['theorem_count']} theorems")
    
    # Pretty print sample
    print("\nSample nodes:")
    for node in graph_data["nodes"][:5]:
        print(f"  [{node['type']}] {node['label']}")
    
    print("\nSample edges:")
    for edge in graph_data["edges"][:5]:
        print(f"  {edge['source']} --{edge['type']}--> {edge['target']}")
