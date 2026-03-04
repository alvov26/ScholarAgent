"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

interface FindResult {
  requestId: number;
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
}

interface ScholarAgentAPI {
  findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean }) => void;
  stopFindInPage: (action?: string) => void;
  onFindResult: (callback: (result: FindResult) => void) => () => void;
}

declare global {
  interface Window {
    scholarAgent?: ScholarAgentAPI;
  }
}

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchBar({ isOpen, onClose }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [matchInfo, setMatchInfo] = useState<{ current: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isElectron = typeof window !== "undefined" && !!window.scholarAgent;

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Listen for find results from Electron
  useEffect(() => {
    if (!isElectron || !window.scholarAgent) return;

    const cleanup = window.scholarAgent.onFindResult((result: FindResult) => {
      if (result.finalUpdate) {
        setMatchInfo({
          current: result.activeMatchOrdinal,
          total: result.matches,
        });
      }
    });

    return cleanup;
  }, [isElectron]);

  // Perform search
  const doSearch = useCallback((forward = true, findNext = false) => {
    if (!searchQuery.trim()) {
      setMatchInfo(null);
      return;
    }

    if (isElectron && window.scholarAgent) {
      window.scholarAgent.findInPage(searchQuery, { forward, findNext });
    } else {
      // Browser fallback - use window.find (limited support)
      try {
        // @ts-ignore - window.find is non-standard
        window.find(searchQuery, false, !forward, true, false, true, false);
      } catch {
        // Silently fail if not supported
      }
    }
  }, [searchQuery, isElectron]);

  // Search when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      doSearch(true, false);
    } else {
      // Clear search
      if (isElectron && window.scholarAgent) {
        window.scholarAgent.stopFindInPage("clearSelection");
      }
      setMatchInfo(null);
    }
  }, [searchQuery, doSearch, isElectron]);

  // Handle close
  const handleClose = useCallback(() => {
    if (isElectron && window.scholarAgent) {
      window.scholarAgent.stopFindInPage("clearSelection");
    }
    setSearchQuery("");
    setMatchInfo(null);
    onClose();
  }, [isElectron, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        doSearch(!e.shiftKey, true);
      } else if (e.key === "F3" || (e.key === "g" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        doSearch(!e.shiftKey, true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, doSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-lg border border-slate-200 p-2 flex items-center gap-2">
      <Search size={14} className="text-slate-400 ml-1" />
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Find in page..."
        className="w-48 px-2 py-1 text-sm text-slate-900 border-none focus:outline-none placeholder:text-slate-400"
      />

      {/* Match count */}
      {matchInfo && (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {matchInfo.total > 0
            ? `${matchInfo.current}/${matchInfo.total}`
            : "No matches"
          }
        </span>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5 border-l border-slate-200 pl-2">
        <button
          onClick={() => doSearch(false, true)}
          disabled={!searchQuery}
          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
          title="Previous (Shift+Enter)"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => doSearch(true, true)}
          disabled={!searchQuery}
          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
          title="Next (Enter)"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      <button
        onClick={handleClose}
        className="text-slate-400 hover:text-slate-600 p-1"
        title="Close (Esc)"
      >
        <X size={14} />
      </button>
    </div>
  );
}
