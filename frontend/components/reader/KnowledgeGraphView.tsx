'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GraphNode } from './GraphNode';
import { KnowledgeGraphProgress } from './KnowledgeGraphProgress';
import { Loader2, AlertCircle, Network } from 'lucide-react';

// Custom node types
const nodeTypes = {
  symbol: GraphNode,
  definition: GraphNode,
  theorem: GraphNode,
};

// Edge colors by relationship type
const edgeColors: Record<string, string> = {
  uses: '#6366f1',       // indigo
  depends_on: '#f59e0b', // amber
  defines: '#10b981',    // emerald
  extends: '#8b5cf6',    // violet
  mentions: '#94a3b8',   // slate
};

interface KnowledgeGraphViewProps {
  paperId: string;
  onNavigate: (domNodeId: string) => void;
}

interface ApiNode {
  id: string;
  type: string;
  label: string;
  context?: string;
  definition?: string;
  statement?: string;
  dom_node_id: string;
  section_id: string;
  latex?: string;
}

interface ApiEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  evidence?: string;
}

interface GraphData {
  nodes: ApiNode[];
  edges: ApiEdge[];
  metadata?: {
    node_count: number;
    edge_count: number;
    symbol_count: number;
    definition_count: number;
    theorem_count: number;
  };
}

/**
 * Simple grid-based auto-layout for nodes.
 * Groups nodes by type for better visual organization.
 */
function autoLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  // Group nodes by type
  const symbolNodes = nodes.filter(n => n.data.nodeType === 'symbol');
  const definitionNodes = nodes.filter(n => n.data.nodeType === 'definition');
  const theoremNodes = nodes.filter(n => n.data.nodeType === 'theorem');

  const nodeWidth = 180;
  const nodeHeight = 80;
  const horizontalGap = 40;
  const verticalGap = 60;
  const sectionGap = 100;

  let currentY = 0;

  // Layout definitions at the top (they're usually foundational)
  const defCols = Math.min(4, Math.max(1, definitionNodes.length));
  definitionNodes.forEach((node, i) => {
    node.position = {
      x: (i % defCols) * (nodeWidth + horizontalGap),
      y: currentY + Math.floor(i / defCols) * (nodeHeight + verticalGap),
    };
  });

  if (definitionNodes.length > 0) {
    currentY += Math.ceil(definitionNodes.length / defCols) * (nodeHeight + verticalGap) + sectionGap;
  }

  // Layout theorems in the middle
  const thmCols = Math.min(3, Math.max(1, theoremNodes.length));
  theoremNodes.forEach((node, i) => {
    node.position = {
      x: (i % thmCols) * (nodeWidth + horizontalGap),
      y: currentY + Math.floor(i / thmCols) * (nodeHeight + verticalGap),
    };
  });

  if (theoremNodes.length > 0) {
    currentY += Math.ceil(theoremNodes.length / thmCols) * (nodeHeight + verticalGap) + sectionGap;
  }

  // Layout symbols at the bottom (there are usually many)
  const symCols = Math.min(6, Math.max(1, symbolNodes.length));
  symbolNodes.forEach((node, i) => {
    node.position = {
      x: (i % symCols) * (nodeWidth + horizontalGap),
      y: currentY + Math.floor(i / symCols) * (nodeHeight + verticalGap),
    };
  });

  return { nodes, edges };
}

export function KnowledgeGraphView({ paperId, onNavigate }: KnowledgeGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  // Fetch graph data
  const fetchGraphData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/papers/${paperId}/knowledge-graph`)
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('not_built');
          }
          throw new Error(`Failed to load graph: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: GraphData) => {
        setGraphData(data);

        // Convert API nodes to React Flow nodes
        const flowNodes: Node[] = data.nodes.map((n) => ({
          id: n.id,
          type: n.type, // This maps to our custom node types
          data: {
            label: n.label,
            nodeType: n.type,
            context: n.context,
            definition: n.definition,
            statement: n.statement,
            latex: n.latex,
            domNodeId: n.dom_node_id,
            onNavigate: () => onNavigate(n.dom_node_id),
          },
          position: { x: 0, y: 0 }, // Will be set by autoLayout
        }));

        // Convert API edges to React Flow edges
        const flowEdges: Edge[] = data.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.type,
          type: 'smoothstep',
          animated: e.type === 'uses' || e.type === 'depends_on',
          style: { stroke: edgeColors[e.type] || '#94a3b8' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColors[e.type] || '#94a3b8',
          },
          data: { evidence: e.evidence },
        }));

        // Apply layout
        const layouted = autoLayout(flowNodes, flowEdges);

        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [paperId, setNodes, setEdges, onNavigate]);

  // Initial fetch
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Listen for build events from parent (PaperLoader)
  useEffect(() => {
    const handleBuildStart = () => {
      setIsBuilding(true);
      setError(null);
    };

    window.addEventListener('kg-build-start', handleBuildStart);
    return () => window.removeEventListener('kg-build-start', handleBuildStart);
  }, []);

  const handleBuildComplete = useCallback(() => {
    setIsBuilding(false);
    fetchGraphData();
  }, [fetchGraphData]);

  const handleBuildError = useCallback((errorMsg: string) => {
    setIsBuilding(false);
    setError(errorMsg);
  }, []);

  // Show progress during build
  if (isBuilding) {
    return (
      <KnowledgeGraphProgress
        paperId={paperId}
        onComplete={handleBuildComplete}
        onError={handleBuildError}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 p-4">
        <Loader2 size={24} className="animate-spin" />
        <span className="text-sm">Loading knowledge graph...</span>
      </div>
    );
  }

  // Error state - graph not built yet
  if (error === 'not_built') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 p-6 text-center">
        <Network size={32} className="text-slate-300" />
        <p className="text-sm font-medium">Knowledge graph not built yet</p>
        <p className="text-xs text-slate-400">
          Use the &quot;Build Graph&quot; button to extract concepts and relationships from this paper.
        </p>
      </div>
    );
  }

  // Error state - other errors
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500 gap-3 p-4">
        <AlertCircle size={24} />
        <span className="text-sm">Error: {error}</span>
      </div>
    );
  }

  // Empty state
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 p-4">
        <Network size={32} className="text-slate-300" />
        <span className="text-sm">No entities extracted</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {/* Stats bar */}
      {graphData?.metadata && (
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex gap-4">
          <span>{graphData.metadata.symbol_count} symbols</span>
          <span>{graphData.metadata.definition_count} definitions</span>
          <span>{graphData.metadata.theorem_count} theorems</span>
          <span className="text-slate-400">|</span>
          <span>{graphData.metadata.edge_count} relationships</span>
        </div>
      )}

      {/* Graph */}
      <div className="w-full" style={{ height: 'calc(100% - 36px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background color="#e2e8f0" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.data?.nodeType) {
                case 'symbol': return '#3b82f6';
                case 'definition': return '#10b981';
                case 'theorem': return '#8b5cf6';
                default: return '#94a3b8';
              }
            }}
            maskColor="rgba(255, 255, 255, 0.8)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
