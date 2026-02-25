'use client';

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
}

export default function TooltipPanel({
  tooltips,
  toc,
  onEdit,
  onDelete,
  onPin,
  onNavigate,
}: TooltipPanelProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Annotations
        </h2>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {tooltips.length}
        </span>
      </div>

      {/* Tooltip list */}
      <TooltipList
        tooltips={tooltips}
        toc={toc}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
        onNavigate={onNavigate}
      />
    </div>
  );
}
