'use client';

import TableOfContents from './TableOfContents';
import type { TOCNode } from '@/utils/parseTOC';

interface NavigationPanelProps {
  toc: TOCNode[];
  onNavigate?: (id: string) => void;
  currentSectionId?: string | null;
}

export default function NavigationPanel({
  toc,
  onNavigate,
  currentSectionId,
}: NavigationPanelProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </h2>
      </div>

      {/* Table of Contents */}
      <TableOfContents
        nodes={toc}
        onNavigate={onNavigate}
        currentSectionId={currentSectionId}
      />
    </div>
  );
}
