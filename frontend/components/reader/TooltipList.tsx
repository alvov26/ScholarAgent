'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Pin, Edit2, Trash2, FileText } from 'lucide-react';
import type { Tooltip } from '@/hooks/useTooltips';
import type { TOCNode } from '@/utils/parseTOC';
import {
  SectionGroupingStrategy,
  FlatGroupingStrategy,
  DateGroupingStrategy,
  sortTooltipsByPriority,
  type TooltipGroup,
  type GroupingStrategy,
} from '@/utils/tooltipGrouping';
import { LatexText } from './LatexText';

interface TooltipListProps {
  tooltips: Tooltip[];
  toc: TOCNode[];
  onEdit?: (tooltip: Tooltip) => void;
  onDelete?: (tooltipId: string) => void;
  onPin?: (tooltipId: string) => void;
  onNavigate?: (domNodeId: string) => void;
}

interface TooltipCardProps {
  tooltip: Tooltip;
  onEdit?: (tooltip: Tooltip) => void;
  onDelete?: (tooltipId: string) => void;
  onPin?: (tooltipId: string) => void;
  onNavigate?: (domNodeId: string) => void;
}

function TooltipCard({ tooltip, onEdit, onDelete, onPin, onNavigate }: TooltipCardProps) {
  // Pinned tooltips start expanded
  const [expanded, setExpanded] = useState(tooltip.is_pinned);
  const isPinned = tooltip.is_pinned;

  const handleNavigate = () => {
    onNavigate?.(tooltip.dom_node_id);
  };

  return (
    <div
      className={`
        bg-white rounded-lg border p-3 space-y-2
        ${isPinned ? 'border-indigo-300 shadow-sm' : 'border-slate-200'}
        hover:border-slate-300 transition-colors
      `}
    >
      {/* Header with target text and controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {tooltip.target_text && (
            <button
              onClick={handleNavigate}
              className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors block w-full text-left break-words"
              title="Jump to location"
            >
              <LatexText text={tooltip.target_text} className="inline" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onPin?.(tooltip.id)}
            className={`p-1 rounded hover:bg-slate-100 transition-colors ${
              isPinned ? 'text-indigo-600' : 'text-slate-400'
            }`}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={14} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* Content preview (when collapsed) */}
      {!expanded && (
        <div className="text-xs text-slate-600 line-clamp-2 break-words">
          <LatexText text={tooltip.content} />
        </div>
      )}

      {/* Full content (when expanded) */}
      {expanded && (
        <>
          <div className="text-sm text-slate-700 border-t pt-2 break-words">
            <LatexText text={tooltip.content} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <button
              onClick={() => onEdit?.(tooltip)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded transition-colors"
            >
              <Edit2 size={12} />
              Edit
            </button>
            <button
              onClick={() => onDelete?.(tooltip.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
            <div className="ml-auto text-xs text-slate-400">
              {new Date(tooltip.created_at).toLocaleDateString()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface GroupSectionProps {
  group: TooltipGroup;
  onEdit?: (tooltip: Tooltip) => void;
  onDelete?: (tooltipId: string) => void;
  onPin?: (tooltipId: string) => void;
  onNavigate?: (domNodeId: string) => void;
}

function GroupSection({ group, onEdit, onDelete, onPin, onNavigate }: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sortedTooltips = useMemo(() => sortTooltipsByPriority(group.tooltips), [group.tooltips]);

  // Calculate total tooltip count including children
  const totalCount = useMemo(() => {
    let count = group.tooltips.length;
    const countChildren = (children?: TooltipGroup[]) => {
      if (!children) return;
      children.forEach(child => {
        count += child.tooltips.length;
        countChildren(child.children);
      });
    };
    countChildren(group.children);
    return count;
  }, [group]);

  const indentLevel = group.level || 0;

  return (
    <div className="space-y-2">
      {/* Group header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded transition-colors"
        style={{ paddingLeft: `${indentLevel * 12 + 8}px` }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <span className="flex-1 text-left truncate" title={group.title}>
          {group.title}
        </span>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {totalCount}
        </span>
      </button>

      {/* Content when expanded */}
      {!collapsed && (
        <div className="space-y-2">
          {/* Tooltip cards for this section */}
          {sortedTooltips.length > 0 && (
            <div className="space-y-2 ml-4" style={{ marginLeft: `${(indentLevel + 1) * 12 + 8}px` }}>
              {sortedTooltips.map(tooltip => (
                <TooltipCard
                  key={tooltip.id}
                  tooltip={tooltip}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPin={onPin}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}

          {/* Child sections (recursively) */}
          {group.children && group.children.length > 0 && (
            <div className="space-y-2">
              {group.children.map(child => (
                <GroupSection
                  key={child.id}
                  group={child}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPin={onPin}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TooltipList({
  tooltips,
  toc,
  onEdit,
  onDelete,
  onPin,
  onNavigate,
}: TooltipListProps) {
  const [strategyName, setStrategyName] = useState<'section' | 'flat' | 'date'>('section');

  // Select grouping strategy
  const strategy: GroupingStrategy = useMemo(() => {
    switch (strategyName) {
      case 'section':
        return new SectionGroupingStrategy();
      case 'flat':
        return new FlatGroupingStrategy();
      case 'date':
        return new DateGroupingStrategy();
      default:
        return new SectionGroupingStrategy();
    }
  }, [strategyName]);

  // Group tooltips
  const groups = useMemo(() => {
    return strategy.group(tooltips, toc);
  }, [strategy, tooltips, toc]);

  // Empty state
  if (tooltips.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 text-center">
        <FileText size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No tooltips yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Hover over text in the paper and click + to add tooltips
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Strategy selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">Group by:</span>
        <div className="flex gap-1">
          {(['section', 'flat', 'date'] as const).map(name => (
            <button
              key={name}
              onClick={() => setStrategyName(name)}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${
                  strategyName === name
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip groups */}
      <div className="space-y-3">
        {groups.map(group => (
          <GroupSection
            key={group.id}
            group={group}
            onEdit={onEdit}
            onDelete={onDelete}
            onPin={onPin}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
