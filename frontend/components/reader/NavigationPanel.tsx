'use client';

import { useState } from 'react';
import { List, Network } from 'lucide-react';
import TableOfContents from './TableOfContents';
import { KnowledgeGraphView } from './KnowledgeGraphView';
import type { TOCNode } from '@/utils/parseTOC';

interface NavigationPanelProps {
  paperId: string;
  toc: TOCNode[];
  onNavigate?: (id: string) => void;
  currentSectionId?: string | null;
}

export default function NavigationPanel({
  paperId,
  toc,
  onNavigate,
  currentSectionId,
}: NavigationPanelProps) {
  const [mode, setMode] = useState<'toc' | 'graph'>('toc');

  return (
    <div className="h-full flex flex-col">
      {/* Toggle buttons */}
      <div className="flex border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setMode('toc')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors
            ${
              mode === 'toc'
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500'
                : 'text-slate-600 hover:bg-slate-50'
            }
          `}
        >
          <List size={16} />
          Sections
        </button>
        <button
          onClick={() => setMode('graph')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors
            ${
              mode === 'graph'
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500'
                : 'text-slate-600 hover:bg-slate-50'
            }
          `}
        >
          <Network size={16} />
          Graph
        </button>
      </div>

      {/* Content - both components stay mounted to preserve state */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`h-full overflow-y-auto p-3 ${mode === 'toc' ? '' : 'hidden'}`}>
          <TableOfContents
            nodes={toc}
            onNavigate={onNavigate}
            currentSectionId={currentSectionId}
          />
        </div>
        <div className={`h-full ${mode === 'graph' ? '' : 'hidden'}`}>
          <KnowledgeGraphView
            paperId={paperId}
            onNavigate={(domNodeId) => onNavigate?.(domNodeId)}
          />
        </div>
      </div>
    </div>
  );
}
