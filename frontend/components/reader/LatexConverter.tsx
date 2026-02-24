"use client";

/**
 * Convert LaTeX text elements to HTML
 * Math is left as-is for MathJax to process
 */

export function convertLatexToHtml(latex: string): string {
  let html = latex;

  // Remove common preamble/formatting commands that shouldn't appear in body
  const commandsToStrip = [
    'twocolumn', 'onecolumn', 'newpage', 'clearpage', 'pagebreak',
    'vspace', 'hspace', 'vskip', 'hskip', 'smallskip', 'medskip', 'bigskip',
    'noindent', 'indent', 'centering', 'raggedright', 'raggedleft',
    'par', 'newline', 'linebreak'
  ];

  commandsToStrip.forEach(cmd => {
    html = html.replace(new RegExp(`\\\\${cmd}(?:\\[[^\\]]*\\])?(?:\\{[^}]*\\})?`, 'g'), '');
  });

  // Remove custom conference/journal commands (icml, acl, neurips, etc.)
  html = html.replace(/\\icml[a-zA-Z]+(?:\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\print[a-zA-Z]+(?:\[[^\]]*\])?\{[^}]*\}/g, '');

  // Formatting commands
  html = html.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\(?:textit|emph)\{([^}]+)\}/g, '<em>$1</em>');
  html = html.replace(/\\texttt\{([^}]+)\}/g, '<code>$1</code>');
  html = html.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');

  // Text commands (just extract content)
  html = html.replace(/\\text(?:rm|sf|sc|up)?\{([^}]+)\}/g, '$1');

  // Lists
  html = html.replace(/\\begin\{itemize\}/g, '<ul>');
  html = html.replace(/\\end\{itemize\}/g, '</ul>');
  html = html.replace(/\\begin\{enumerate\}/g, '<ol>');
  html = html.replace(/\\end\{enumerate\}/g, '</ol>');
  html = html.replace(/\\item\s+/g, '<li>');

  // Quotes
  html = html.replace(/``/g, '"');
  html = html.replace(/''/g, '"');

  // Line breaks
  html = html.replace(/\\\\/g, '<br/>');

  // Citations and references (keep as placeholders for now)
  html = html.replace(/\\cite(?:p|t|author|year)?\{([^}]+)\}/g, '<sup class="text-blue-600">[cite:$1]</sup>');
  html = html.replace(/\\ref\{([^}]+)\}/g, '<span class="text-blue-600">[ref:$1]</span>');
  html = html.replace(/\\eqref\{([^}]+)\}/g, '<span class="text-blue-600">(eq:$1)</span>');

  // Remove labels, they're just for reference
  html = html.replace(/\\label\{[^}]*\}/g, '');

  // Remove author blocks and other structural commands
  html = html.replace(/\\begin\{[a-zA-Z]+list\}[\s\S]*?\\end\{[a-zA-Z]+list\}/g, '');

  // Paragraph breaks (double newline)
  html = html.replace(/\n\n+/g, '</p><p>');

  // Wrap in paragraph tags if not already
  if (!html.includes('<p>')) {
    html = `<p>${html}</p>`;
  }

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

interface LatexSection {
  type: 'section' | 'subsection' | 'subsubsection' | 'paragraph';
  title: string;
  content: Array<{
    type: 'text' | 'math';
    content: string;
    display?: boolean;
    raw?: string;
  }>;
}

interface LatexSectionProps {
  section: LatexSection;
  onMathRender?: () => void;
}

export function LatexSectionRenderer({ section, onMathRender }: LatexSectionProps) {
  const HeadingTag = getHeadingTag(section.type);

  // Skip sections that are just preamble junk
  const isPreamble = !section.title &&
    section.content.length === 1 &&
    section.content[0].type === 'text' &&
    (section.content[0].content.includes('\\twocolumn') ||
     section.content[0].content.includes('\\icml') ||
     section.content[0].content.includes('\\begin{abstract}'));

  if (isPreamble) {
    // Try to extract just the abstract if present
    const content = section.content[0].content;
    const abstractMatch = content.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);

    if (abstractMatch) {
      let abstractText = abstractMatch[1].trim();
      // Clean up LaTeX commands in abstract
      abstractText = convertLatexToHtml(abstractText);

      return (
        <div className="latex-section mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
          <h2 className="text-lg font-bold mb-3 text-slate-700">Abstract</h2>
          <div
            className="latex-content text-slate-600 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: abstractText }}
          />
        </div>
      );
    }

    // Otherwise skip this section entirely
    return null;
  }

  return (
    <div className="latex-section mb-8">
      {section.title && (
        <HeadingTag className="font-bold mb-4">
          {section.title}
        </HeadingTag>
      )}
      <div className="latex-content">
        {section.content.map((block, idx) => (
          <LatexBlock key={idx} block={block} onMathRender={onMathRender} />
        ))}
      </div>
    </div>
  );
}

function LatexBlock({ block, onMathRender }: {
  block: { type: 'text' | 'math'; content: string; display?: boolean; raw?: string };
  onMathRender?: () => void;
}) {
  if (block.type === 'math') {
    return <MathBlock content={block.content} display={block.display || false} raw={block.raw} onRender={onMathRender} />;
  }

  const html = convertLatexToHtml(block.content);

  // Don't render empty paragraphs
  if (!html.trim()) {
    return null;
  }

  return (
    <div
      className="mb-4 leading-relaxed text-slate-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MathBlock({ content, display, raw, onRender }: {
  content: string;
  display: boolean;
  raw?: string;
  onRender?: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isTypeset, setIsTypeset] = React.useState(false);

  React.useEffect(() => {
    const typesetMath = () => {
      if (ref.current && (window as any).MathJax?.typesetPromise) {
        try {
          (window as any).MathJax.typesetPromise([ref.current]).then(() => {
            setIsTypeset(true);
            onRender?.();
          }).catch((err: any) => {
            console.error('MathJax typeset failed:', err);
          });
        } catch (err) {
          console.error('MathJax typeset error:', err);
        }
      }
    };

    // Try to typeset immediately if MathJax is ready
    if ((window as any).MathJax?.typesetPromise) {
      typesetMath();
    } else {
      // Wait for MathJax to load
      const handleMathJaxReady = () => {
        typesetMath();
      };
      window.addEventListener('MathJaxReady', handleMathJaxReady);
      return () => window.removeEventListener('MathJaxReady', handleMathJaxReady);
    }
  }, [content, display, raw, onRender]);

  // Use raw format if available, otherwise construct delimiters
  const mathContent = raw || (display ? `$$${content}$$` : `$${content}$`);

  const className = display
    ? 'math-display my-4 overflow-x-auto text-center'
    : 'math-inline inline';

  const Tag = display ? 'div' : 'span';

  return (
    <Tag
      ref={ref as any}
      className={className}
    >
      {mathContent}
    </Tag>
  );
}

function getHeadingTag(type: string): keyof JSX.IntrinsicElements {
  switch (type) {
    case 'section':
      return 'h1';
    case 'subsection':
      return 'h2';
    case 'subsubsection':
      return 'h3';
    default:
      return 'div';
  }
}

// Re-export React for use in this file
import React from 'react';
