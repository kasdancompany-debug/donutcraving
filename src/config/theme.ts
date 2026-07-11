/**
 * Kasdan Co. visual palette & typography.
 * Premium boutique bakery × magical mirror × photo booth.
 */

export const COLORS = {
  cream: '#F5EDE0',
  creamLight: '#FAF6EF',
  creamMuted: '#E8DFD0',
  espresso: '#3E2418',
  espressoDeep: '#2A1810',
  caramel: '#C8874A',
  caramelLight: '#D4A574',
  pinkGlaze: '#E8A0A8',
  pinkGlazeSoft: '#F0C4CA',
  goldWarm: '#DDB878',
  /** High-contrast copy for bright environments / live video. */
  textPrimary: '#2A1810',
  textSecondary: '#3E2418',
  textMuted: '#5A3D2E',
} as const;

/** Elegant serif for cinematic headlines. */
export const FONT_SERIF =
  '"Cormorant Garamond", "Playfair Display", "Times New Roman", serif';

/** Clean sans for UI labels and hints. */
export const FONT_SANS = '"DM Sans", "Segoe UI", system-ui, sans-serif';

/** Canvas font string for the desire headline. */
export function serifFont(size: number, weight = 600, italic = true): string {
  const style = italic ? 'italic ' : '';
  return `${style}${weight} ${size}px ${FONT_SERIF}`;
}

export function sansFont(size: number, weight = 400): string {
  return `${weight} ${size}px ${FONT_SANS}`;
}

/** Convert hex to rgba string. */
export function rgba(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
