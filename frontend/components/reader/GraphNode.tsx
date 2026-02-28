'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Variable, BookOpen, Lightbulb } from 'lucide-react';
import { LatexText } from './LatexText';

interface GraphNodeData {
  label: string;
  nodeType: 'symbol' | 'definition' | 'theorem';
  context?: string;
  definition?: string;
  statement?: string;
  latex?: string;
  domNodeId: string;
  onNavigate: () => void;
}

// Colors and icons for different node types
const nodeConfig = {
  symbol: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    hoverBorderColor: 'hover:border-blue-400',
    textColor: 'text-blue-700',
    icon: Variable,
    iconColor: 'text-blue-500',
  },
  definition: {
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    hoverBorderColor: 'hover:border-emerald-400',
    textColor: 'text-emerald-700',
    icon: BookOpen,
    iconColor: 'text-emerald-500',
  },
  theorem: {
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-300',
    hoverBorderColor: 'hover:border-violet-400',
    textColor: 'text-violet-700',
    icon: Lightbulb,
    iconColor: 'text-violet-500',
  },
};

function GraphNodeComponent({ data }: NodeProps<GraphNodeData>) {
  const config = nodeConfig[data.nodeType] || nodeConfig.symbol;
  const Icon = config.icon;

  // Get the description based on node type
  const description = data.context || data.definition || data.statement;

  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 shadow-sm
        ${config.bgColor} ${config.borderColor} ${config.hoverBorderColor}
        cursor-pointer transition-all duration-150
        hover:shadow-md min-w-[120px] max-w-[180px]
      `}
      onClick={data.onNavigate}
      title={description ? `${data.label}: ${description}` : data.label}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-2 !h-2"
      />

      {/* Header with icon and type */}
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={config.iconColor} />
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
          {data.nodeType}
        </span>
      </div>

      {/* Label */}
      <div className={`text-sm font-semibold ${config.textColor} truncate`}>
        {data.latex ? (
          <LatexText text={data.latex} className="inline" />
        ) : (
          data.label
        )}
      </div>

      {/* Description preview */}
      {description && (
        <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
          <LatexText text={description} />
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-2 !h-2"
      />
    </div>
  );
}

// Memo to prevent unnecessary re-renders
export const GraphNode = memo(GraphNodeComponent);
