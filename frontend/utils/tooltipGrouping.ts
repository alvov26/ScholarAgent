/**
 * Tooltip Grouping Strategy Pattern
 *
 * Allows different ways to organize tooltips in the panel:
 * - By section (default)
 * - Flat list (no grouping)
 * - By date (future)
 * - By tag (future)
 */

import type { Tooltip } from '@/hooks/useTooltips';
import type { TOCNode } from './parseTOC';

export interface TooltipGroup {
  id: string;
  title: string;
  tooltips: Tooltip[];
}

export interface GroupingStrategy {
  name: string;
  group(tooltips: Tooltip[], context?: unknown): TooltipGroup[];
}

/**
 * Group tooltips by the section they belong to
 */
export class SectionGroupingStrategy implements GroupingStrategy {
  name = 'section';

  group(tooltips: Tooltip[], toc?: TOCNode[]): TooltipGroup[] {
    if (!toc || toc.length === 0) {
      // No TOC available, return as single group
      return [{
        id: 'ungrouped',
        title: 'All Tooltips',
        tooltips: tooltips,
      }];
    }

    // Build a map of dom_node_id -> section
    const nodeToSection = this.buildNodeToSectionMap(toc);

    // Group tooltips by section
    const groups = new Map<string, TooltipGroup>();

    tooltips.forEach(tooltip => {
      const sectionInfo = nodeToSection.get(tooltip.dom_node_id);

      if (sectionInfo) {
        const existingGroup = groups.get(sectionInfo.id);
        if (existingGroup) {
          existingGroup.tooltips.push(tooltip);
        } else {
          groups.set(sectionInfo.id, {
            id: sectionInfo.id,
            title: sectionInfo.title,
            tooltips: [tooltip],
          });
        }
      } else {
        // Tooltip not in any section, add to "Other" group
        const otherGroup = groups.get('other');
        if (otherGroup) {
          otherGroup.tooltips.push(tooltip);
        } else {
          groups.set('other', {
            id: 'other',
            title: 'Other',
            tooltips: [tooltip],
          });
        }
      }
    });

    // Order groups by section appearance in TOC
    const orderedGroups = this.orderGroupsByTOC(Array.from(groups.values()), toc);
    return orderedGroups;
  }

  /**
   * Order groups by their appearance in the TOC
   * "Other" group goes last
   */
  private orderGroupsByTOC(groups: TooltipGroup[], toc: TOCNode[]): TooltipGroup[] {
    // Build a map of section ID -> order index
    const sectionOrder = new Map<string, number>();
    let index = 0;

    function traverse(node: TOCNode) {
      sectionOrder.set(node.id, index++);
      node.children.forEach(traverse);
    }

    toc.forEach(traverse);

    // Sort groups by section order
    return groups.sort((a, b) => {
      // "Other" always goes last
      if (a.id === 'other') return 1;
      if (b.id === 'other') return -1;

      const aOrder = sectionOrder.get(a.id) ?? 999999;
      const bOrder = sectionOrder.get(b.id) ?? 999999;

      return aOrder - bOrder;
    });
  }

  /**
   * Build a map from dom_node_id to section info
   * Each node maps to the nearest parent section by traversing the DOM
   */
  private buildNodeToSectionMap(toc: TOCNode[]): Map<string, { id: string; title: string }> {
    const map = new Map<string, { id: string; title: string }>();

    // First, collect all section IDs
    const sectionIds = new Set<string>();
    function collectSectionIds(node: TOCNode) {
      sectionIds.add(node.id);
      node.children.forEach(collectSectionIds);
    }
    toc.forEach(collectSectionIds);

    // Now, for each element in the document, find its nearest parent section
    if (typeof document !== 'undefined') {
      const allElements = document.querySelectorAll('[data-id]');

      allElements.forEach(element => {
        const dataId = element.getAttribute('data-id');
        if (!dataId) return;

        // Walk up the DOM to find the nearest heading (section)
        let currentElement: Element | null = element;
        let nearestSection: { id: string; title: string } | null = null;

        while (currentElement) {
          const currentDataId = currentElement.getAttribute('data-id');

          if (currentDataId && sectionIds.has(currentDataId)) {
            // Found a section heading
            const sectionNode = this.findNodeById(toc, currentDataId);
            if (sectionNode) {
              nearestSection = { id: sectionNode.id, title: sectionNode.title };
              break;
            }
          }

          // Move to previous sibling or parent
          currentElement = currentElement.previousElementSibling || currentElement.parentElement;
        }

        // Map this element's data-id to its section
        if (nearestSection) {
          map.set(dataId, nearestSection);
        }
      });
    }

    return map;
  }

  /**
   * Find a TOC node by its ID
   */
  private findNodeById(nodes: TOCNode[], id: string): TOCNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = this.findNodeById(node.children, id);
      if (found) return found;
    }
    return null;
  }
}

/**
 * No grouping - flat list of all tooltips
 */
export class FlatGroupingStrategy implements GroupingStrategy {
  name = 'flat';

  group(tooltips: Tooltip[]): TooltipGroup[] {
    return [{
      id: 'all',
      title: 'All Tooltips',
      tooltips: tooltips,
    }];
  }
}

/**
 * Group by creation date (day)
 */
export class DateGroupingStrategy implements GroupingStrategy {
  name = 'date';

  group(tooltips: Tooltip[]): TooltipGroup[] {
    const groups = new Map<string, TooltipGroup>();

    tooltips.forEach(tooltip => {
      const date = new Date(tooltip.created_at);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const dateTitle = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const existingGroup = groups.get(dateKey);
      if (existingGroup) {
        existingGroup.tooltips.push(tooltip);
      } else {
        groups.set(dateKey, {
          id: dateKey,
          title: dateTitle,
          tooltips: [tooltip],
        });
      }
    });

    // Sort groups by date (newest first)
    return Array.from(groups.values()).sort((a, b) => b.id.localeCompare(a.id));
  }
}

/**
 * Sort tooltips within a group by priority:
 * 1. Pinned first
 * 2. Then by display_order (if exists)
 * 3. Then by creation date (newest first)
 */
export function sortTooltipsByPriority(tooltips: Tooltip[]): Tooltip[] {
  return [...tooltips].sort((a, b) => {
    // Pinned first (when we add the field)
    // const aPinned = (a as any).is_pinned || false;
    // const bPinned = (b as any).is_pinned || false;
    // if (aPinned !== bPinned) return bPinned ? 1 : -1;

    // By display_order (when we add the field)
    // const aOrder = (a as any).display_order || 999999;
    // const bOrder = (b as any).display_order || 999999;
    // if (aOrder !== bOrder) return aOrder - bOrder;

    // By date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
