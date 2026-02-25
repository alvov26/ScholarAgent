'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import type { TOCNode } from '@/utils/parseTOC';

interface TableOfContentsProps {
  nodes: TOCNode[];
  onNavigate?: (id: string) => void;
  currentSectionId?: string | null;
}

interface TOCNodeItemProps {
  node: TOCNode;
  onNavigate?: (id: string) => void;
  currentSectionId?: string | null;
  depth: number;
}

function TOCNodeItem({ node, onNavigate, currentSectionId, depth }: TOCNodeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = node.id === currentSectionId;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleNavigate = () => {
    onNavigate?.(node.id);
  };

  return (
    <div>
      <div
        className={`
          w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-1.5
          transition-colors cursor-pointer
          ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-slate-100 text-slate-700'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleNavigate}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="flex-shrink-0 hover:bg-slate-200 rounded p-0.5 -m-0.5"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        ) : (
          <div className="w-3.5" /> // Spacer for alignment
        )}
        <span className="truncate flex-1">{node.title}</span>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TOCNodeItem
              key={child.id}
              node={child}
              onNavigate={onNavigate}
              currentSectionId={currentSectionId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TableOfContents({
  nodes,
  onNavigate,
  currentSectionId,
}: TableOfContentsProps) {
  if (nodes.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 text-center">
        <FileText size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No table of contents available</p>
        <p className="text-xs text-slate-400 mt-1">
          Compile a paper with sections to see the outline
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TOCNodeItem
          key={node.id}
          node={node}
          onNavigate={onNavigate}
          currentSectionId={currentSectionId}
          depth={0}
        />
      ))}
    </div>
  );
}
