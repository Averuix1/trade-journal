export const THEME_KEY = 'tj-theme';
export const THEME_RESOLVED_KEY = 'tj-theme-resolved';

export type ThemePref = 'dark' | 'light' | 'system';

export function isThemePref(value: string | null | undefined): value is ThemePref {
  return value === 'dark' || value === 'light' || value === 'system';
}

/** Blocking boot script. Runs before paint so a stored light theme does not flash dark. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k='${THEME_KEY}';var p=localStorage.getItem(k);if(p!=='light'&&p!=='dark'&&p!=='system'){var m=document.cookie.match(/(?:^|; )${THEME_KEY}=(dark|light|system)/);p=m?m[1]:'dark';}var light=p==='light'||(p==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);var r=document.documentElement;if(light)r.setAttribute('data-theme','light');else r.removeAttribute('data-theme');r.setAttribute('data-theme-pref',p);var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',light?'#F7F7F5':'#111114');document.cookie='${THEME_RESOLVED_KEY}='+(light?'light':'dark')+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch(e){}})();`;

export function resolvedTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return pref;
}

export function applyTheme(pref: ThemePref) {
  const theme = resolvedTheme(pref);
  const root = document.documentElement;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
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
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F7F7F5' : '#111114');
  window.dispatchEvent(new CustomEvent('tj-theme', { detail: pref }));
}
