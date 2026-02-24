"use client";

import React, { useState, useRef, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, X, Pencil, Trash2 } from 'lucide-react';

interface InteractiveNodeProps {
  tag: string;
  dataId: string;
  attributes: Record<string, string>;
  tooltip?: { id: string; content: string };
  onTooltipCreate: (content: string) => void;
  onTooltipDelete?: () => void;
  children: ReactNode;
}

/**
 * InteractiveNode - Wrapper component for content nodes that can have tooltips.
 *
 * Renders the original HTML tag with interactive tooltip functionality:
 * - Click to view/create tooltips
 * - Hover highlighting for annotated nodes
 */
export function InteractiveNode({
  tag,
  dataId,
  attributes,
  tooltip,
  onTooltipCreate,
  onTooltipDelete,
  children
}: InteractiveNodeProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const nodeRef = useRef<HTMLElement | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger if clicking inside the popover
    if ((e.target as HTMLElement).closest('.tooltip-popover')) {
      return;
    }
    e.stopPropagation();
    setIsPopoverOpen(true);
    setIsEditing(!tooltip); // Start in edit mode if no tooltip exists
    setEditContent(tooltip?.content || '');
  }, [tooltip]);

  const handleClose = useCallback(() => {
    setIsPopoverOpen(false);
    setIsEditing(false);
    setEditContent('');
  }, []);

  const handleSave = useCallback(() => {
    if (editContent.trim()) {
      onTooltipCreate(editContent.trim());
      setIsEditing(false);
      setEditContent('');
      setIsPopoverOpen(false);
    }
  }, [editContent, onTooltipCreate]);

  const handleDelete = useCallback(() => {
    if (onTooltipDelete) {
      onTooltipDelete();
      setIsPopoverOpen(false);
    }
  }, [onTooltipDelete]);

  // Build className
  const hasTooltip = !!tooltip;
  const className = [
    attributes.class || '',
    'interactive-node',
    hasTooltip ? 'has-tooltip' : '',
    isPopoverOpen ? 'is-active' : ''
  ].filter(Boolean).join(' ');

  // Filter out attributes we handle specially and convert style string to object
  const { class: _, 'data-id': __, style, ...restAttribs } = attributes;

  // Parse style string to object if present
  const styleObj = style && typeof style === 'string'
    ? style.split(';').reduce((acc, rule) => {
        const [key, value] = rule.split(':').map(s => s.trim());
        if (key && value) {
          // Convert kebab-case to camelCase
          const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          acc[camelKey] = value;
        }
        return acc;
      }, {} as Record<string, string>)
    : style;

  // Create element props
  const elementProps = {
    ref: nodeRef,
    ...restAttribs,
    'data-id': dataId,
    className,
    onClick: handleClick,
    ...(styleObj && { style: styleObj }),
  };

  return (
    <>
      {React.createElement(tag, elementProps, children)}

      <AnimatePresence>
        {isPopoverOpen && (
          <TooltipPopover
            nodeRef={nodeRef}
            tooltip={tooltip}
            isEditing={isEditing}
            editContent={editContent}
            setEditContent={setEditContent}
            setIsEditing={setIsEditing}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>

      <style jsx global>{`
        .interactive-node {
          position: relative;
          cursor: pointer;
          transition: background-color 0.2s ease;
          border-radius: 2px;
        }

        .interactive-node:hover {
          background-color: rgba(99, 102, 241, 0.05);
        }

        .interactive-node.has-tooltip {
          background-color: rgba(99, 102, 241, 0.08);
          border-left: 3px solid #6366f1;
          padding-left: 0.75em;
        }

        .interactive-node.has-tooltip:hover {
          background-color: rgba(99, 102, 241, 0.15);
        }

        .interactive-node.is-active {
          background-color: rgba(99, 102, 241, 0.15);
          outline: 2px solid rgba(99, 102, 241, 0.3);
        }
      `}</style>
    </>
  );
}

interface TooltipPopoverProps {
  nodeRef: React.RefObject<HTMLElement | null>;
  tooltip?: { id: string; content: string };
  isEditing: boolean;
  editContent: string;
  setEditContent: (content: string) => void;
  setIsEditing: (editing: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function TooltipPopover({
  nodeRef,
  tooltip,
  isEditing,
  editContent,
  setEditContent,
  setIsEditing,
  onSave,
  onDelete,
  onClose
}: TooltipPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Calculate position relative to the node
  const rect = nodeRef.current?.getBoundingClientRect();
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    top: rect ? rect.bottom + 8 : 0,
    left: rect ? rect.left + rect.width / 2 : 0,
    transform: 'translateX(-50%)',
    maxWidth: '400px',
    width: '100%'
  };

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !nodeRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, nodeRef]);

  return (
    <motion.div
      ref={popoverRef}
      className="tooltip-popover bg-white border border-slate-200 shadow-xl rounded-xl p-4"
      style={style}
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
          {tooltip ? 'Annotation' : 'Add Annotation'}
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            autoFocus
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Add your notes or explanation..."
            className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 text-slate-900 resize-none"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                if (tooltip) {
                  setIsEditing(false);
                  setEditContent(tooltip.content);
                } else {
                  onClose();
                }
              }}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!editContent.trim()}
              className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      ) : tooltip ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">
            {tooltip.content}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setIsEditing(true);
                setEditContent(tooltip.content);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500 mb-3">
            No annotation for this section yet.
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <MessageSquarePlus size={16} />
            Add Annotation
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default InteractiveNode;
