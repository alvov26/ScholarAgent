'use client';

import { X, Variable, BookOpen, Lightbulb } from 'lucide-react';
import { LatexText } from './LatexText';

interface NodeInfoPanelProps {
  label: string;
  nodeType: 'symbol' | 'definition' | 'theorem';
  context?: string;
  definition?: string;
  statement?: string;
  latex?: string;
  onClose: () => void;
  onNavigate: () => void;
}

// Node styling config matching GraphNode
const nodeConfig = {
  symbol: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    icon: Variable,
    iconColor: 'text-blue-500',
    label: 'Symbol',
  },
  definition: {
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-700',
    icon: BookOpen,
    iconColor: 'text-emerald-500',
    label: 'Definition',
  },
  theorem: {
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-300',
    textColor: 'text-violet-700',
    icon: Lightbulb,
    iconColor: 'text-violet-500',
    label: 'Theorem',
  },
};

export function NodeInfoPanel({
  label,
  nodeType,
  context,
  definition,
  statement,
  latex,
  onClose,
  onNavigate,
}: NodeInfoPanelProps) {
  const config = nodeConfig[nodeType];
  const Icon = config.icon;

  // Determine what content to show based on node type
  const mainContent = definition || statement || context;

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-slate-200 w-96 max-h-[32rem] overflow-y-auto z-10">
      {/* Header */}
      <div className={`flex items-start justify-between p-3 border-b ${config.borderColor} ${config.bgColor}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon size={16} className={config.iconColor} />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {config.label}
            </span>
          </div>
          <h3 className={`text-base font-semibold ${config.textColor}`}>
            {latex ? (
              <LatexText text={latex} className="inline" />
            ) : (
              <LatexText text={label} className="inline" />
            )}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 hover:bg-white/50 rounded transition-colors"
          aria-label="Close"
        >
          <X size={16} className="text-slate-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Main content (definition/statement/context) */}
        {mainContent && (
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {definition ? 'Definition' : statement ? 'Statement' : 'Context'}
            </div>
            <div className="text-sm text-slate-700 leading-relaxed">
              <LatexText text={mainContent} />
            </div>
          </div>
        )}

        {/* Additional context for symbols */}
        {nodeType === 'symbol' && context && definition && (
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Additional Context
            </div>
            <div className="text-sm text-slate-700 leading-relaxed">
              <LatexText text={context} />
            </div>
          </div>
        )}

        {/* Navigate button */}
        <button
          onClick={onNavigate}
          className="w-full px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
        >
          Jump to location in paper
        </button>
      </div>
    </div>
  );
}
