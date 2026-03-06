'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import type { TOCNode } from '@/utils/parseTOC';
import { EmptyState } from '@/components/ui';

// Extend Window interface for MathJax
declare global {
  interface Window {
    MathJax?: {
      typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
      startup?: {
        promise?: Promise<void>;
      };
    };
  }
}

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
  const titleRef = useRef<HTMLSpanElement>(null);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleNavigate = () => {
    onNavigate?.(node.id);
  };

  // Typeset MathML with MathJax when title changes
  useEffect(() => {
    const typeset = async () => {
      if (typeof window !== 'undefined' && window.MathJax?.typesetPromise && titleRef.current) {
        try {
          if (window.MathJax.startup?.promise) {
            await window.MathJax.startup.promise;
          }
          await window.MathJax.typesetPromise([titleRef.current]);
        } catch (err) {
          console.error('[TOC] MathJax typesetting error:', err);
        }
      }
    };
    typeset();
  }, [node.title]);

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
        <span
          ref={titleRef}
          className="truncate flex-1"
          dangerouslySetInnerHTML={{ __html: node.title }}
        />
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
      <EmptyState
        icon={FileText}
        title="No table of contents available"
        description="Compile a paper with sections to see the outline."
        variant="sidebar"
      />
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
