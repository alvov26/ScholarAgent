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

const unescapeHtml = (text: string) => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#x26;/g, '&')
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}');
};

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
}

export default function MarkdownRenderer({ content, items }: MarkdownRendererProps) {
  const [tooltips, setTooltips] = useState<Tooltip[]>([]);
  const [activeTerm, setActiveTerm] = useState<{ text: string; rect: DOMRect | null } | null>(null);
  const [isAddingTooltip, setIsAddingTooltip] = useState(false);
  const [newTooltipDescription, setNewTooltipDescription] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reportedKatexErrorsRef = useRef<Set<string>>(new Set());

  // Simple pre-processor for when we have a single content string
  const processedContent = useMemo(() => {
    if (!content) return '';
    const unescaped = unescapeHtml(content);
    return unescaped.replace(/\[\[([^\]\n]+?)\]\]/g, '<span class="paper-tooltip">$1</span>');
  }, [content]);

  const mergedItems = useMemo(() => {
    if (!items) return null;
    return mergeItemsForMath(items);
  }, [items]);

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
    setIsAddingTooltip(false);
    setNewTooltipDescription('');
  }, [activeTerm?.text]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!activeTerm) return;
      const target = event.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('.paper-tooltip')) return;
      setActiveTerm(null);
      setIsAddingTooltip(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [activeTerm]);

  const handleTooltipClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const target = event.currentTarget;
    setActiveTerm({
      text: target.textContent || '',
      rect: target.getBoundingClientRect()
    });
  }, []);

  // Custom components for react-markdown
  const components = {
    span: ({ node, className, children, ...props }: any) => {
      if (className === 'paper-tooltip') {
        return (
          <span
            className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold mx-1 cursor-help border-b-2 border-indigo-300 shadow-sm hover:bg-indigo-200 transition-colors"
            onClick={handleTooltipClick}
          >
            {children}
          </span>
        );
      }
      return <span className={className} {...props}>{children}</span>;
    }
  };

  const renderItem = (item: any, index: number) => {
    // Show page marker if it's the first item of a page (except first page)
    const showPageMarker = index > 0 && items && items[index - 1].page !== item.page;
    
    // Unescape and then process tooltips in the markdown
    const unescaped = item.md ? unescapeHtml(item.md) : '';
    const processedMd = unescaped.replace(/\[\[([^\]\n]+?)\]\]/g, '<span class="paper-tooltip">$1</span>');
    
    return (
      <React.Fragment key={index}>
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
      </React.Fragment>
    );
  };

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setActiveTerm({
        text: sel.toString(),
        rect: rect
      });
    } else {
      setTimeout(() => {
        if (!document.getSelection()?.toString()) {
          setActiveTerm(null);
        }
      }, 100);
    }
  }, []);

  const addTooltip = () => {
    if (activeTerm && newTooltipDescription) {
      const newTooltip: Tooltip = {
        id: Math.random().toString(36).substr(2, 9),
        targetText: activeTerm.text,
        description: newTooltipDescription,
      };
      
      setTooltips([...tooltips, newTooltip]);
      setActiveTerm(null);
      setIsAddingTooltip(false);
      setNewTooltipDescription('');
    }
  };

  return (
    <div 
      className="relative max-w-4xl mx-auto p-12 bg-white shadow-xl rounded-2xl min-h-[80vh] border border-slate-100" 
      onMouseUp={handleMouseUp} 
      ref={containerRef}
    >
      <div className="prose prose-slate prose-indigo max-w-none prose-headings:font-bold prose-h1:text-3xl prose-p:text-slate-700 prose-p:leading-relaxed">
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

      <AnimatePresence>
        {activeTerm && !isAddingTooltip && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="fixed z-50 bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl p-4 w-80 backdrop-blur-sm"
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
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed z-50 bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl p-5 w-80 backdrop-blur-sm"
            style={{
              top: (activeTerm.rect?.bottom ?? 0) + 14,
              left: (activeTerm.rect?.left ?? 0) + (activeTerm.rect?.width ?? 0) / 2,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Create Annotation</span>
              <button
                onClick={() => {
                  setIsAddingTooltip(false);
                  setActiveTerm(null);
                }}
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
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50/50"
              placeholder="What does this mean? Add a definition or note..."
              rows={4}
              value={newTooltipDescription}
              onChange={(e) => setNewTooltipDescription(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
               <button
                className="text-slate-500 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                onClick={() => {
                  setIsAddingTooltip(false);
                  setActiveTerm(null);
                }}
              >
                Cancel
              </button>
              <button
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                disabled={!newTooltipDescription.trim()}
                onClick={addTooltip}
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
