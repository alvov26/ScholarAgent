/**
 * TreeView Component
 *
 * Reusable hierarchical tree component for displaying nested structures.
 * Used for table of contents, grouped tooltips, and other hierarchical data.
 *
 * Usage:
 * <TreeView
 *   nodes={tocNodes}
 *   renderNode={(node, { isExpanded, depth, isActive, toggle }) => (
 *     <div onClick={() => onNavigate(node.id)}>
 *       {node.title}
 *     </div>
 *   )}
 *   getNodeId={(node) => node.id}
 *   getNodeChildren={(node) => node.children}
 *   activeNodeId={currentSectionId}
 * />
 */

import { ReactNode, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export interface TreeNodeRenderProps<T> {
  isExpanded: boolean;
  isActive: boolean;
  depth: number;
  hasChildren: boolean;
  toggle: () => void;
}

interface TreeViewProps<T> {
  nodes: T[];
  renderNode: (node: T, props: TreeNodeRenderProps<T>) => ReactNode;
  getNodeId: (node: T) => string;
  getNodeChildren: (node: T) => T[];
  activeNodeId?: string | null;
  defaultExpanded?: boolean;
  indentSize?: number; // px per level, default 12
  baseIndent?: number; // base padding in px, default 8
}

interface TreeNodeProps<T> {
  node: T;
  depth: number;
  renderNode: (node: T, props: TreeNodeRenderProps<T>) => ReactNode;
  getNodeId: (node: T) => string;
  getNodeChildren: (node: T) => T[];
  activeNodeId?: string | null;
  defaultExpanded: boolean;
  indentSize: number;
  baseIndent: number;
}

function TreeNode<T>({
  node,
  depth,
  renderNode,
  getNodeId,
  getNodeChildren,
  activeNodeId,
  defaultExpanded,
  indentSize,
  baseIndent,
}: TreeNodeProps<T>) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const children = getNodeChildren(node);
  const hasChildren = children.length > 0;
  const nodeId = getNodeId(node);
  const isActive = activeNodeId === nodeId;

  const toggle = () => setExpanded(!expanded);

  return (
    <div>
      <div
        className="w-full"
        style={{ paddingLeft: `${depth * indentSize + baseIndent}px` }}
      >
        <div className="flex items-center gap-1.5">
          {/* Chevron for expand/collapse */}
          {hasChildren && (
            <button
              onClick={toggle}
              className="flex-shrink-0 hover:bg-slate-200 rounded p-0.5 -m-0.5 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          {!hasChildren && <div className="w-3.5" />} {/* Spacer for alignment */}

          {/* Custom node content */}
          <div className="flex-1 min-w-0">
            {renderNode(node, {
              isExpanded: expanded,
              isActive,
              depth,
              hasChildren,
              toggle,
            })}
          </div>
        </div>
      </div>

      {/* Recursive children */}
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={getNodeId(child)}
              node={child}
              depth={depth + 1}
              renderNode={renderNode}
              getNodeId={getNodeId}
              getNodeChildren={getNodeChildren}
              activeNodeId={activeNodeId}
              defaultExpanded={defaultExpanded}
              indentSize={indentSize}
              baseIndent={baseIndent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView<T>({
  nodes,
  renderNode,
  getNodeId,
  getNodeChildren,
  activeNodeId,
  defaultExpanded = true,
  indentSize = 12,
  baseIndent = 8,
}: TreeViewProps<T>) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeNode
          key={getNodeId(node)}
          node={node}
          depth={0}
          renderNode={renderNode}
          getNodeId={getNodeId}
          getNodeChildren={getNodeChildren}
          activeNodeId={activeNodeId}
          defaultExpanded={defaultExpanded}
          indentSize={indentSize}
          baseIndent={baseIndent}
        />
      ))}
    </div>
  );
}
