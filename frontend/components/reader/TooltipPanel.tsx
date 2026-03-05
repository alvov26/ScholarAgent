'use client';

import { Plus } from 'lucide-react';
import type { Tooltip } from '@/hooks/useTooltips';
import type { TOCNode } from '@/utils/parseTOC';
import TooltipList from './TooltipList';

interface TooltipPanelProps {
  tooltips: Tooltip[];
  toc: TOCNode[];
  onEdit?: (tooltip: Tooltip) => void;
  onDelete?: (tooltipId: string) => void;
  onPin?: (tooltipId: string) => void;
  onNavigate?: (domNodeId: string) => void;
  onAddTooltips?: () => void;
}

export default function TooltipPanel({
  tooltips,
  toc,
  onEdit,
  onDelete,
  onPin,
  onNavigate,
  onAddTooltips,
}: TooltipPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Annotations
        </h2>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {tooltips.length}
        </span>
      </div>

      {/* Tooltip list */}
      <div className="flex-1 overflow-y-auto">
        <TooltipList
          tooltips={tooltips}
          toc={toc}
          onEdit={onEdit}
          onDelete={onDelete}
          onPin={onPin}
          onNavigate={onNavigate}
        />
      </div>

      {/* Add Tooltips Button */}
      {onAddTooltips && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <button
            onClick={onAddTooltips}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Tooltips
          </button>
        </div>
      )}
    </div>
  );
}
