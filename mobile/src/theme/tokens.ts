/**
 * Primitive color tokens — raw Tailwind-aligned values used to build semantic themes.
 * Do not consume these directly in components; use the Theme object from ThemeContext instead.
 */
export const palette = {
  // Slate
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',

  // Gray
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Red / Error
  red50: '#FEF2F2',
  red100: '#FEE2E2',
  red200: '#FECACA',
  red300: '#FCA5A5',
  red400: '#F87171',
  red500: '#EF4444',
  red600: '#DC2626',
  red700: '#B91C1C',
  red800: '#991B1B',
  red900: '#7F1D1D',
  red950: '#450A0A',

  // Green / Success
  green50: '#F0FDF4',
  green100: '#DCFCE7',
  green200: '#BBF7D0',
  green300: '#86EFAC',
  emerald50: '#ECFDF5',
  emerald100: '#A7F3D0',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald800: '#065F46',
  emerald900: '#052E16',
  green700: '#15803D',
  green800: '#166534',
  green900: '#14532D',

  // Amber / Warning
  amber50: '#FFFBEB',
  amber100: '#FEF3C7',
  amber200: '#FDE68A',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber700: '#B45309',
  amber800: '#92400E',
  amber950: '#451A03',

  // Blue / Info
  blue50: '#EFF6FF',
  blue100: '#DBEAFE',
  blue200: '#BFDBFE',
  blue300: '#93C5FD',
  blue400: '#60A5FA',
  blue600: '#2563EB',
  blue700: '#1D4ED8',
  blue800: '#1E40AF',
  blue900: '#1E3A8A',

  sky50: '#F0F9FF',
  sky100: '#E0F2FE',
  sky200: '#BAE6FD',
  sky300: '#7DD3FC',
  sky400: '#38BDF8',
  sky600: '#0284C7',
  sky700: '#0369A1',
  sky800: '#0C4A6E',
  sky900: '#0C1A2E',
  deepSky: '#1E3A5F',

  // Indigo / Accent
  indigo50: '#EEF2FF',
  indigo100: '#E0E7FF',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',
  indigo950: '#1E1B4B',

  // Violet / Private badge
  violet100: '#EDE9FE',
  violet300: '#C4B5FD',
  violet700: '#6D28D9',
  violet800: '#5B21B6',
  violet900: '#2E1065',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;
