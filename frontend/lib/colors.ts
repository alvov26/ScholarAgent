/**
 * Consistent color palette for Scholar Agent
 *
 * Use these constants throughout the project to ensure readable, consistent colors.
 *
 * Usage:
 * import { TEXT, BG, BORDER } from '@/lib/colors';
 * className={`${TEXT.primary} ${BG.white}`}
 */

export const TEXT = {
  // Primary text - always readable
  primary: 'text-slate-900',

  // Secondary text - slightly muted but still readable
  secondary: 'text-slate-600',

  // Tertiary/helper text - for labels, captions
  tertiary: 'text-slate-500',

  // Disabled or very subtle text
  muted: 'text-slate-400',

  // Placeholder text in inputs
  placeholder: 'placeholder:text-slate-400',

  // Brand/accent text
  accent: 'text-indigo-600',
  accentHover: 'hover:text-indigo-700',

  // Success
  success: 'text-green-600',

  // Error/danger
  error: 'text-red-600',

  // Warning
  warning: 'text-amber-600',
} as const;

export const BG = {
  // Base backgrounds
  white: 'bg-white',
  slate: 'bg-slate-50',
  slateHover: 'hover:bg-slate-100',

  // Accent backgrounds
  accent: 'bg-indigo-600',
  accentHover: 'hover:bg-indigo-700',
  accentLight: 'bg-indigo-50',
  accentLightHover: 'hover:bg-indigo-100',

  // Success
  success: 'bg-green-50',

  // Error/danger
  error: 'bg-red-50',
  errorButton: 'bg-red-600',
  errorButtonHover: 'hover:bg-red-700',

  // Warning
  warning: 'bg-amber-50',
} as const;

export const BORDER = {
  // Standard borders
  default: 'border-slate-200',
  hover: 'hover:border-slate-300',

  // Focus states
  focus: 'focus:border-indigo-500',
  focusRing: 'focus:ring-2 focus:ring-indigo-500/20',

  // Accent
  accent: 'border-indigo-300',

  // Selected states
  selected: 'border-indigo-500',

  // Error
  error: 'border-red-300',
} as const;

export const INPUT = {
  // Common input field classes
  base: `w-full text-sm px-3 py-2 rounded-md ${BG.white} ${TEXT.primary} ${BORDER.default} ${TEXT.placeholder} focus:outline-none ${BORDER.focusRing} ${BORDER.focus}`,

  // Textarea
  textarea: `w-full text-sm px-3 py-2 rounded-md ${BG.white} ${TEXT.primary} ${BORDER.default} ${TEXT.placeholder} focus:outline-none ${BORDER.focusRing} ${BORDER.focus}`,

  // Select/dropdown
  select: `w-full text-sm px-3 py-2 rounded-md ${BG.white} ${TEXT.primary} ${BORDER.default} focus:outline-none ${BORDER.focusRing} ${BORDER.focus}`,
} as const;

export const BUTTON = {
  // Primary button
  primary: `px-4 py-2 text-sm font-medium text-white ${BG.accent} ${BG.accentHover} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`,

  // Secondary button
  secondary: `px-4 py-2 text-sm font-medium ${TEXT.secondary} ${BG.white} ${BORDER.default} border ${BG.slateHover} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`,

  // Danger button
  danger: `px-4 py-2 text-sm font-medium text-white ${BG.errorButton} ${BG.errorButtonHover} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`,

  // Ghost/text button
  ghost: `px-3 py-1.5 text-sm font-medium ${TEXT.accent} ${BG.accentLightHover} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`,
} as const;

/**
 * Example usage in components:
 *
 * import { TEXT, BG, INPUT, BUTTON } from '@/lib/colors';
 *
 * // Input field
 * <input className={INPUT.base} />
 *
 * // Custom combination
 * <div className={`${TEXT.primary} ${BG.white} ${BORDER.default}`}>
 *   Content
 * </div>
 *
 * // Button
 * <button className={BUTTON.primary}>
 *   Submit
 * </button>
 */
