# Scholar Agent Color Palette

**Problem:** We've repeatedly encountered issues with unreadable text (light gray on light gray backgrounds).

**Solution:** Use this consistent color palette throughout the project.

## Quick Reference

### Text Colors

| Use Case | Class | Example |
|----------|-------|---------|
| Main content | `text-slate-900` | Body text, headings, labels |
| Secondary content | `text-slate-600` | Subheadings, descriptions |
| Tertiary/helper | `text-slate-500` | Small labels, section headers |
| Muted/disabled | `text-slate-400` | Disabled text, subtle UI elements |
| Placeholders | `placeholder:text-slate-400` | Input placeholders |
| Accent/brand | `text-indigo-600` | Links, active states |

### Background Colors

| Use Case | Class | Example |
|----------|-------|---------|
| Primary | `bg-white` | Cards, modals, inputs |
| Secondary | `bg-slate-50` | Page background, sections |
| Accent | `bg-indigo-600` | Primary buttons |
| Accent light | `bg-indigo-50` | Hover states, selected items |

### Common Patterns

#### Input Fields
```tsx
className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
```

Or use the constant:
```tsx
import { INPUT } from '@/lib/colors';
<input className={INPUT.base} />
```

#### Buttons
```tsx
// Primary
className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"

// Secondary
className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
```

Or use constants:
```tsx
import { BUTTON } from '@/lib/colors';
<button className={BUTTON.primary}>Submit</button>
<button className={BUTTON.secondary}>Cancel</button>
```

#### Select/Dropdown
```tsx
className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"

// Options
<option className="text-slate-900">Label</option>
```

## Key Principles

1. **Always use `text-slate-900` for user input** - Never let typed text be light gray
2. **Use `bg-white` for form elements** - Don't use gray backgrounds for inputs/selects
3. **Placeholders are `text-slate-400`** - Lighter than input text but still visible
4. **Dropdown options are `text-slate-900`** - Dark text on white/light backgrounds
5. **Icons inherit text color** - Add `className="text-slate-400"` to make them visible

## Migration Guide

When you see hard-to-read text:

**Before:**
```tsx
<input className="..." /> // Light gray text on gray background
```

**After:**
```tsx
<input className="... bg-white text-slate-900 placeholder:text-slate-400" />
```

**Before:**
```tsx
<select className="...">
  <option>Item</option>
</select>
```

**After:**
```tsx
<select className="... bg-white text-slate-900">
  <option className="text-slate-900">Item</option>
</select>
```

## Using the Constants

```tsx
import { TEXT, BG, BORDER, INPUT, BUTTON } from '@/lib/colors';

// Simple input
<input className={INPUT.base} placeholder="Type here..." />

// Custom styling
<div className={`${TEXT.primary} ${BG.white} p-4 border ${BORDER.default} rounded-lg`}>
  Content
</div>

// Buttons
<button className={BUTTON.primary}>Save</button>
<button className={BUTTON.secondary}>Cancel</button>
```
