"use client";

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

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
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect | null } | null>(null);
  const [isAddingTooltip, setIsAddingTooltip] = useState(false);
  const [newTooltipDescription, setNewTooltipDescription] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Simple pre-processor for when we have a single content string
  const processedContent = useMemo(() => {
    return content?.replace(/\[\[([^\]\n]+?)\]\]/g, '<span class="paper-tooltip">$1</span>') || '';
  }, [content]);

  // Custom components for react-markdown
  const components = {
    span: ({ node, className, children, ...props }: any) => {
      if (className === 'paper-tooltip') {
        return (
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold mx-1 cursor-help border-b-2 border-indigo-300 shadow-sm hover:bg-indigo-200 transition-colors">
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
    
    // Process tooltips in the markdown - using a slightly more robust regex
    const processedMd = item.md?.replace(/\[\[([^\]\n]+?)\]\]/g, '<span class="paper-tooltip">$1</span>') || '';
    
    return (
      <React.Fragment key={index}>
        {showPageMarker && (
          <div className="flex items-center gap-4 my-12 opacity-30 select-none">
            <div className="h-px flex-1 bg-slate-300" />
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-slate-400">Page {item.page}</span>
            <div className="h-px flex-1 bg-slate-300" />
          </div>
        )}
        <div className={item.type === 'table' ? 'my-8 overflow-x-auto' : ''}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]} 
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={components}
          >
            {processedMd}
          </ReactMarkdown>
        </div>
      </React.Fragment>
    );
  };

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        text: sel.toString(),
        rect: rect
      });
    } else {
      // Small delay to allow clicking the "Add Tooltip" button before clearing selection
      setTimeout(() => {
        if (!document.getSelection()?.toString()) {
           // setSelection(null); // This might clear it too early if we are clicking the button
        }
      }, 100);
    }
  }, []);

  const addTooltip = () => {
    if (selection && newTooltipDescription) {
      const newTooltip: Tooltip = {
        id: Math.random().toString(36).substr(2, 9),
        targetText: selection.text,
        description: newTooltipDescription,
      };
      
      setTooltips([...tooltips, newTooltip]);
      setSelection(null);
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
        {items ? (
          items.map((item, idx) => renderItem(item, idx))
        ) : (
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]} 
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={components}
          >
            {processedContent}
          </ReactMarkdown>
        )}
      </div>

      <AnimatePresence>
        {selection && !isAddingTooltip && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed z-50 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-sm font-semibold hover:bg-indigo-700 hover:scale-105 transition-all"
            style={{
              top: (selection.rect?.top ?? 0) - 50,
              left: (selection.rect?.left ?? 0) + (selection.rect?.width ?? 0) / 2,
              transform: 'translateX(-50%)'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsAddingTooltip(true);
            }}
          >
            <MessageSquarePlus size={18} />
            Add Tooltip
          </motion.button>
        )}

        {isAddingTooltip && selection && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed z-50 bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl p-5 w-80 backdrop-blur-sm"
            style={{
              top: (selection.rect?.top ?? 0) + (selection.rect?.height ?? 0) + 15,
              left: (selection.rect?.left ?? 0) + (selection.rect?.width ?? 0) / 2,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Create Annotation</span>
              <button 
                onClick={() => {
                  setIsAddingTooltip(false);
                  setSelection(null);
                }} 
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm font-semibold mb-4 text-slate-800 line-clamp-2 italic border-l-2 border-indigo-200 pl-3">
              "{selection.text}"
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
                  setSelection(null);
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

      <div className="mt-16 border-t border-slate-100 pt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Active Annotations</h3>
        </div>
        
        {tooltips.length === 0 ? (
          <div className="bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm font-medium">No tooltips added yet. Highlight text in the document to begin.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tooltips.map(t => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={t.id} 
                className="group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold mb-2 uppercase tracking-wide">Term</span>
                    <h4 className="font-bold text-slate-900 text-base">{t.targetText}</h4>
                  </div>
                  <button 
                    onClick={() => setTooltips(tooltips.filter(tt => tt.id !== t.id))}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{t.description}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
