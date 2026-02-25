'use client';

export default function TooltipPanel() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Annotations
        </h2>
      </div>

      {/* Empty state - will be replaced with actual tooltips */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 shadow-sm text-center">
        <p className="text-sm text-slate-500">No tooltips yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Click on a paragraph to create an annotation
        </p>
      </div>
    </div>
  );
}
