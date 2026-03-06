/**
 * CollapsibleSection Component
 *
 * Reusable collapsible section with consistent chevron behavior.
 * Used throughout the app for expandable/collapsible content.
 *
 * Usage:
 * <CollapsibleSection
 *   title="Section Title"
 *   defaultExpanded={true}
 *   badge="5"
 *   icon={Sparkles}
 * >
 *   <div>Your content here</div>
 * </CollapsibleSection>
 */

import { useState, ReactNode } from 'react';
import { ChevronRight, ChevronDown, LucideIcon } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string | ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  badge?: string | number;
  icon?: LucideIcon;
  indentLevel?: number;
  headerClassName?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultExpanded = true,
  badge,
  icon: Icon,
  indentLevel = 0,
  headerClassName,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-2">
      {/* Header button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={
          headerClassName ||
          'w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded transition-colors'
        }
        style={indentLevel > 0 ? { paddingLeft: `${indentLevel * 12 + 8}px` } : undefined}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {Icon && <Icon size={14} className="text-indigo-600" />}
        {typeof title === 'string' ? (
          <span className="flex-1 text-left truncate">{title}</span>
        ) : (
          <div className="flex-1 text-left truncate">{title}</div>
        )}
        {badge !== undefined && (
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </button>

      {/* Expandable content */}
      {expanded && <div>{children}</div>}
    </div>
  );
}
