import MarkdownRenderer from "@/components/reader/MarkdownRenderer";

const MOCK_CONTENT = String.raw`
# Sample Scientific Paper

## Abstract
This paper explores the integration of agentic workflows into document reading systems. 
We propose a system called Scholar Agent that automatically enriches scientific texts 
with tooltips and logical flow maps.

## Introduction
Reading scientific literature is often challenging due to the high density of specialized 
terminology and complex mathematical notation. Traditional PDF readers offer limited 
interactivity, making it difficult for researchers to quickly grasp the core contributions 
of a paper.

## Proposed Method
Our method involves using **[[LlamaParse]]** v1 for high-fidelity document cracking and 
**[[Graph-RAG]]** for maintaining a consistent understanding of symbols across sections.

The core objective is to maximize the utility function $$U(a, p)$$ where $$a$$ is the agent action and $$p$$ is the paper context:
$$
U(a, p) = \sum_{i=1}^{n} 
$$

### Key Components:
1. **Symbol Glossary Agent**: Extracts and defines mathematical symbols.
2. **Logical Flow Map**: Visualizes the narrative structure.
3. **Interactive Renderer**: Allows users to add custom tooltips.

## Conclusion
Scholar Agent represents a significant step towards more efficient research workflows.
`;

export default async function Home() {
  const paperId = "3b4c26ea2dc911545c7c009b34fe3a1f172037271ad5167b5933851946eae88d";
  let content = MOCK_CONTENT;
  
  try {
    const res = await fetch(`http://localhost:8000/paper/${paperId}/markdown`, { 
      cache: 'no-store' 
    });
    if (res.ok) {
      const data = await res.json();
      content = data.markdown;
    }
  } catch (error) {
    console.error("Failed to fetch paper from backend:", error);
  }

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Scholar Agent <span className="text-indigo-600">Reader</span>
        </h1>
        <p className="text-slate-500 font-medium">
          Select any text to add a custom tooltip
        </p>
      </div>
      
      <MarkdownRenderer content={content} />
    </main>
  );
}
