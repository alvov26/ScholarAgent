"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import RenderingErrorBoundary from './RenderingErrorBoundary';
import { LatexSectionRenderer } from './LatexConverter';


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const MathComponent = ({ value, children, display }: { value?: string; children?: any; display: boolean }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const mathValue = value || (Array.isArray(children) ? children[0] : children) || '';

  useEffect(() => {
    if (ref.current && (window as any).MathJax) {
      try {
        (window as any).MathJax.typesetPromise([ref.current]);
      } catch (err) {
        console.error('MathJax typeset failed:', err);
      }
    }
  }, [mathValue, display]);

  const Tag = display ? 'div' : 'span';
  const delimiters = display ? ['$$', '$$'] : ['$', '$'];

  return (
    <Tag
      ref={ref as any}
      className={display ? 'math-display my-4 overflow-x-auto text-center' : 'math-inline'}
      dangerouslySetInnerHTML={{ __html: delimiters[0] + mathValue + delimiters[1] }}
    />
  );
};

const unescapeHtml = (text: string) => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#x26;/g, '&')
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}');
};

const highlightTooltips = (text: string, tooltips: Tooltip[]) => {
  if (!text) return '';
  let processed = unescapeHtml(text);
  
  const protectedBlocks: string[] = [];
  
  // 1. Protect existing [[...]] markers
  processed = processed.replace(/\[\[([^\]\n]+?)\]\]/g, (match) => {
    protectedBlocks.push(match);
    return `\x00${protectedBlocks.length - 1}\x00`;
  });

  // 2. Protect math blocks to avoid highlighting terms inside LaTeX
  // Supports $...$, $$...$$, \(...\), \[...\], and \begin{env}...\end{env}
  processed = processed.replace(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\\begin\{([a-zA-Z0-9*]+)\}[\s\S]+?\\end\{\2\})/g, (match) => {
    protectedBlocks.push(match);
    return `\x00${protectedBlocks.length - 1}\x00`;
  });

  if (tooltips.length > 0) {
    // Unique terms to avoid double-processing
    const terms = Array.from(new Set(tooltips.map(t => t.targetText)));
    const sortedTerms = terms.sort((a, b) => b.length - a.length);
    
    sortedTerms.forEach(term => {
      if (!term.trim()) return;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isWord = /^\w+$/.test(term);
      const regex = new RegExp(isWord ? `\\b${escaped}\\b` : escaped, 'g');
      
      const parts = processed.split(/(\x00\d+\x00)/);
      for (let i = 0; i < parts.length; i++) {
        if (!parts[i].startsWith('\x00')) {
          parts[i] = parts[i].replace(regex, (match) => {
            protectedBlocks.push(`[[${match}]]`);
            return `\x00${protectedBlocks.length - 1}\x00`;
          });
        } else {
          // Process inside existing tooltip blocks to support compound terms
          const id = parseInt(parts[i].substring(1, parts[i].length - 1));
          const block = protectedBlocks[id];
          if (block.startsWith('[[') && block.endsWith(']]')) {
            const inner = block.substring(2, block.length - 2);
            if (inner !== term) {
              const processedInner = inner.replace(regex, (match) => {
                protectedBlocks.push(`[[${match}]]`);
                return `\x00${protectedBlocks.length - 1}\x00`;
              });
              if (processedInner !== inner) {
                protectedBlocks[id] = `[[${processedInner}]]`;
              }
            }
          }
        }
      }
      processed = parts.join('');
    });
  }

  // 3. Restore all protected blocks recursively
  while (processed.includes('\x00')) {
    processed = processed.replace(/\x00(\d+)\x00/g, (_, id) => protectedBlocks[parseInt(id)]);
  }

  // 4. Convert [[...]] to spans, handling nesting from inside out
  let prev;
  do {
    prev = processed;
    processed = processed.replace(/\[\[([^\[\]\n]+?)\]\]/g, '<span class="paper-tooltip">$1</span>');
  } while (processed !== prev);

  return processed;
};

const MemoizedMarkdownItem = React.memo(({ item, index, showPageMarker, components, tooltips }: any) => {
  const processedMd = useMemo(() => highlightTooltips(item.md || '', tooltips), [item.md, tooltips]);

  return (
    <>
      {showPageMarker && (
        <div className="flex items-center gap-4 my-12 opacity-30 select-none">
          <div className="h-px flex-1 bg-slate-300" />
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-slate-400">Page {item.page}</span>
          <div className="h-px flex-1 bg-slate-300" />
        </div>
      )}
      <RenderingErrorBoundary metadata={{ page: item.page, type: item.type, index, content: item.md }}>
        <div className={item.type === 'table' ? 'my-8 overflow-x-auto' : ''}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeRaw,
            ]}
            components={components}
          >
            {processedMd}
          </ReactMarkdown>
        </div>
      </RenderingErrorBoundary>
    </>
  );
});

const mergeItemsForMath = (items: any[]) => {
  const merged: any[] = [];
  let buffer: any | null = null;
  let openMath = false;

  const countBlockDelims = (input: string) => {
    let count = 0;
    for (let i = 0; i < input.length - 1; i++) {
      if (input[i] === '$' && input[i + 1] === '$' && (i === 0 || input[i - 1] !== '\\')) {
        count += 1;
        i += 1;
      }
    }
    return count;
  };

  for (const item of items) {
    const md = item?.md || '';
    if (item?.type !== 'text') {
      if (buffer) {
        merged.push(buffer);
        buffer = null;
        openMath = false;
      }
      merged.push(item);
      continue;
    }

    if (!buffer) {
      buffer = { ...item };
      const delimCount = countBlockDelims(md);
      openMath = delimCount % 2 === 1;
      if (!openMath) {
        merged.push(buffer);
        buffer = null;
      }
      continue;
    }

    buffer.md = `${buffer.md}\n${md}`;
    const delimCount = countBlockDelims(buffer.md || '');
    openMath = delimCount % 2 === 1;
    if (!openMath) {
      merged.push(buffer);
      buffer = null;
    }
  }

  if (buffer) {
    merged.push(buffer);
  }

  return merged;
};

interface Tooltip {
  id: string;
  targetText: string;
  description: string;
}

interface MarkdownRendererProps {
  content?: string;
  items?: any[];
  paperId?: string;
  latexStructure?: {
    format: 'latex';
    sections: any[];
    math_catalog?: any[];
  };
}

// 1. Memoized Markdown Content
const MarkdownContent = React.memo(({ items, content, components, onMouseUp, tooltips }: any) => {
  const processedContent = useMemo(() => highlightTooltips(content || '', tooltips), [content, tooltips]);

  const mergedItems = useMemo(() => {
    if (!items) return null;
    return mergeItemsForMath(items);
  }, [items]);

  const renderItem = (item: any, index: number) => {
    const showPageMarker = index > 0 && items && items[index - 1].page !== item.page;
    return (
      <MemoizedMarkdownItem
        key={index}
        item={item}
        index={index}
        showPageMarker={showPageMarker}
        components={components}
        tooltips={tooltips}
      />
    );
  };

  return (
    <div 
      className="prose prose-slate prose-indigo max-w-none prose-headings:font-bold prose-h1:text-3xl prose-p:text-slate-700 prose-p:leading-relaxed"
      onMouseUp={onMouseUp}
    >
      {mergedItems ? (
        mergedItems.map((item, idx) => renderItem(item, idx))
      ) : (
        <RenderingErrorBoundary metadata={{ type: 'mock', content }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeRaw,
            ]}
            components={components}
          >
            {processedContent}
          </ReactMarkdown>
        </RenderingErrorBoundary>
      )}
    </div>
  );
});

// 2. Local state for the Add Tooltip dialog to prevent parent re-renders
const AddTooltipPanel = React.forwardRef(({ activeTerm, onClose, onSave }: any, ref: any) => {
  const [description, setDescription] = useState('');

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="absolute z-50 bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl p-5 w-80 backdrop-blur-sm"
      style={{
        top: (activeTerm.rect?.bottom ?? 0) + 14,
        left: (activeTerm.rect?.left ?? 0) + (activeTerm.rect?.width ?? 0) / 2,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Create Annotation</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <p className="text-sm font-semibold mb-4 text-slate-800 line-clamp-2 italic border-l-2 border-indigo-200 pl-3">
        "{activeTerm.text}"
      </p>
      <textarea
        autoFocus
        className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 text-slate-900"
        placeholder="What does this mean? Add a definition or note..."
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="mt-4 flex justify-end gap-2">
         <button
          className="text-slate-500 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
          disabled={!description.trim()}
          onClick={() => onSave(description)}
        >
          Save
        </button>
      </div>
    </motion.div>
  );
});

export default function MarkdownRenderer({ content, items, paperId, latexStructure }: MarkdownRendererProps) {
  const [tooltips, setTooltips] = useState<Tooltip[]>([]);
  const [activeTerm, setActiveTerm] = useState<{ 
    text: string; 
    rect: { top: number; bottom: number; left: number; width: number } | null;
    mathContext?: {
      semanticId: string | null;
      semanticType: string | null;
      semanticRole: string | null;
      fullSource: string;
    }
  } | null>(null);
  const [selection, setSelection] = useState<{
    text: string;
    rect: { top: number; bottom: number; left: number; width: number } | null
  } | null>(null);
  const [isAddingTooltip, setIsAddingTooltip] = useState(false);
  
  const viewPanelRef = useRef<HTMLDivElement>(null);
  const editPanelRef = useRef<HTMLDivElement>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paperId) {
      fetch(`${API_BASE}/paper/${paperId}/annotations`)
        .then(res => res.json())
        .then(data => {
          if (data.annotations) {
            setTooltips(data.annotations);
          }
        })
      .catch(err => {
        console.error("Failed to fetch annotations", err);
        // Fallback for debugging if requests are blocked/failing
        console.log(`Fetch URL: ${API_BASE}/paper/${paperId}/annotations`);
      });
    }
  }, [paperId]);



  const matchingTooltips = useMemo(() => {
    if (!activeTerm) return [];
    return tooltips.filter(t => t.targetText === activeTerm.text);
  }, [activeTerm, tooltips]);


  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // If clicking inside any panel, don't close
      if (viewPanelRef.current?.contains(target)) return;
      if (editPanelRef.current?.contains(target)) return;
      if (selectionMenuRef.current?.contains(target)) return;
      if (target.closest('.paper-tooltip')) return;

      setActiveTerm(null);
      setSelection(null);
      setIsAddingTooltip(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleTooltipInteraction = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const target = event.currentTarget;
    const text = (target.textContent || '').trim();
    if (!text) return;

    const rect = target.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setSelection(null); // Clear selection when interacting with an existing tooltip
      setActiveTerm({
        text: text,
        rect: {
          top: rect.top - containerRect.top,
          bottom: rect.bottom - containerRect.top,
          left: rect.left - containerRect.left,
          width: rect.width,
        }
      });
      setIsAddingTooltip(false);
    }
  }, []);

  const components = useMemo(() => ({
    math: (props: any) => <MathComponent {...props} display={true} />,
    inlineMath: (props: any) => <MathComponent {...props} display={false} />,
    span: ({ node, className, children, ...props }: any) => {
      if (className === 'paper-tooltip') {
        return (
          <span
            className="paper-tooltip px-1 py-0.5 bg-indigo-50 text-indigo-800 rounded-md text-[0.95em] font-medium mx-0.5 cursor-help border-b-2 border-indigo-200 transition-all inline-block align-baseline"
            onMouseOver={handleTooltipInteraction}
          >
            {children}
          </span>
        );
      }
      return <span className={className} {...props}>{children}</span>;
    }
  }), [handleTooltipInteraction]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (viewPanelRef.current?.contains(e.target as Node)) return;
    if (editPanelRef.current?.contains(e.target as Node)) return;
    if (selectionMenuRef.current?.contains(e.target as Node)) return;

    const sel = window.getSelection();
    if (!sel || sel.toString().trim().length === 0) {
      setSelection(null);
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (viewPanelRef.current?.contains(e.target as Node)) return;
    if (editPanelRef.current?.contains(e.target as Node)) return;
    if (selectionMenuRef.current?.contains(e.target as Node)) return;

    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      e.preventDefault();
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (containerRect) {
        setSelection({
          text: sel.toString().trim(),
          rect: {
            top: rect.top - containerRect.top,
            bottom: rect.bottom - containerRect.top,
            left: rect.left - containerRect.left,
            width: rect.width,
          }
        });
        setActiveTerm(null);
      }
    }
  }, []);

  const saveTooltip = async (description: string) => {
    if (activeTerm && description) {
      const newTooltip: Tooltip = {
        id: Math.random().toString(36).substr(2, 9),
        targetText: activeTerm.text,
        description: description,
      };
      
      const newTooltips = [...tooltips, newTooltip];
      setTooltips(newTooltips);
      
      if (paperId) {
        try {
          console.log(`Saving tooltip for paper ${paperId} to ${API_BASE}/paper/${paperId}/annotations`);
          const res = await fetch(`${API_BASE}/paper/${paperId}/annotations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTooltips)
          });
          if (!res.ok) {
            throw new Error(`Failed to save annotations: ${res.status} ${res.statusText}`);
          }
          console.log("Annotations saved successfully");
        } catch (err) {
          console.error("Failed to save annotations", err);
        }
      }
      
      setActiveTerm(null);
      setIsAddingTooltip(false);
    }
  };

  const handleMathClick = useCallback((event: React.MouseEvent) => {
    let target = event.target as HTMLElement;
    console.log("Math clicked, target:", target);
    
    // Find the nearest parent with data-semantic-id
    while (target && target !== containerRef.current && !target.hasAttribute('data-semantic-id')) {
      target = target.parentElement as HTMLElement;
    }

    if (target && target.hasAttribute('data-semantic-id')) {
      const semanticId = target.getAttribute('data-semantic-id');
      const semanticType = target.getAttribute('data-semantic-type');
      const semanticRole = target.getAttribute('data-semantic-role');
      console.log("Found semantic node:", { semanticId, semanticType, semanticRole });
      
      // Find the parent mjx-container to get the full TeX source
      let container = target;
      while (container && container.tagName !== 'MJX-CONTAINER') {
        container = container.parentElement as HTMLElement;
      }
      
      const fullSource = container?.getAttribute('data-latex') || '';
      
      const rect = target.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (containerRect) {
        setSelection(null);
        setActiveTerm({
          text: `Math symbol: ${target.innerText || semanticType || 'unknown'}`,
          rect: {
            top: rect.top - containerRect.top,
            bottom: rect.bottom - containerRect.top,
            left: rect.left - containerRect.left,
            width: rect.width,
          },
          mathContext: {
            semanticId,
            semanticType,
            semanticRole,
            fullSource
          }
        });
        setIsAddingTooltip(false);
      }
    }
  }, []);

  // Render LaTeX structure if available
  const renderContent = () => {
    if (latexStructure && latexStructure.format === 'latex') {
      console.log('[MarkdownRenderer] Rendering LaTeX structure with', latexStructure.sections?.length, 'sections');
      return (
        <>
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-4 text-xs text-green-700">
            ✓ Rendering native LaTeX structure ({latexStructure.sections?.length} sections, {latexStructure.math_catalog?.length} math expressions)
          </div>
          <div className="latex-document prose prose-slate prose-indigo max-w-none">
            {latexStructure.sections.map((section, idx) => (
              <LatexSectionRenderer key={idx} section={section} />
            ))}
          </div>
        </>
      );
    }

    console.log('[MarkdownRenderer] Rendering markdown content');
    return (
      <>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4 text-xs text-blue-700">
          ℹ Rendering markdown format
        </div>
        <MarkdownContent
          items={items}
          content={content}
          components={components}
          onMouseUp={handleMouseUp}
          tooltips={tooltips}
        />
      </>
    );
  };

  return (
    <div
      className="relative max-w-4xl mx-auto p-12 bg-white shadow-xl rounded-2xl min-h-[80vh] border border-slate-100 mjx-process"
      ref={containerRef}
      onContextMenu={handleContextMenu}
      onClick={handleMathClick}
    >
      <style jsx global>{`
        .paper-tooltip {
          position: relative;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
        
        /* Nested level 1: darker background, different border */
        .paper-tooltip .paper-tooltip {
          background-color: #e0e7ff !important; /* bg-indigo-100 */
          border-bottom-color: #818cf8 !important; /* border-indigo-400 */
          border-bottom-width: 2px !important;
          margin: 0 1px;
        }

        /* Nested level 2: even darker */
        .paper-tooltip .paper-tooltip .paper-tooltip {
          background-color: #c7d2fe !important; /* bg-indigo-200 */
          border-bottom-color: #4f46e5 !important; /* border-indigo-600 */
        }

        /* Hover states for nesting */
        .paper-tooltip:hover {
          background-color: #e0e7ff; /* bg-indigo-100 */
          border-bottom-color: #818cf8; /* border-indigo-400 */
          z-index: 10;
        }

        .paper-tooltip .paper-tooltip:hover {
          background-color: #c7d2fe !important; /* bg-indigo-200 */
          border-bottom-color: #4f46e5 !important; /* border-indigo-600 */
          z-index: 20;
        }

        /* MathJax Semantic Node Highlighting */
        [data-semantic-id]:hover {
          background-color: rgba(99, 102, 241, 0.1);
          outline: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 2px;
          cursor: help;
        }
        
        mjx-container {
          padding: 2px;
          transition: all 0.2s;
        }
      `}</style>

      {renderContent()}

      <AnimatePresence>
        {selection && (
          <motion.div
            ref={selectionMenuRef}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            className="absolute z-50 bg-slate-900 text-white rounded-full shadow-lg flex items-center p-1.5 px-3 gap-2"
            style={{
              top: (selection.rect?.top ?? 0) - 45,
              left: (selection.rect?.left ?? 0) + (selection.rect?.width ?? 0) / 2,
              transform: 'translateX(-50%)'
            }}
          >
            <button
              onClick={() => {
                setActiveTerm(selection);
                setIsAddingTooltip(true);
                setSelection(null);
              }}
              className="flex items-center gap-2 text-xs font-bold hover:text-indigo-300 transition-colors"
            >
              <MessageSquarePlus size={14} />
              Add Tooltip
            </button>
          </motion.div>
        )}

        {activeTerm && !isAddingTooltip && (
          <motion.div
            ref={viewPanelRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="absolute z-50 bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl p-4 w-80 backdrop-blur-sm"
            style={{
              top: (activeTerm.rect?.bottom ?? 0) + 14,
              left: (activeTerm.rect?.left ?? 0) + (activeTerm.rect?.width ?? 0) / 2,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Annotation</span>
              <button
                onClick={() => setActiveTerm(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-900 line-clamp-2 italic border-l-2 border-indigo-200 pl-3">
              "{activeTerm.text}"
            </p>
            {matchingTooltips.length === 0 ? (
              <div className="mt-4">
                <p className="text-xs text-slate-500">No tooltip for this term yet.</p>
                <button
                  className="mt-3 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                  onClick={() => setIsAddingTooltip(true)}
                >
                  <MessageSquarePlus size={14} />
                  Add Tooltip
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {matchingTooltips.map(t => (
                  <div key={t.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm text-slate-700">
                    <div className="flex items-start justify-between gap-2">
                      <p className="leading-relaxed">{t.description}</p>
                      <button
                        onClick={() => setTooltips(tooltips.filter(tt => tt.id !== t.id))}
                        className="text-slate-300 hover:text-red-400 transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="inline-flex items-center gap-2 text-indigo-600 text-xs font-bold hover:text-indigo-700"
                  onClick={() => setIsAddingTooltip(true)}
                >
                  <MessageSquarePlus size={14} />
                  Add Another
                </button>
              </div>
            )}
          </motion.div>
        )}

        {isAddingTooltip && activeTerm && (
          <AddTooltipPanel 
            ref={editPanelRef}
            activeTerm={activeTerm} 
            onClose={() => {
              setIsAddingTooltip(false);
              setActiveTerm(null);
            }} 
            onSave={saveTooltip}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
