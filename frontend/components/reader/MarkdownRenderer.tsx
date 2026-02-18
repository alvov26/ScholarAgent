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

const MemoizedMarkdownItem = React.memo(({ item, index, showPageMarker, components }: any) => {
  const unescaped = item.md ? unescapeHtml(item.md) : '';
  const processedMd = unescaped.replace(/\[\[([^\]\n]+?)\]\]/g, '<span class="paper-tooltip">$1</span>');

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
}

// 1. Memoized Markdown Content
const MarkdownContent = React.memo(({ items, content, components, onMouseUp }: any) => {
  const processedContent = useMemo(() => {
    if (!content) return '';
    const unescaped = unescapeHtml(content);
    return unescaped.replace(/\[\[([^\]\n]+?)\]\]/g, '<span class="paper-tooltip">$1</span>');
  }, [content]);

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
const AddTooltipPanel = ({ activeTerm, onClose, onSave }: any) => {
  const [description, setDescription] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={panelRef}
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
};

export default function MarkdownRenderer({ content, items }: MarkdownRendererProps) {
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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const reportedKatexErrorsRef = useRef<Set<string>>(new Set());

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
  }, [activeTerm?.text]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // If clicking inside any panel, don't close
      if (panelRef.current?.contains(target)) return;
      if (selectionMenuRef.current?.contains(target)) return;
      if (target.closest('.paper-tooltip')) return;

      setActiveTerm(null);
      setSelection(null);
      setIsAddingTooltip(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleTooltipClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setSelection(null); // Clear selection when clicking an existing tooltip
      setActiveTerm({
        text: target.textContent || '',
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
            className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold mx-1 cursor-help border-b-2 border-indigo-300 shadow-sm hover:bg-indigo-200 transition-colors"
            onClick={handleTooltipClick}
          >
            {children}
          </span>
        );
      }
      return <span className={className} {...props}>{children}</span>;
    }
  }), [handleTooltipClick]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (panelRef.current?.contains(e.target as Node)) return;
    if (selectionMenuRef.current?.contains(e.target as Node)) return;

    const sel = window.getSelection();
    if (!sel || sel.toString().trim().length === 0) {
      setSelection(null);
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (panelRef.current?.contains(e.target as Node)) return;
    if (selectionMenuRef.current?.contains(e.target as Node)) return;

    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      e.preventDefault();
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (containerRect) {
        setSelection({
          text: sel.toString(),
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

  const saveTooltip = (description: string) => {
    if (activeTerm && description) {
      const newTooltip: Tooltip = {
        id: Math.random().toString(36).substr(2, 9),
        targetText: activeTerm.text,
        description: description,
      };
      
      setTooltips([...tooltips, newTooltip]);
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
            ref={panelRef}
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
