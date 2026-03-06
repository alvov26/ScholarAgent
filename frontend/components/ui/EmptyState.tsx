/**
 * EmptyState Component
 *
 * Reusable component for displaying empty states across the application.
 * Used in sidebars, lists, and other containers when there's no content.
 *
 * Usage:
 * <EmptyState
 *   icon={FileText}
 *   title="No items found"
 *   description="Try adding some items to get started"
 *   variant="sidebar" // or "card"
 * />
 */

import { LucideIcon } from 'lucide-react';
import { colors, textStyles, spacing, borders } from '@/lib/design-system';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: 'sidebar' | 'card';
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  variant = 'card',
  action,
}: EmptyStateProps) {
  // Different layouts for different contexts
  const containerClasses =
    variant === 'sidebar'
      ? 'flex flex-col items-center justify-center h-full text-center p-6 gap-3'
      : 'bg-slate-50 rounded-lg border border-slate-200 p-6 text-center';

  const iconSize = variant === 'sidebar' ? 32 : 32;

  return (
    <div className={containerClasses}>
      <Icon size={iconSize} className="text-slate-300" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {description && (
          <p className="text-xs text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
