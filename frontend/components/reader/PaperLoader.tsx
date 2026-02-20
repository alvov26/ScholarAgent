"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MarkdownRenderer from "@/components/reader/MarkdownRenderer";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type PaperMeta = {
  id: string;
  filename: string;
  type: "pdf" | "md" | "tex";
};

export default function PaperLoader() {
  const [papers, setPapers] = useState<PaperMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<PaperMeta["type"] | null>(null);
  const [content, setContent] = useState<string>("");
  const [items, setItems] = useState<any[] | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [arxivLink, setArxivLink] = useState<string>("");

  const loadPapers = async () => {
    try {
      const res = await fetch(`${API_BASE}/papers`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to fetch cached papers");
      }
      const data = await res.json();
      setPapers(data.papers || []);
    } catch (err: any) {
      setError(err.message || "Failed to load cache");
    }
  };

  const loadPaper = async (paperId: string, type: PaperMeta["type"]) => {
    setStatus("Loading paper...");
    setError("");
    setContent("");
    setItems(null);

    try {
      const mdRes = await fetch(`${API_BASE}/paper/${paperId}/markdown`, { cache: "no-store" });
      if (!mdRes.ok) {
        throw new Error("Failed to fetch markdown");
      }
      const mdData = await mdRes.json();
      setContent(mdData.markdown || "");

      if (type === "pdf") {
        const contentRes = await fetch(`${API_BASE}/paper/${paperId}/content`, { cache: "no-store" });
        if (contentRes.ok) {
          const contentData = await contentRes.json();
          setItems(contentData.items || []);
        }
      }
      setStatus("");
    } catch (err: any) {
      setError(err.message || "Failed to load paper");
      setStatus("");
    }
  };

  useEffect(() => {
    loadPapers();
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Uploading and processing...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/paper/upload`, { method: "POST", body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Upload failed");
      }
      const data = await res.json();
      setSelectedId(data.paper_id);
      setSelectedType(data.type);
      await loadPapers();
      await loadPaper(data.paper_id, data.type);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setStatus("");
      event.target.value = "";
    }
  };

  const handleArchiveChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Uploading archive...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/paper/upload`, { method: "POST", body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Upload failed");
      }
      const data = await res.json();
      setSelectedId(data.paper_id);
      setSelectedType(data.type);
      await loadPapers();
      await loadPaper(data.paper_id, data.type);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setStatus("");
      event.target.value = "";
    }
  };

  const handleFolderChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setStatus("Uploading folder...");
    setError("");

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file, file.name);
        const relPath = (file as any).webkitRelativePath || file.name;
        formData.append("paths", relPath);
      });
      const res = await fetch(`${API_BASE}/paper/upload/folder`, { method: "POST", body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Folder upload failed");
      }
      const data = await res.json();
      setSelectedId(data.paper_id);
      setSelectedType(data.type);
      await loadPapers();
      await loadPaper(data.paper_id, data.type);
    } catch (err: any) {
      setError(err.message || "Folder upload failed");
    } finally {
      setStatus("");
      event.target.value = "";
    }
  };

  const handleArxivSubmit = async () => {
    if (!arxivLink.trim()) {
      setError("Enter an arXiv URL or ID");
      return;
    }

    setStatus("Fetching arXiv source...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("url_or_id", arxivLink.trim());
      const res = await fetch(`${API_BASE}/paper/upload/arxiv`, { method: "POST", body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "arXiv fetch failed");
      }
      const data = await res.json();
      setSelectedId(data.paper_id);
      setSelectedType(data.type);
      await loadPapers();
      await loadPaper(data.paper_id, data.type);
      setArxivLink("");
    } catch (err: any) {
      setError(err.message || "arXiv fetch failed");
    } finally {
      setStatus("");
    }
  };

  const handleLoadCached = async () => {
    if (!selectedId || !selectedType) {
      setError("Select a cached paper first");
      return;
    }
    await loadPaper(selectedId, selectedType);
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-5xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Scholar Agent <span className="text-indigo-600">Reader</span>
        </h1>
        <p className="text-slate-500 font-medium">
          Upload a PDF, Markdown, or LaTeX file, or load from cache.
        </p>
        <Link
          href="/math-test"
          className="inline-block mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium underline"
        >
          MathJax Test Page →
        </Link>
      </div>

      <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2 mb-10">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-md p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">
            Upload Document
          </h2>
          <input
            type="file"
            accept=".pdf,.md,.tex"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="text-xs text-slate-400 mt-3">
            Supported: PDF, Markdown, LaTeX (.tex).
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
              Cached Papers
            </h2>
            <button
              onClick={loadPapers}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Refresh
            </button>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedId(nextId);
                const match = papers.find((paper) => paper.id === nextId);
                setSelectedType(match?.type || null);
              }}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-slate-50"
            >
              <option value="">Select cached file...</option>
              {papers.map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.filename} ({paper.type})
                </option>
              ))}
            </select>
            <button
              onClick={handleLoadCached}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Load
            </button>
          </div>
          {papers.length === 0 && (
            <p className="text-xs text-slate-400 mt-3">No cached files yet.</p>
          )}
        </section>
      </div>

      <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3 mb-10">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-md p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">
            LaTeX Archive
          </h2>
          <input
            type="file"
            accept=".zip,.tar,.tar.gz,.tgz"
            onChange={handleArchiveChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="text-xs text-slate-400 mt-3">
            Upload .zip or .tar.gz with sources, images, and .bib.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-md p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">
            LaTeX Folder
          </h2>
          <input
            type="file"
            multiple
            onChange={handleFolderChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            // @ts-ignore
            webkitdirectory="true"
          />
          <p className="text-xs text-slate-400 mt-3">
            Select the LaTeX project folder (Chrome-based browsers).
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-md p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">
            arXiv Source
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={arxivLink}
              onChange={(event) => setArxivLink(event.target.value)}
              placeholder="arXiv URL or ID"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-slate-50"
            />
            <button
              onClick={handleArxivSubmit}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Fetch
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Example: 2401.12345 or arxiv.org/abs/2401.12345
          </p>
        </section>
      </div>

      {status && (
        <div className="max-w-3xl mx-auto mb-6 text-center text-sm text-slate-500">
          {status}
        </div>
      )}
      {error && (
        <div className="max-w-3xl mx-auto mb-6 text-center text-sm text-red-500">
          {error}
        </div>
      )}

      {content ? (
        <MarkdownRenderer content={content} items={items || undefined} paperId={selectedId} />
      ) : (
        <div className="max-w-3xl mx-auto text-center text-sm text-slate-400">
          Select a file to start reading.
        </div>
      )}
    </main>
  );
}
