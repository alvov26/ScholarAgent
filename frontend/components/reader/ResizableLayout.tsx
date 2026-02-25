'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { ChevronLeft, ChevronRight, Menu, SidebarClose } from 'lucide-react';

interface ResizableLayoutProps {
  leftPanel: ReactNode;
  mainPanel: ReactNode;
  rightPanel: ReactNode;
}

const STORAGE_KEYS = {
  LEFT_COLLAPSED: 'reader-left-panel-collapsed',
  RIGHT_COLLAPSED: 'reader-right-panel-collapsed',
};

export default function ResizableLayout({
  leftPanel,
  mainPanel,
  rightPanel,
}: ResizableLayoutProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const rightPanelRef = useRef<PanelImperativeHandle>(null);

  // Load collapse state from localStorage on mount
  useEffect(() => {
    const storedLeftCollapsed = localStorage.getItem(STORAGE_KEYS.LEFT_COLLAPSED);
    const storedRightCollapsed = localStorage.getItem(STORAGE_KEYS.RIGHT_COLLAPSED);

    if (storedLeftCollapsed === 'true') {
      setLeftCollapsed(true);
      leftPanelRef.current?.collapse();
    }
    if (storedRightCollapsed === 'true') {
      setRightCollapsed(true);
      rightPanelRef.current?.collapse();
    }
  }, []);

  const toggleLeftPanel = () => {
    const newState = !leftCollapsed;
    if (newState) {
      // Collapsing
      leftPanelRef.current?.collapse();
    } else {
      // Expanding
      leftPanelRef.current?.expand();
    }
    setLeftCollapsed(newState);
    localStorage.setItem(STORAGE_KEYS.LEFT_COLLAPSED, String(newState));
  };

  const toggleRightPanel = () => {
    const newState = !rightCollapsed;
    if (newState) {
      // Collapsing
      rightPanelRef.current?.collapse();
    } else {
      // Expanding
      rightPanelRef.current?.expand();
    }
    setRightCollapsed(newState);
    localStorage.setItem(STORAGE_KEYS.RIGHT_COLLAPSED, String(newState));
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Top toolbar with panel toggles */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLeftPanel}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors"
            title={leftCollapsed ? 'Show navigation' : 'Hide navigation'}
          >
            {leftCollapsed ? <Menu size={18} /> : <SidebarClose size={18} />}
          </button>
          <span className="text-sm text-slate-600 font-medium">
            Scholar Agent Reader
          </span>
        </div>
        <button
          onClick={toggleRightPanel}
          className="p-1.5 rounded hover:bg-slate-100 transition-colors"
          title={rightCollapsed ? 'Show tooltips' : 'Hide tooltips'}
        >
          {rightCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Main resizable layout */}
      <div className="flex-1 overflow-hidden">
        <Group
          orientation="horizontal"
          style={{ height: '100%', width: '100%' }}
          id="reader-panel-group"
        >
        {/* Left Panel - Navigation */}
        <Panel
          id="left-panel"
          panelRef={leftPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={20}
          minSize={10}
          className="bg-white border-r border-slate-200"
        >
          {!leftCollapsed && (
            <div className="h-full overflow-y-auto p-4">
              {leftPanel}
            </div>
          )}
        </Panel>

        <Separator className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors cursor-col-resize" />

        {/* Middle Panel - Main Content */}
        <Panel id="main-panel" defaultSize={55} minSize={30} className="bg-slate-50">
          <div className="h-full overflow-y-auto">
            {mainPanel}
          </div>
        </Panel>

        <Separator className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors cursor-col-resize" />

        {/* Right Panel - Tooltips */}
        <Panel
          id="right-panel"
          panelRef={rightPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={25}
          minSize={15}
          className="bg-white border-l border-slate-200"
        >
          {!rightCollapsed && (
            <div className="h-full overflow-y-auto p-4">
              {rightPanel}
            </div>
          )}
        </Panel>
      </Group>
      </div>
    </div>
  );
}
