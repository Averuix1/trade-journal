export const THEME_KEY = 'tj-theme';
export const THEME_RESOLVED_KEY = 'tj-theme-resolved';

export type ThemePref = 'matrix' | 'dark' | 'light' | 'system';
export type ResolvedTheme = 'matrix' | 'dark' | 'light';

export function isThemePref(value: string | null | undefined): value is ThemePref {
  return value === 'matrix' || value === 'dark' || value === 'light' || value === 'system';
}

export function isResolvedTheme(value: string | null | undefined): value is ResolvedTheme {
  return value === 'matrix' || value === 'dark' || value === 'light';
}

export function themeColor(theme: ResolvedTheme): string {
  if (theme === 'light') return '#F7F7F5';
  if (theme === 'dark') return '#111114';
  return '#050806';
}

/** Cookie-only resolution for the first server render. The boot script corrects System from the device. */
export function serverTheme(
  prefCookie: string | undefined,
  resolvedCookie: string | undefined,
): { pref: ThemePref; resolved: ResolvedTheme } {
  const pref: ThemePref = isThemePref(prefCookie) ? prefCookie : 'matrix';
  if (isResolvedTheme(resolvedCookie)) return { pref, resolved: resolvedCookie };
  if (pref === 'system') return { pref, resolved: 'dark' };
  return { pref, resolved: pref };
}

/** Blocking boot script. Runs before paint so a stored theme does not flash the Matrix default. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k='${THEME_KEY}';var p=localStorage.getItem(k);if(p!=='matrix'&&p!=='dark'&&p!=='light'&&p!=='system'){var m=document.cookie.match(/(?:^|; )${THEME_KEY}=(matrix|dark|light|system)/);p=m?m[1]:'matrix';}var theme=p==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;var colors={matrix:'#050806',dark:'#111114',light:'#F7F7F5'};var r=document.documentElement;r.setAttribute('data-theme',theme);r.setAttribute('data-theme-pref',p);var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',colors[theme]||'#050806');document.cookie='${THEME_RESOLVED_KEY}='+theme+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch(e){}})();`;

export function resolvedTheme(pref: ThemePref): ResolvedTheme {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return pref;
}

export function applyTheme(pref: ThemePref) {
  const theme = resolvedTheme(pref);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-pref', pref);
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* private mode */
  }
  const cookie = (name: string, value: string) => {
    document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };
  cookie(THEME_KEY, pref);
  cookie(THEME_RESOLVED_KEY, theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColor(theme));
  window.dispatchEvent(new CustomEvent('tj-theme', { detail: pref }));
}
