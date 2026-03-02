'use client';

import { useState } from 'react';
import { X, Variable, BookOpen, Lightbulb, Focus, ChevronRight, ChevronDown } from 'lucide-react';
import { LatexText } from './LatexText';

export interface ConnectionInfo {
  nodeId: string;
  nodeLabel: string;
  nodeType: 'symbol' | 'definition' | 'theorem';
  relationshipType: string;
}

interface NodeInfoPanelProps {
  label: string;
  nodeType: 'symbol' | 'definition' | 'theorem';
  context?: string;
  definition?: string;
  statement?: string;
  latex?: string;
  onClose: () => void;
  onNavigate: () => void;
  onFocus?: () => void;
  isFocused?: boolean;
  incomingConnections?: ConnectionInfo[];
  outgoingConnections?: ConnectionInfo[];
  onConnectionClick?: (nodeId: string) => void;
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

// Relationship type colors
const relationshipColors: Record<string, string> = {
  uses: 'text-indigo-600',
  depends_on: 'text-amber-600',
  defines: 'text-emerald-600',
  extends: 'text-violet-600',
  mentions: 'text-slate-500',
};

// Group connections by relationship type
function groupByRelationship(connections: ConnectionInfo[]): Record<string, ConnectionInfo[]> {
  return connections.reduce((acc, conn) => {
    if (!acc[conn.relationshipType]) {
      acc[conn.relationshipType] = [];
    }
    acc[conn.relationshipType].push(conn);
    return acc;
  }, {} as Record<string, ConnectionInfo[]>);
}

export function NodeInfoPanel({
  label,
  nodeType,
  context,
  definition,
  statement,
  latex,
  onClose,
  onNavigate,
  onFocus,
  isFocused,
  incomingConnections = [],
  outgoingConnections = [],
  onConnectionClick,
}: NodeInfoPanelProps) {
  const config = nodeConfig[nodeType];
  const Icon = config.icon;

  const [incomingExpanded, setIncomingExpanded] = useState(false);
  const [outgoingExpanded, setOutgoingExpanded] = useState(false);

  // Determine what content to show based on node type
  const mainContent = definition || statement || context;

  // Group connections by relationship type
  const incomingGrouped = groupByRelationship(incomingConnections);
  const outgoingGrouped = groupByRelationship(outgoingConnections);

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

        {/* Incoming connections */}
        {incomingConnections.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <button
              onClick={() => setIncomingExpanded(!incomingExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 w-full"
            >
              {incomingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Incoming ({incomingConnections.length})
            </button>
            {incomingExpanded && (
              <div className="mt-2 space-y-2">
                {Object.entries(incomingGrouped).map(([relType, connections]) => (
                  <div key={relType} className="pl-4">
                    <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${relationshipColors[relType] || 'text-slate-500'}`}>
                      {relType.replace('_', ' ')}
                    </div>
                    <div className="space-y-0.5">
                      {connections.map((conn) => (
                        <button
                          key={conn.nodeId}
                          onClick={() => onConnectionClick?.(conn.nodeId)}
                          className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-indigo-600 hover:underline w-full text-left"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            conn.nodeType === 'symbol' ? 'bg-blue-500' :
                            conn.nodeType === 'definition' ? 'bg-emerald-500' : 'bg-violet-500'
                          }`} />
                          <span className="truncate">{conn.nodeLabel}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Outgoing connections */}
        {outgoingConnections.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <button
              onClick={() => setOutgoingExpanded(!outgoingExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 w-full"
            >
              {outgoingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Outgoing ({outgoingConnections.length})
            </button>
            {outgoingExpanded && (
              <div className="mt-2 space-y-2">
                {Object.entries(outgoingGrouped).map(([relType, connections]) => (
                  <div key={relType} className="pl-4">
                    <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${relationshipColors[relType] || 'text-slate-500'}`}>
                      {relType.replace('_', ' ')}
                    </div>
                    <div className="space-y-0.5">
                      {connections.map((conn) => (
                        <button
                          key={conn.nodeId}
                          onClick={() => onConnectionClick?.(conn.nodeId)}
                          className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-indigo-600 hover:underline w-full text-left"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            conn.nodeType === 'symbol' ? 'bg-blue-500' :
                            conn.nodeType === 'definition' ? 'bg-emerald-500' : 'bg-violet-500'
                          }`} />
                          <span className="truncate">{conn.nodeLabel}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onNavigate}
            className="flex-1 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            Jump to location in paper
          </button>
          {onFocus && (
            <button
              onClick={onFocus}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                isFocused
                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
              }`}
              title={isFocused ? 'Currently focused' : 'Focus on this node'}
            >
              <Focus size={14} />
              {isFocused ? 'Focused' : 'Focus'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
