'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Check, ChevronDown, ChevronRight, Sparkles, Loader2, Plus, Trash2 } from 'lucide-react';
import { LatexText } from './LatexText';

export interface StoredSuggestion {
  id: string;
  entity_id?: string;
  entity_label: string;
  entity_type: string;
  tooltip_content: string;
  is_ai_generated: boolean;
}

interface TooltipSuggestionsDialogProps {
  isOpen: boolean;
  paperId: string;
  hasKnowledgeGraph: boolean;
  onClose: () => void;
  onApply: (selectedSuggestions: StoredSuggestion[]) => Promise<void>;
  onRegenerateAI: () => Promise<void>;
}

export default function TooltipSuggestionsDialog({
  isOpen,
  paperId,
  hasKnowledgeGraph,
  onClose,
  onApply,
  onRegenerateAI,
}: TooltipSuggestionsDialogProps) {
  const [suggestions, setSuggestions] = useState<StoredSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editedContent, setEditedContent] = useState<Map<string, string>>(new Map());
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Manual suggestion form state
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [manualLabel, setManualLabel] = useState('');
  const [manualType, setManualType] = useState('definition');
  const [manualContent, setManualContent] = useState('');
  const [creating, setCreating] = useState(false);

  // Load suggestions when dialog opens
  useEffect(() => {
    if (isOpen && paperId) {
      loadSuggestions();
    }
  }, [isOpen, paperId]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/papers/${paperId}/suggestions`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
        // Select all by default
        setSelectedIds(new Set(data.map((s: StoredSuggestion) => s.id)));
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManual = async () => {
    if (!manualLabel.trim() || !manualContent.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`http://localhost:8000/api/papers/${paperId}/suggestions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_label: manualLabel.trim(),
          entity_type: manualType,
          tooltip_content: manualContent.trim(),
        }),
      });

      if (response.ok) {
        const newSuggestion = await response.json();
        setSuggestions([newSuggestion, ...suggestions]);
        setSelectedIds(new Set([...selectedIds, newSuggestion.id]));
        // Clear form
        setManualLabel('');
        setManualContent('');
      }
    } catch (error) {
      console.error('Failed to create manual suggestion:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/papers/${paperId}/suggestions/${suggestionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuggestions(suggestions.filter(s => s.id !== suggestionId));
        const newSelected = new Set(selectedIds);
        newSelected.delete(suggestionId);
        setSelectedIds(newSelected);
      }
    } catch (error) {
      console.error('Failed to delete suggestion:', error);
    }
  };

  const handleRegenerateAI = async () => {
    setRegenerating(true);
    try {
      await onRegenerateAI();
      await loadSuggestions();
    } finally {
      setRegenerating(false);
    }
  };

  // Separate manual and AI suggestions
  const { manualSuggestions, aiSuggestions } = useMemo(() => {
    const manual: StoredSuggestion[] = [];
    const ai: StoredSuggestion[] = [];

    suggestions.forEach(s => {
      if (s.is_ai_generated) {
        ai.push(s);
      } else {
        manual.push(s);
      }
    });

    return { manualSuggestions: manual, aiSuggestions: ai };
  }, [suggestions]);

  if (!isOpen) return null;

  const handleToggleSelect = (suggestionId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(suggestionId)) {
      newSelected.delete(suggestionId);
    } else {
      newSelected.add(suggestionId);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleExpand = (suggestionId: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(suggestionId)) {
      newExpanded.delete(suggestionId);
    } else {
      newExpanded.add(suggestionId);
    }
    setExpandedIds(newExpanded);
  };

  const handleContentEdit = (suggestionId: string, newContent: string) => {
    const newEdited = new Map(editedContent);
    newEdited.set(suggestionId, newContent);
    setEditedContent(newEdited);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const selected = suggestions
        .filter(s => selectedIds.has(s.id))
        .map(s => ({
          ...s,
          tooltip_content: editedContent.get(s.id) || s.tooltip_content,
        }));

      await onApply(selected);
    } finally {
      setApplying(false);
    }
  };

  const selectedCount = selectedIds.size;

  const renderSuggestion = (suggestion: StoredSuggestion) => {
    const isSelected = selectedIds.has(suggestion.id);
    const isExpanded = expandedIds.has(suggestion.id);
    const currentContent = editedContent.get(suggestion.id) || suggestion.tooltip_content;

    return (
      <div
        key={suggestion.id}
        className={`
          border rounded-lg transition-all
          ${isSelected ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white'}
        `}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleToggleSelect(suggestion.id)}
            className="mt-1 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="font-medium text-slate-900 break-words">
                  <LatexText text={suggestion.entity_label} className="inline" />
                </div>
                <div className="text-xs text-slate-500 mt-0.5 capitalize">
                  {suggestion.entity_type}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Expand/Collapse */}
                <button
                  onClick={() => handleToggleExpand(suggestion.id)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                {/* Delete */}
                <button
                  onClick={() => handleDeleteSuggestion(suggestion.id)}
                  className="text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Preview */}
            {!isExpanded && (
              <div className="text-sm text-slate-600 mt-2 line-clamp-2">
                {currentContent}
              </div>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-3 border-t border-slate-200 pt-3 mt-0">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Tooltip Content
              </label>
              <textarea
                value={currentContent}
                onChange={(e) => handleContentEdit(suggestion.id, e.target.value)}
                rows={3}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="text-indigo-600" size={24} />
              Tooltip Suggestions
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {manualSuggestions.length} manual, {aiSuggestions.length} AI-generated
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Manual Tooltip Form - Fixed at top */}
          <div className="border-b border-slate-200">
            <button
              onClick={() => setFormCollapsed(!formCollapsed)}
              className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Add Manual Tooltip
              </h3>
              {formCollapsed ? <ChevronRight size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            {!formCollapsed && (
              <div className="px-6 pb-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">
                        Term/Symbol
                      </label>
                      <input
                        type="text"
                        value={manualLabel}
                        onChange={(e) => setManualLabel(e.target.value)}
                        placeholder="e.g., α, gradient descent"
                        className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">
                        Type
                      </label>
                      <select
                        value={manualType}
                        onChange={(e) => setManualType(e.target.value)}
                        className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="symbol" className="text-slate-900">Symbol</option>
                        <option value="definition" className="text-slate-900">Definition</option>
                        <option value="theorem" className="text-slate-900">Theorem</option>
                        <option value="other" className="text-slate-900">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Tooltip Content
                    </label>
                    <textarea
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder="Explanation or definition..."
                      rows={2}
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleCreateManual}
                    disabled={!manualLabel.trim() || !manualContent.trim() || creating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    Add Tooltip
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Suggestions List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
              </div>
            ) : (
              <>
                {/* Manual Tooltips */}
                {manualSuggestions.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">
                      Manual Tooltips ({manualSuggestions.length})
                    </h3>
                    <div className="space-y-2">
                      {manualSuggestions.map(renderSuggestion)}
                    </div>
                  </div>
                )}

                {/* AI Suggestions Section */}
                {aiSuggestions.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        AI Suggestions ({aiSuggestions.length})
                      </h3>
                      <button
                        onClick={handleRegenerateAI}
                        disabled={!hasKnowledgeGraph || regenerating}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {regenerating ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            Regenerate
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiSuggestions.map(renderSuggestion)}
                    </div>
                  </div>
                )}

                {/* Empty state for AI suggestions */}
                {aiSuggestions.length === 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">
                      AI Suggestions (0)
                    </h3>
                    <div className="text-sm text-slate-500 text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                      {hasKnowledgeGraph ? (
                        <div>
                          <p className="mb-2">No AI suggestions yet.</p>
                          <button
                            onClick={handleRegenerateAI}
                            disabled={regenerating}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Sparkles size={12} />
                            Generate AI Suggestions
                          </button>
                        </div>
                      ) : (
                        'Build a knowledge graph first to enable AI suggestions.'
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-600">
            <span className="font-medium">{selectedCount}</span> tooltip{selectedCount !== 1 ? 's' : ''} selected
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying || selectedCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {applying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Apply {selectedCount} Tooltip{selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
