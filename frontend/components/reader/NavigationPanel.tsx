'use client';

export default function NavigationPanel() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </h2>
      </div>

      {/* Placeholder - will be replaced with actual TOC */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 shadow-sm">
        <p className="text-sm text-slate-500">Table of contents will appear here</p>
      </div>
    </div>
  );
}
