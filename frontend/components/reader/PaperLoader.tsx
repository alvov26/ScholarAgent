"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePapers, Paper, PaperDetail } from "@/hooks/usePapers";
import { useTooltips } from "@/hooks/useTooltips";
import { HTMLRenderer } from "./HTMLRenderer";
import ResizableLayout from "./ResizableLayout";
import NavigationPanel from "./NavigationPanel";
import TooltipPanel from "./TooltipPanel";
import { parseTOC } from "@/utils/parseTOC";
import { Loader2, Upload, ExternalLink, Trash2, RefreshCw, FileText, AlertCircle } from "lucide-react";

export default function PaperLoader() {
  const {
    papers,
    loading: papersLoading,
    error: papersError,
    fetchPapers,
    fetchPaper,
    uploadPaper,
    uploadArxiv,
    compilePaper,
    deletePaper,
    clearError: clearPapersError,
  } = usePapers();

  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [currentPaper, setCurrentPaper] = useState<PaperDetail | null>(null);
  const [arxivInput, setArxivInput] = useState("");
  const [status, setStatus] = useState<string>("");

  const {
    tooltipMap,
    loading: tooltipsLoading,
    error: tooltipsError,
    createTooltip,
    updateTooltip,
    deleteTooltip,
  } = useTooltips(selectedPaperId);

  // Load papers on mount
  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Load selected paper
  const loadPaper = useCallback(async (paperId: string) => {
    setStatus("Loading paper...");
    const paper = await fetchPaper(paperId);
    if (paper) {
      setCurrentPaper(paper);
      setSelectedPaperId(paperId);
    }
    setStatus("");
  }, [fetchPaper]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Uploading and compiling...");
    clearPapersError();

    const paper = await uploadPaper(file, true);
    if (paper) {
      await loadPaper(paper.id);
    }
    setStatus("");
    event.target.value = "";
  };

  // Handle arXiv fetch
  const handleArxivFetch = async () => {
    if (!arxivInput.trim()) return;

    setStatus("Fetching from arXiv...");
    clearPapersError();

    const paper = await uploadArxiv(arxivInput.trim(), true);
    if (paper) {
      await loadPaper(paper.id);
      setArxivInput("");
    }
    setStatus("");
  };

  // Handle recompile
  const handleRecompile = async () => {
    if (!selectedPaperId) return;

    setStatus("Recompiling...");
    clearPapersError();

    const paper = await compilePaper(selectedPaperId);
    if (paper) {
      await loadPaper(paper.id);
    }
    setStatus("");
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedPaperId) return;

    if (!confirm("Delete this paper and all its annotations?")) return;

    setStatus("Deleting...");
    const success = await deletePaper(selectedPaperId);
    if (success) {
      setSelectedPaperId(null);
      setCurrentPaper(null);
    }
    setStatus("");
  };

  const error = papersError || tooltipsError;
  const loading = papersLoading || tooltipsLoading || !!status;

  // Parse TOC from current paper
  const toc = useMemo(() => {
    if (!currentPaper?.html_content) return [];
    return parseTOC(currentPaper.html_content);
  }, [currentPaper?.html_content]);

  // Handle navigation to section
  const handleNavigate = useCallback((dataId: string) => {
    const element = document.querySelector(`[data-id="${dataId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Add flash effect
      element.classList.add('toc-flash');
      setTimeout(() => {
        element.classList.remove('toc-flash');
      }, 1500);
    }
  }, []);

  // Get all tooltips as flat array
  const allTooltips = useMemo(() => {
    return Object.values(tooltipMap).flat();
  }, [tooltipMap]);

  // Handle tooltip edit from panel
  const handleTooltipEdit = useCallback((tooltip: any) => {
    // TODO: Open edit modal/form
    // For now, use a simple prompt
    const newContent = prompt('Edit tooltip content:', tooltip.content);
    if (newContent !== null && newContent.trim()) {
      updateTooltip(tooltip.id, newContent.trim(), tooltip.target_text);
    }
  }, [updateTooltip]);

  // Handle tooltip pin/unpin
  const handleTooltipPin = useCallback((tooltipId: string) => {
    const tooltip = allTooltips.find(t => t.id === tooltipId);
    if (!tooltip) return;

    // Toggle pin state
    updateTooltip(tooltip.id, tooltip.content, tooltip.target_text || undefined, !tooltip.is_pinned);
  }, [allTooltips, updateTooltip]);

  // Left panel content
  const leftPanel = (
    <NavigationPanel
      toc={toc}
      onNavigate={handleNavigate}
    />
  );

  // Main panel content
  const mainPanel = (
    <div className="py-8 px-4">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Scholar Agent <span className="text-indigo-600">Reader</span>
        </h1>
        <p className="text-slate-500">
          Upload LaTeX sources or fetch from arXiv to start reading
        </p>
      </div>

      {/* Controls */}
      <div className="max-w-5xl mx-auto grid gap-4 md:grid-cols-3 mb-8">
        {/* Upload */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Upload size={14} />
            Upload LaTeX
          </h2>
          <input
            type="file"
            accept=".tar.gz,.tgz,.tar,.zip"
            onChange={handleFileUpload}
            disabled={loading}
            className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
          />
          <p className="text-xs text-slate-400 mt-2">
            .tar.gz, .tgz, or .zip archives
          </p>
        </section>

        {/* arXiv */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <ExternalLink size={14} />
            arXiv Source
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={arxivInput}
              onChange={(e) => setArxivInput(e.target.value)}
              placeholder="2401.12345"
              disabled={loading}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
              onKeyDown={(e) => e.key === "Enter" && handleArxivFetch()}
            />
            <button
              onClick={handleArxivFetch}
              disabled={loading || !arxivInput.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Fetch
            </button>
          </div>
        </section>

        {/* Cached Papers */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText size={14} />
              Library
            </h2>
            <button
              onClick={fetchPapers}
              disabled={loading}
              className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <select
            value={selectedPaperId || ""}
            onChange={(e) => e.target.value && loadPaper(e.target.value)}
            disabled={loading}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 disabled:opacity-50"
          >
            <option value="">Select a paper...</option>
            {papers.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.filename} {!paper.has_html && "(not compiled)"}
              </option>
            ))}
          </select>
          {papers.length === 0 && !loading && (
            <p className="text-xs text-slate-400 mt-2">No papers yet</p>
          )}
        </section>
      </div>

      {/* Status/Error */}
      {status && (
        <div className="max-w-5xl mx-auto mb-4">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            {status}
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-5xl mx-auto mb-4">
          <div className="flex items-center justify-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
            <AlertCircle size={16} />
            {error}
          </div>
        </div>
      )}

      {/* Paper Actions */}
      {currentPaper && (
        <div className="max-w-5xl mx-auto mb-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-medium">{currentPaper.filename}</span>
            {currentPaper.arxiv_id && (
              <span className="ml-2 text-slate-400">
                (arXiv:{currentPaper.arxiv_id})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRecompile}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} />
              Recompile
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {currentPaper?.html_content ? (
        <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl border border-slate-100 p-8 md:p-12 min-h-[60vh]">
          <HTMLRenderer
            html={currentPaper.html_content}
            paperId={currentPaper.id}
            tooltips={tooltipMap}
            onTooltipCreate={createTooltip}
            onTooltipUpdate={updateTooltip}
            onTooltipDelete={deleteTooltip}
          />
        </div>
      ) : currentPaper && !currentPaper.has_html ? (
        <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-slate-400 mb-4">
            <FileText size={48} className="mx-auto opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Paper Not Compiled
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            This paper hasn't been compiled to HTML yet.
          </p>
          <button
            onClick={handleRecompile}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} />
            Compile Now
          </button>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto text-center text-sm text-slate-400 py-20">
          Upload a LaTeX archive or select a paper to start reading
        </div>
      )}
    </div>
  );

  // Right panel content
  const rightPanel = (
    <TooltipPanel
      tooltips={allTooltips}
      toc={toc}
      onEdit={handleTooltipEdit}
      onDelete={deleteTooltip}
      onPin={handleTooltipPin}
      onNavigate={handleNavigate}
    />
  );

  return (
    <ResizableLayout
      leftPanel={leftPanel}
      mainPanel={mainPanel}
      rightPanel={rightPanel}
    />
  );
}
