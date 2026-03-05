'use client';

import { useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Tooltip } from '@/hooks/useTooltips';

declare global {
  interface Window {
    MathJax?: {
      typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
    };
  }
}

interface TooltipDetailViewProps {
  tooltip: Tooltip | null;
  onClose: () => void;
  onDelete?: (tooltipId: string) => void;
}

export default function TooltipDetailView({
  tooltip,
  onClose,
  onDelete,
}: TooltipDetailViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Re-typeset MathJax when tooltip changes
  useEffect(() => {
    const retypeset = async () => {
      if (typeof window !== 'undefined' && window.MathJax?.typesetPromise && contentRef.current) {
        try {
          await window.MathJax.typesetPromise([contentRef.current]);
        } catch (err) {
          console.error('[TooltipDetailView] MathJax typesetting error:', err);
        }
      }
    };

    if (tooltip) {
      // Small delay to ensure content is rendered
      const timeout = setTimeout(retypeset, 50);
      return () => clearTimeout(timeout);
    }
  }, [tooltip?.id, tooltip?.content]);

  if (!tooltip) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-400 px-4 text-center">
        Click on a highlighted term in the document to view its definition
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">
            {tooltip.target_text || 'Annotation'}
          </h3>
          {tooltip.entity_id && (
            <p className="text-xs text-slate-500 truncate">
              Entity: {tooltip.entity_id}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {onDelete && (
            <button
              onClick={() => onDelete(tooltip.id)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Remove this annotation"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Close detail view"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div
          ref={contentRef}
          className="text-sm text-slate-700 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      </div>
    </div>
  );
}
