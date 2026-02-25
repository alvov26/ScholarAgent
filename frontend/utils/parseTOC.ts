/**
 * Table of Contents Parser
 *
 * Extracts hierarchical section structure from compiled HTML.
 */

export interface TOCNode {
  id: string;          // data-id attribute from HTML
  title: string;       // Section title text
  level: number;       // 1-6 (h1-h6)
  children: TOCNode[]; // Nested subsections
}

/**
 * Parse HTML to extract table of contents from heading tags (h1-h6)
 *
 * @param html - Compiled HTML content
 * @returns Hierarchical TOC structure
 */
export function parseTOC(html: string): TOCNode[] {
  if (!html) return [];

  // Create a temporary DOM to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find all heading elements with data-id attributes
  const headings = Array.from(doc.querySelectorAll('h1[data-id], h2[data-id], h3[data-id], h4[data-id], h5[data-id], h6[data-id]'));

  if (headings.length === 0) {
    return [];
  }

  const root: TOCNode[] = [];
  const stack: TOCNode[] = [];

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.substring(1)); // h1 -> 1, h2 -> 2, etc.
    const id = heading.getAttribute('data-id') || '';

    // Extract title: preserve MathML but remove LaTeX text annotations
    let title = '';
    const clonedHeading = heading.cloneNode(true) as HTMLElement;

    // Remove any <text> elements (LaTeX annotations)
    clonedHeading.querySelectorAll('text').forEach(el => el.remove());

    // Check if there's MathML content
    const mathElements = clonedHeading.querySelectorAll('math');
    if (mathElements.length > 0) {
      // Use innerHTML to preserve MathML tags
      title = clonedHeading.innerHTML.trim();
    } else {
      // Plain text heading
      title = clonedHeading.textContent?.trim() || 'Untitled';
    }

    const node: TOCNode = {
      id,
      title,
      level,
      children: [],
    };

    // Find the correct parent in the stack
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level heading
      root.push(node);
    } else {
      // Child of the last item in stack
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  return root;
}

/**
 * Flatten TOC tree to a list for easier iteration
 */
export function flattenTOC(nodes: TOCNode[]): TOCNode[] {
  const result: TOCNode[] = [];

  function traverse(node: TOCNode) {
    result.push(node);
    node.children.forEach(traverse);
  }

  nodes.forEach(traverse);
  return result;
}
