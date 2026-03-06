# Design System Documentation

This document describes the centralized design system for the Scholar Agent frontend. The design system ensures visual consistency and makes it easy to expand the UI while maintaining a cohesive look and feel.

## Overview

The design system consists of:
1. **Design Tokens** (`lib/design-system.ts`) - Centralized colors, typography, spacing, and styles
2. **Reusable Components** (`components/ui/`) - Pre-built UI components with consistent styling

## 1. Design Tokens

All design tokens are exported from `@/lib/design-system`. Import what you need:

```typescript
import { colors, textStyles, componentStyles } from '@/lib/design-system';
```

### Color Palette

#### Primary Colors (Indigo)
Used for primary actions, selections, and brand elements.

```typescript
import { colors } from '@/lib/design-system';

// Background classes
colors.primary[50]    // bg-indigo-50 (lightest)
colors.primary[600]   // bg-indigo-600 (main)
colors.primary[700]   // bg-indigo-700 (darker)

// Text classes
colors.primary.text[600]  // text-indigo-600
colors.primary.text[700]  // text-indigo-700

// Border classes
colors.primary.border[300]  // border-indigo-300

// Hover states
colors.primary.hover.bg    // hover:bg-indigo-700
colors.primary.hover.text  // hover:text-indigo-600
```

#### Neutral Colors (Slate)
Used for text, borders, and backgrounds.

```typescript
colors.neutral[50]          // bg-slate-50 (lightest background)
colors.neutral[200]         // bg-slate-200 (borders)
colors.neutral[700]         // bg-slate-700 (dark text)
colors.neutral.text[500]    // text-slate-500
colors.neutral.border[200]  // border-slate-200
colors.neutral.hover.bg[50] // hover:bg-slate-50
```

#### Entity Type Colors
Used for knowledge graph nodes and entity-specific styling.

```typescript
colors.entity.symbol.bg        // bg-blue-50
colors.entity.symbol.text      // text-blue-700
colors.entity.symbol.hex       // '#3b82f6' (for canvas/ReactFlow)

colors.entity.definition.bg    // bg-emerald-50
colors.entity.definition.hex   // '#10b981'

colors.entity.theorem.bg       // bg-violet-50
colors.entity.theorem.hex      // '#8b5cf6'
```

#### Relationship Colors
Used for edge colors in knowledge graphs.

```typescript
colors.relationship.uses.hex        // '#6366f1' (indigo)
colors.relationship.depends_on.hex  // '#f59e0b' (amber)
colors.relationship.defines.hex     // '#10b981' (emerald)
colors.relationship.extends.hex     // '#8b5cf6' (violet)
colors.relationship.mentions.hex    // '#94a3b8' (slate)
```

#### Destructive/Error Colors (Red)
Used for delete actions and errors.

```typescript
colors.destructive.hover.text  // hover:text-red-600
colors.destructive.hover.bg    // hover:bg-red-50
```

### Typography

Pre-defined text styles for consistent typography:

```typescript
import { textStyles } from '@/lib/design-system';

textStyles.h1              // text-xl font-bold text-slate-900
textStyles.h2              // text-lg font-semibold text-slate-900
textStyles.body            // text-sm text-slate-700
textStyles.label           // text-xs font-medium text-slate-600
textStyles.sectionHeader   // text-xs font-semibold text-slate-500 uppercase tracking-wider
```

### Component Styles

Pre-composed styles for common UI patterns:

#### Buttons

```typescript
import { componentStyles } from '@/lib/design-system';

// Primary button (indigo background)
<button className={componentStyles.button.primary}>
  Save
</button>

// Secondary button (white with border)
<button className={componentStyles.button.secondary}>
  Cancel
</button>

// Icon button
<button className={componentStyles.button.icon}>
  <Edit2 size={14} />
</button>
```

#### Cards

```typescript
// Standard card
<div className={componentStyles.card.default}>
  Content
</div>

// Selected/highlighted card
<div className={componentStyles.card.selected}>
  Selected content
</div>
```

#### Input Fields

```typescript
// Text input
<input className={componentStyles.input.default} />

// Textarea
<textarea className={componentStyles.input.textarea} />
```

#### Dialogs/Modals

```typescript
<div className={componentStyles.dialog.overlay}>
  <div className={componentStyles.dialog.container}>
    <div className={componentStyles.dialog.header}>
      <h2>Dialog Title</h2>
    </div>
    <div className={componentStyles.dialog.body}>
      Content
    </div>
    <div className={componentStyles.dialog.footer}>
      Actions
    </div>
  </div>
</div>
```

## 2. Reusable Components

All UI components are exported from `@/components/ui`:

```typescript
import { Button, Card, EmptyState, CollapsibleSection } from '@/components/ui';
```

### Button Component

Consistent button styling with variants and loading states.

```typescript
import { Button, IconButton } from '@/components/ui';
import { Save, Edit2 } from 'lucide-react';

// Primary button
<Button variant="primary" onClick={handleSave}>
  Save Changes
</Button>

// Secondary button
<Button variant="secondary">
  Cancel
</Button>

// Small button with icon
<Button variant="primary" size="sm" icon={Save}>
  Save
</Button>

// Loading state
<Button variant="primary" loading={isSaving}>
  Save
</Button>

// Icon-only button
<IconButton icon={Edit2} label="Edit" variant="default" />
<IconButton icon={Trash2} label="Delete" variant="destructive" />
```

**Props:**
- `variant`: `'primary' | 'secondary' | 'ghost' | 'icon'`
- `size`: `'sm' | 'md'`
- `icon`: Optional Lucide icon component
- `loading`: Shows spinner when true
- `disabled`: Disables the button

### Card Components

Flexible card layouts with consistent styling.

```typescript
import { Card, CardHeader, CardContent, CardActions } from '@/components/ui';
import { Edit2, Trash2 } from 'lucide-react';

<Card selected={isSelected}>
  <CardHeader
    actions={
      <>
        <IconButton icon={Edit2} label="Edit" />
        <IconButton icon={Trash2} label="Delete" variant="destructive" />
      </>
    }
  >
    <h3 className="font-medium">Card Title</h3>
  </CardHeader>

  <CardContent expanded={isExpanded}>
    <p>Detailed content goes here...</p>
  </CardContent>

  <CardActions>
    <Button size="sm">Action</Button>
  </CardActions>
</Card>
```

**Props:**
- `Card`: `selected` (boolean), `onClick` (function)
- `CardHeader`: `children`, `actions` (React nodes)
- `CardContent`: `expanded` (boolean)
- `CardActions`: `children` (React nodes)

### EmptyState Component

Consistent empty states for sidebars and content areas.

```typescript
import { EmptyState } from '@/components/ui';
import { FileText } from 'lucide-react';

// Sidebar variant (centered, no background)
<EmptyState
  icon={FileText}
  title="No items found"
  description="Try adding some items to get started"
  variant="sidebar"
/>

// Card variant (with background and border)
<EmptyState
  icon={FileText}
  title="No comments yet"
  description="Click on a paragraph to add a comment"
  variant="card"
  action={<Button size="sm">Add Comment</Button>}
/>
```

**Props:**
- `icon`: Lucide icon component (required)
- `title`: Main heading text (required)
- `description`: Optional subtitle
- `variant`: `'sidebar' | 'card'` (default: `'card'`)
- `action`: Optional action button or element

### CollapsibleSection Component

Reusable collapsible sections with consistent chevron behavior.

```typescript
import { CollapsibleSection } from '@/components/ui';
import { Sparkles } from 'lucide-react';

<CollapsibleSection
  title="AI Suggestions"
  defaultExpanded={true}
  badge={15}
  icon={Sparkles}
>
  <div className="space-y-2">
    {suggestions.map(s => <div key={s.id}>{s.content}</div>)}
  </div>
</CollapsibleSection>
```

**Props:**
- `title`: Section title (string or React node)
- `children`: Content to show when expanded
- `defaultExpanded`: Initial state (default: `true`)
- `badge`: Optional badge count
- `icon`: Optional Lucide icon
- `indentLevel`: Nesting level for hierarchical sections

### TreeView Component

Reusable hierarchical tree component for displaying nested structures like table of contents, grouped tooltips, or file trees.

```typescript
import { TreeView } from '@/components/ui';
import type { TOCNode } from '@/utils/parseTOC';

// Example: Table of Contents
<TreeView
  nodes={tocNodes}
  renderNode={(node, { isExpanded, depth, isActive, toggle }) => (
    <button
      onClick={() => onNavigate(node.id)}
      className={`text-sm ${isActive ? 'text-indigo-700 font-medium' : 'text-slate-700'}`}
    >
      <span dangerouslySetInnerHTML={{ __html: node.title }} />
    </button>
  )}
  getNodeId={(node) => node.id}
  getNodeChildren={(node) => node.children}
  activeNodeId={currentSectionId}
  defaultExpanded={true}
/>

// Example: Hierarchical groups with badges
<TreeView
  nodes={groups}
  renderNode={(group, { isExpanded, depth }) => (
    <div className="flex items-center justify-between">
      <span dangerouslySetInnerHTML={{ __html: group.title }} />
      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
        {group.tooltips.length}
      </span>
    </div>
  )}
  getNodeId={(group) => group.id}
  getNodeChildren={(group) => group.children || []}
/>
```

**Props:**
- `nodes`: Array of root nodes to display
- `renderNode`: Function that renders each node's content (receives node and render props)
- `getNodeId`: Function to extract unique ID from node
- `getNodeChildren`: Function to get children array from node
- `activeNodeId`: Optional ID of currently active/selected node
- `defaultExpanded`: Whether nodes start expanded (default: `true`)
- `indentSize`: Pixels per indent level (default: `12`)
- `baseIndent`: Base padding in pixels (default: `8`)

**Render Props:**
- `isExpanded`: Whether this node is currently expanded
- `isActive`: Whether this node matches `activeNodeId`
- `depth`: Current nesting depth (0-indexed)
- `hasChildren`: Whether this node has children
- `toggle`: Function to toggle expansion state

## 3. Usage Examples

### Before (Inconsistent)

```typescript
// Different button styles across components
<button className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>
<button className="px-3 py-1.5 bg-blue-600 text-white rounded">Save</button>
<button className="bg-indigo-700 text-white px-4 py-2 rounded-md">Save</button>
```

### After (Consistent)

```typescript
import { Button } from '@/components/ui';

<Button variant="primary">Save</Button>
```

### Before (Repetitive Empty States)

```typescript
// Repeated in every component
<div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 p-6">
  <FileText size={32} className="text-slate-300" />
  <p className="text-sm font-medium">No items</p>
</div>
```

### After (Reusable)

```typescript
import { EmptyState } from '@/components/ui';
import { FileText } from 'lucide-react';

<EmptyState
  icon={FileText}
  title="No items"
  variant="sidebar"
/>
```

## 4. Migration Guide

When refactoring existing components to use the design system:

1. **Replace inline color classes:**
   ```typescript
   // Before
   className="bg-indigo-600 text-white hover:bg-indigo-700"

   // After
   import { colors } from '@/lib/design-system';
   className={`${colors.primary[600]} text-white ${colors.primary.hover.bg}`}

   // Or use component styles
   import { componentStyles } from '@/lib/design-system';
   className={componentStyles.button.primary}
   ```

2. **Replace buttons with Button component:**
   ```typescript
   // Before
   <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
     Save
   </button>

   // After
   import { Button } from '@/components/ui';
   <Button variant="primary">Save</Button>
   ```

3. **Replace empty states with EmptyState:**
   ```typescript
   // Before
   if (items.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 p-6">
         <FileText size={32} className="text-slate-300" />
         <p className="text-sm font-medium">No items</p>
       </div>
     );
   }

   // After
   import { EmptyState } from '@/components/ui';
   if (items.length === 0) {
     return <EmptyState icon={FileText} title="No items" variant="sidebar" />;
   }
   ```

## 5. Best Practices

1. **Always use design tokens** instead of hardcoded Tailwind classes for colors
2. **Prefer reusable components** over inline styling when possible
3. **Use semantic color names** (e.g., `colors.primary` instead of `indigo-600`)
4. **Keep variants minimal** - if you need many custom styles, create a new component
5. **Document new patterns** - if you create a common pattern, add it to the design system

## 6. Extending the Design System

To add new design tokens:

1. Edit `lib/design-system.ts`
2. Add to the appropriate section (colors, textStyles, etc.)
3. Follow existing naming conventions
4. Update this documentation

To add new reusable components:

1. Create component in `components/ui/`
2. Export from `components/ui/index.ts`
3. Document usage in this file
4. Use design tokens from `lib/design-system.ts`

## 7. Quick Reference

### Most Common Patterns

```typescript
// Primary action button
<Button variant="primary">Action</Button>

// Icon button for edit/delete
<IconButton icon={Edit2} label="Edit" />
<IconButton icon={Trash2} label="Delete" variant="destructive" />

// Empty state in sidebar
<EmptyState icon={FileText} title="No items" variant="sidebar" />

// Card with actions
<Card selected={selected}>
  <CardHeader actions={<IconButton icon={Edit2} label="Edit" />}>
    Title
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Collapsible section
<CollapsibleSection title="Section" badge={5}>
  Content
</CollapsibleSection>

// Input field
<input className={componentStyles.input.default} />

// Section header
<h3 className={textStyles.sectionHeader}>Section Title</h3>
```

## 8. Color Reference Chart

| Usage | Token | Class | Color |
|-------|-------|-------|-------|
| Primary action | `colors.primary[600]` | `bg-indigo-600` | ![#4f46e5](https://via.placeholder.com/15/4f46e5/000000?text=+) |
| Primary hover | `colors.primary[700]` | `bg-indigo-700` | ![#4338ca](https://via.placeholder.com/15/4338ca/000000?text=+) |
| Symbol entity | `colors.entity.symbol.hex` | - | ![#3b82f6](https://via.placeholder.com/15/3b82f6/000000?text=+) |
| Definition entity | `colors.entity.definition.hex` | - | ![#10b981](https://via.placeholder.com/15/10b981/000000?text=+) |
| Theorem entity | `colors.entity.theorem.hex` | - | ![#8b5cf6](https://via.placeholder.com/15/8b5cf6/000000?text=+) |
| Neutral text | `colors.neutral.text[700]` | `text-slate-700` | ![#334155](https://via.placeholder.com/15/334155/000000?text=+) |
| Border | `colors.neutral.border[200]` | `border-slate-200` | ![#e2e8f0](https://via.placeholder.com/15/e2e8f0/000000?text=+) |
| Destructive | `colors.destructive.text[600]` | `text-red-600` | ![#dc2626](https://via.placeholder.com/15/dc2626/000000?text=+) |
