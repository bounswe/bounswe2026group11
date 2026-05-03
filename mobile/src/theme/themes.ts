import { palette as p } from './tokens';

export interface Theme {
  // ── Surfaces ──────────────────────────────────────────────
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceAlt: string;

  // ── Borders & dividers ────────────────────────────────────
  border: string;
  borderStrong: string;
  divider: string;

  // ── Text ──────────────────────────────────────────────────
  text: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textOnPrimary: string;
  placeholder: string;

  // ── Primary action (buttons, active states) ───────────────
  primary: string;
  primaryAlt: string;

  // ── Error ─────────────────────────────────────────────────
  errorBg: string;
  errorBorder: string;
  errorText: string;
  errorTextStrong: string;

  // ── Success ───────────────────────────────────────────────
  successBg: string;
  successBorder: string;
  successText: string;

  // ── Warning ───────────────────────────────────────────────
  warningBg: string;
  warningBorder: string;
  warningText: string;

  // ── Info / unread ─────────────────────────────────────────
  infoBg: string;
  infoBorder: string;
  infoText: string;
  unreadBg: string;
  unreadBorder: string;
  unreadDot: string;

  // ── Privacy / visibility badges ───────────────────────────
  badgePublicBg: string;
  badgePublicText: string;
  badgeProtectedBg: string;
  badgeProtectedText: string;
  badgePrivateBg: string;
  badgePrivateText: string;

  // ── Context badges (host / ticket / invited) ──────────────
  badgeHostBg: string;
  badgeHostText: string;
  badgeTicketBg: string;
  badgeTicketText: string;
  badgeInvitedBg: string;
  badgeInvitedText: string;

  // ── Bottom tab bar ────────────────────────────────────────
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;

  // ── Floating action button ────────────────────────────────
  fabBg: string;
  fabIcon: string;

  // ── Miscellaneous UI ──────────────────────────────────────
  imagePlaceholder: string;
  overlay: string;
  overlayLight: string;
  notificationBadge: string;

  // ── Switch control ────────────────────────────────────────
  switchTrackFalse: string;
  switchTrackTrue: string;
  switchThumbTrue: string;
  switchThumbFalse: string;
  switchIosBg: string;
}

export const lightTheme: Theme = {
  background: p.slate50,
  surface: p.white,
  surfaceVariant: p.gray50,
  surfaceAlt: p.slate100,

  border: p.gray200,
  borderStrong: p.gray300,
  divider: p.gray200,

  text: p.gray900,
  textSecondary: p.gray500,
  textTertiary: p.gray400,
  textMuted: p.slate500,
  textOnPrimary: p.white,
  placeholder: p.gray400,

  primary: p.gray900,
  primaryAlt: p.slate900,

  errorBg: p.red50,
  errorBorder: p.red200,
  errorText: p.red600,
  errorTextStrong: p.red500,

  successBg: p.green50,
  successBorder: p.green200,
  successText: p.emerald700,

  warningBg: p.amber50,
  warningBorder: p.amber200,
  warningText: p.amber800,

  infoBg: p.sky50,
  infoBorder: p.sky200,
  infoText: p.sky700,
  unreadBg: p.sky50,
  unreadBorder: p.sky200,
  unreadDot: p.sky600,

  badgePublicBg: p.blue100,
  badgePublicText: p.blue800,
  badgeProtectedBg: p.amber100,
  badgeProtectedText: p.amber800,
  badgePrivateBg: p.violet100,
  badgePrivateText: p.violet800,

  badgeHostBg: p.indigo100,
  badgeHostText: p.indigo700,
  badgeTicketBg: p.green100,
  badgeTicketText: p.green800,
  badgeInvitedBg: p.amber100,
  badgeInvitedText: p.amber700,

  tabBarBg: p.white,
  tabBarBorder: p.gray200,
  tabBarActive: p.gray900,
  tabBarInactive: p.gray400,

  fabBg: p.slate900,
  fabIcon: p.white,

  imagePlaceholder: p.gray200,
  overlay: 'rgba(15, 23, 42, 0.5)',
  overlayLight: 'rgba(15, 23, 42, 0.22)',
  notificationBadge: p.red500,

  switchTrackFalse: p.slate300,
  switchTrackTrue: p.sky200,
  switchThumbTrue: p.sky600,
  switchThumbFalse: p.slate50,
  switchIosBg: p.slate300,
};

export const darkTheme: Theme = {
  background: p.slate900,
  surface: p.slate800,
  surfaceVariant: p.slate800,
  surfaceAlt: '#273548',

  border: p.slate700,
  borderStrong: p.slate600,
  divider: p.slate700,

  text: p.slate50,
  textSecondary: p.slate400,
  textTertiary: p.slate500,
  textMuted: p.slate400,
  textOnPrimary: p.slate900,
  placeholder: p.slate500,

  primary: p.slate200,
  primaryAlt: p.slate300,

  errorBg: p.red950,
  errorBorder: p.red900,
  errorText: p.red300,
  errorTextStrong: p.red400,

  successBg: p.emerald900,
  successBorder: p.green900,
  successText: p.green300,

  warningBg: p.amber950,
  warningBorder: '#78350F',
  warningText: p.amber400,

  infoBg: p.sky900,
  infoBorder: p.deepSky,
  infoText: p.sky300,
  unreadBg: p.sky900,
  unreadBorder: p.deepSky,
  unreadDot: p.sky400,

  badgePublicBg: p.deepSky,
  badgePublicText: p.blue300,
  badgeProtectedBg: p.amber950,
  badgeProtectedText: p.amber400,
  badgePrivateBg: p.violet900,
  badgePrivateText: p.violet300,

  badgeHostBg: p.indigo950,
  badgeHostText: p.indigo400,
  badgeTicketBg: p.emerald900,
  badgeTicketText: p.green300,
  badgeInvitedBg: p.amber950,
  badgeInvitedText: p.amber400,

  tabBarBg: p.slate900,
  tabBarBorder: p.slate800,
  tabBarActive: p.slate50,
  tabBarInactive: p.slate500,

  fabBg: p.slate200,
  fabIcon: p.slate900,

  imagePlaceholder: p.slate700,
  overlay: 'rgba(0, 0, 0, 0.72)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  notificationBadge: p.red500,

  switchTrackFalse: p.slate700,
  switchTrackTrue: p.sky800,
  switchThumbTrue: p.sky400,
  switchThumbFalse: p.slate400,
  switchIosBg: p.slate700,
};
