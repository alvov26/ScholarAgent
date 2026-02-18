"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import RenderingErrorBoundary from './RenderingErrorBoundary';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

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
  processed = processed.replace(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g, (match) => {
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
        }
      }
      processed = parts.join('');
    });
  }

  // 3. Restore all protected blocks
  processed = processed.replace(/\x00(\d+)\x00/g, (_, id) => protectedBlocks[parseInt(id)]);

  return processed.replace(/\[\[([^\]\n]+?)\]\]/g, '<span class="paper-tooltip">$1</span>');
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
              [rehypeKatex, { throwOnError: true, strict: false }]
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
              [rehypeKatex, { throwOnError: true, strict: false }]
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

export default function MarkdownRenderer({ content, items, paperId }: MarkdownRendererProps) {
  const [tooltips, setTooltips] = useState<Tooltip[]>([]);
  const [activeTerm, setActiveTerm] = useState<{ 
    text: string; 
    rect: { top: number; bottom: number; left: number; width: number } | null 
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
  const reportedKatexErrorsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const errorNodes = Array.from(container.querySelectorAll<HTMLElement>('.katex-error'));
    if (errorNodes.length === 0) return;

    const newlyReported: { message: string; snippet: string }[] = [];
    for (const node of errorNodes) {
      const message = node.getAttribute('title') || 'KaTeX render error';
      const snippet = (node.textContent || '').slice(0, 200);
      const key = `${message}||${snippet}`;
      if (!reportedKatexErrorsRef.current.has(key)) {
        reportedKatexErrorsRef.current.add(key);
        newlyReported.push({ message, snippet });
      }
    }

    if (newlyReported.length > 0) {
      console.group(`%c [KATEX ERRORS] ${newlyReported.length} new`, "color: white; background: #ef4444; font-weight: bold; padding: 2px 6px; border-radius: 4px;");
      for (const err of newlyReported) {
        console.error('Error Message:', err.message);
        if (err.snippet) {
          console.log('Snippet:', err.snippet);
        }
      }
      console.groupEnd();
    }
  }, [content, items]);

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
    span: ({ node, className, children, ...props }: any) => {
      if (className === 'paper-tooltip') {
        return (
          <span
            className="paper-tooltip px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[0.9em] font-medium mx-0.5 cursor-help border-b-2 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400 transition-all"
            onMouseEnter={handleTooltipInteraction}
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

  return (
    <div 
      className="relative max-w-4xl mx-auto p-12 bg-white shadow-xl rounded-2xl min-h-[80vh] border border-slate-100" 
      ref={containerRef}
      onContextMenu={handleContextMenu}
    >
      <MarkdownContent 
        items={items} 
        content={content} 
        components={components} 
        onMouseUp={handleMouseUp} 
        tooltips={tooltips}
      />

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
