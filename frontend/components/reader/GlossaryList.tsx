'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Edit2, Trash2, Sparkles, User as UserIcon } from 'lucide-react';
import type { Tooltip } from '@/hooks/useTooltips';
import { LatexText } from './LatexText';

interface GlossaryListProps {
  tooltips: Tooltip[];
  onEdit?: (tooltip: Tooltip) => void;
  onDelete?: (tooltipId: string) => void;
}

interface GlossaryCardProps {
  tooltip: Tooltip;
  onEdit?: (tooltip: Tooltip) => void;
  onDelete?: (tooltipId: string) => void;
}

function GlossaryCard({ tooltip, onEdit, onDelete }: GlossaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2 hover:border-slate-300 transition-colors">
      {/* Header with term and controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {tooltip.target_text && (
            <div className="text-sm font-medium text-slate-700 break-words">
              <LatexText text={tooltip.target_text} className="inline" />
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 flex-shrink-0"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
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

interface EntityGroup {
  type: string;
  label: string;
  tooltips: Tooltip[];
  isUserCreated: boolean;
}

interface GroupSectionProps {
  group: EntityGroup;
  onEdit?: (tooltip: Tooltip) => void;
  onDelete?: (tooltipId: string) => void;
}

function GroupSection({ group, onEdit, onDelete }: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-2">
      {/* Group header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        {group.isUserCreated && <UserIcon size={14} className="text-indigo-600" />}
        {!group.isUserCreated && <Sparkles size={14} className="text-indigo-600" />}
        <span className="flex-1 text-left">{group.label}</span>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {group.tooltips.length}
        </span>
      </button>

      {/* Content when expanded */}
      {!collapsed && (
        <div className="space-y-2 ml-4">
          {group.tooltips.map(tooltip => (
            <GlossaryCard
              key={tooltip.id}
              tooltip={tooltip}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GlossaryList({
  tooltips,
  onEdit,
  onDelete,
}: GlossaryListProps) {
  // Group tooltips by entity type and whether they're user-created or AI-generated
  const groups = useMemo(() => {
    const result: EntityGroup[] = [];

    // Separate user-created (no entity_id from KG) vs AI-generated (has entity_id)
    const userCreated: Tooltip[] = [];
    const aiGenerated = new Map<string, Tooltip[]>();

    tooltips.forEach(tooltip => {
      // If tooltip has no entity_id or entity_id is manually set, it's user-created
      // For now, we'll assume all tooltips in glossary list came from suggestions
      // and have entity_id, but we need a way to distinguish user vs AI
      // Let's infer from whether entity_id follows KG pattern (e.g., "symbol_", "def_", etc.)

      if (tooltip.entity_id && tooltip.entity_id.startsWith('manual_')) {
        // Manual tooltip (user-created)
        userCreated.push(tooltip);
      } else if (tooltip.entity_id) {
        // AI-generated tooltip - extract type from entity_id pattern
        // entity_id format: "symbol_<name>", "def_<name>", "theorem_<name>", etc.
        const typeMatch = tooltip.entity_id.match(/^([^_]+)_/);
        const entityType = typeMatch ? typeMatch[1] : 'other';

        if (!aiGenerated.has(entityType)) {
          aiGenerated.set(entityType, []);
        }
        aiGenerated.get(entityType)!.push(tooltip);
      } else {
        // Fallback: no entity_id (shouldn't happen in glossary)
        userCreated.push(tooltip);
      }
    });

    // Add user-created group first if there are any
    if (userCreated.length > 0) {
      result.push({
        type: 'user',
        label: 'User-Created',
        tooltips: userCreated,
        isUserCreated: true,
      });
    }

    // Add AI-generated groups
    const typeLabels: Record<string, string> = {
      symbol: 'Symbols',
      def: 'Definitions',
      definition: 'Definitions',
      theorem: 'Theorems',
      other: 'Other',
    };

    // Sort by type name for consistent ordering
    const sortedTypes = Array.from(aiGenerated.keys()).sort();

    sortedTypes.forEach(type => {
      const items = aiGenerated.get(type)!;
      result.push({
        type,
        label: typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1),
        tooltips: items,
        isUserCreated: false,
      });
    });

    return result;
  }, [tooltips]);

  // Empty state
  if (tooltips.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 text-center">
        <Sparkles size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No glossary entries yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Use "Add Tooltips" to create term definitions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <GroupSection
          key={group.type}
          group={group}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
