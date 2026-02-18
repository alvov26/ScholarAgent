"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, Terminal } from "lucide-react";

interface Props {
  children: ReactNode;
  metadata?: {
    page?: number;
    type?: string;
    index?: number;
    content?: string;
  };
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RenderingErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const meta = this.props.metadata;
    console.group(`%c [RENDER ERROR] Page ${meta?.page || '?'} | ${meta?.type || 'unknown'}`, 
      "color: white; background: #ef4444; font-weight: bold; padding: 2px 6px; border-radius: 4px;");
    
    console.error("Error Message:", error.message);
    console.error("Context:", {
      page: meta?.page,
      type: meta?.type,
      index: meta?.index,
      componentStack: errorInfo.componentStack
    });
    
    if (meta?.content) {
      console.log("%c Problematic Content Snippet:", "font-weight: bold; color: #6366f1;");
      console.log(meta.content.substring(0, 500) + (meta.content.length > 500 ? "..." : ""));
      console.log("%c Full Block Content:", "font-weight: bold; color: #6366f1;");
      console.log(meta.content);
    }
    
    console.groupEnd();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="my-6 p-5 border-2 border-red-100 bg-red-50/50 rounded-2xl flex flex-col gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-900 leading-tight">Block Rendering Failed</h4>
              <p className="text-xs text-red-700 mt-1 font-medium leading-relaxed">
                {this.state.error?.message || "An unexpected error occurred during rendering."}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center border-t border-red-100 pt-4 mt-2">
            {this.props.metadata?.page && (
              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-black uppercase tracking-wider">
                Page {this.props.metadata.page}
              </span>
            )}
            {this.props.metadata?.type && (
              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-black uppercase tracking-wider">
                {this.props.metadata.type}
              </span>
            )}
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="ml-auto text-[10px] font-bold text-red-600 hover:text-red-800 hover:bg-red-100 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
            >
              <Terminal size={12} />
              Check Console for Logs
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RenderingErrorBoundary;
