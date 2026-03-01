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
  EdgeMouseHandler,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { GraphNode } from './GraphNode';
import { KnowledgeGraphProgress } from './KnowledgeGraphProgress';
import { EdgeInfoPanel } from './EdgeInfoPanel';
import { NodeInfoPanel } from './NodeInfoPanel';
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
 * Hybrid layout: hierarchical for connected nodes, compact grid for isolated nodes.
 */
function hierarchicalLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const nodeWidth = 180;
  const nodeHeight = 80;

  // Identify which nodes are connected (have at least one edge)
  const connectedNodeIds = new Set<string>();
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
  const isolatedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));

  // Layout connected nodes hierarchically using dagre
  if (connectedNodes.length > 0) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
      rankdir: 'LR',   // Left to Right
      nodesep: 100,    // Vertical spacing between nodes
      ranksep: 200,    // Horizontal spacing between ranks
      marginx: 50,
      marginy: 50,
      ranker: 'network-simplex',
    });

    // Add connected nodes to dagre
    connectedNodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    // Add edges
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculate layout
    dagre.layout(dagreGraph);

    // Apply positions
    connectedNodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.position = {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      };
    });
  }

  // Layout isolated nodes in a compact grid at the bottom-right
  if (isolatedNodes.length > 0) {
    const cols = Math.ceil(Math.sqrt(isolatedNodes.length)); // Square-ish grid
    const startX = 50;  // Start at left edge
    const startY = connectedNodes.length > 0
      ? Math.max(...connectedNodes.map(n => n.position.y)) + nodeHeight + 200  // Below connected graph
      : 50;  // Or at top if no connected nodes

    isolatedNodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      node.position = {
        x: startX + col * (nodeWidth + 40),
        y: startY + row * (nodeHeight + 40),
      };
    });
  }

  return { nodes, edges };
}

export function KnowledgeGraphView({ paperId, onNavigate }: KnowledgeGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<{
    sourceId: string;
    targetId: string;
    sourceLabel: string;
    targetLabel: string;
    type: string;
    evidence?: string;
  } | null>(null);
  const [selectedNode, setSelectedNode] = useState<{
    label: string;
    nodeType: 'symbol' | 'definition' | 'theorem';
    context?: string;
    definition?: string;
    statement?: string;
    latex?: string;
    onNavigate: () => void;
  } | null>(null);

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

        // Apply hierarchical layout
        const layouted = hierarchicalLayout(flowNodes, flowEdges);

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

  // Handle node click to show full details
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    event.stopPropagation();

    setSelectedNode({
      label: node.data.label,
      nodeType: node.data.nodeType,
      context: node.data.context,
      definition: node.data.definition,
      statement: node.data.statement,
      latex: node.data.latex,
      onNavigate: node.data.onNavigate,
    });

    // Close edge panel if open
    setSelectedEdge(null);
  }, []);

  // Handle edge click to show evidence
  const onEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    event.stopPropagation();

    // Find source and target nodes to get their labels
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (sourceNode && targetNode) {
      setSelectedEdge({
        sourceId: edge.source,
        targetId: edge.target,
        sourceLabel: sourceNode.data.label,
        targetLabel: targetNode.data.label,
        type: edge.label as string || edge.type,
        evidence: edge.data?.evidence,
      });

      // Close node panel if open
      setSelectedNode(null);
    }
  }, [nodes]);

  // Helper to show node info by ID
  const showNodeById = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode({
        label: node.data.label,
        nodeType: node.data.nodeType,
        context: node.data.context,
        definition: node.data.definition,
        statement: node.data.statement,
        latex: node.data.latex,
        onNavigate: node.data.onNavigate,
      });
      setSelectedEdge(null);
    }
  }, [nodes]);

  // Close info panels when clicking on the background
  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
    setSelectedNode(null);
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
      <div className="w-full relative" style={{ height: 'calc(100% - 36px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
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

        {/* Node info panel */}
        {selectedNode && (
          <NodeInfoPanel
            label={selectedNode.label}
            nodeType={selectedNode.nodeType}
            context={selectedNode.context}
            definition={selectedNode.definition}
            statement={selectedNode.statement}
            latex={selectedNode.latex}
            onNavigate={() => {
              selectedNode.onNavigate();
              setSelectedNode(null);
            }}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Edge info panel */}
        {selectedEdge && (
          <EdgeInfoPanel
            sourceLabel={selectedEdge.sourceLabel}
            targetLabel={selectedEdge.targetLabel}
            relationshipType={selectedEdge.type}
            evidence={selectedEdge.evidence}
            onClickSource={() => showNodeById(selectedEdge.sourceId)}
            onClickTarget={() => showNodeById(selectedEdge.targetId)}
            onClose={() => setSelectedEdge(null)}
          />
        )}
      </div>
    </div>
  );
}
