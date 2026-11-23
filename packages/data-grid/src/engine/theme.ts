/**
 * Temas: Bootstrap 4, Bootstrap 5, Tailwind, Material e o padrão.
 *
 * Cada tema define os valores de base (`--_t-*`) dentro do Shadow DOM. As variáveis
 * públicas `--bm-*` sempre vencem: quem quiser customizar só define `--bm-color-primary`
 * (etc.) no CSS da página, com qualquer tema.
 *
 * Bootstrap 5, Tailwind 4 e Angular Material 3 expõem variáveis CSS próprias; os temas
 * leem essas variáveis, então a grid segue as cores que o projeto já customizou.
 * Sem elas (Bootstrap 4, Tailwind 3, Material 2), valem as cores padrão de cada framework.
 *
 * Arquivo sem Lit e sem DOM: o CSS é gerado como texto.
 */

export type ThemeName = 'default' | 'bootstrap4' | 'bootstrap5' | 'tailwind' | 'material';
export type Appearance = 'light' | 'dark' | 'auto';
export type Density = 'compact' | 'standard' | 'comfortable';

export const THEMES: ThemeName[] = ['default', 'bootstrap4', 'bootstrap5', 'tailwind', 'material'];

/** Token interno -> variável pública que o sobrescreve. */
export const THEME_TOKENS = {
  font: '--bm-font-family',
  'font-size': '--bm-font-size',
  text: '--bm-color-text',
  muted: '--bm-color-text-muted',
  bg: '--bm-color-bg',
  'bg-alt': '--bm-color-bg-alt',
  'bg-header': '--bm-color-bg-header',
  'header-text': '--bm-color-header-text',
  'header-weight': '--bm-header-font-weight',
  'bg-hover': '--bm-color-bg-hover',
  'bg-selected': '--bm-color-bg-selected',
  border: '--bm-color-border',
  primary: '--bm-color-primary',
  'primary-text': '--bm-color-primary-text',
  focus: '--bm-color-focus',
  radius: '--bm-radius',
  shadow: '--bm-shadow',
  'cell-py': '--bm-cell-padding-y',
  'cell-px': '--bm-cell-padding-x',
} as const;

export type ThemeToken = keyof typeof THEME_TOKENS;
type Palette = Record<ThemeToken, string>;
type ThemeDef = { light: Palette; dark: Palette };

const SYSTEM_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const defaultLight: Palette = {
  font: SYSTEM_FONT,
  'font-size': '14px',
  text: '#1f2328',
  muted: '#636c76',
  bg: '#ffffff',
  'bg-alt': '#f7f8fa',
  'bg-header': '#f1f3f6',
  'header-text': '#1f2328',
  'header-weight': '600',
  'bg-hover': '#eef3fd',
  'bg-selected': '#dbe7fc',
  border: '#d8dee4',
  primary: '#1f6feb',
  'primary-text': '#ffffff',
  focus: '#1f6feb66',
  radius: '6px',
  shadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
  'cell-py': '8px',
  'cell-px': '12px',
};

const THEME_DEFS: Record<ThemeName, ThemeDef> = {
  default: {
    light: defaultLight,
    dark: {
      ...defaultLight,
      text: '#e6edf3',
      muted: '#8d96a0',
      bg: '#161b22',
      'bg-alt': '#1c222b',
      'bg-header': '#21262d',
      'header-text': '#e6edf3',
      'bg-hover': '#1f2a3a',
      'bg-selected': '#23395b',
      border: '#30363d',
      primary: '#4493f8',
      'primary-text': '#0d1117',
      focus: '#4493f866',
      shadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    },
  },

  // Bootstrap 4: só expõe --primary e --font-family-sans-serif; o resto é a paleta padrão (.table, .thead-light)
  bootstrap4: {
    light: {
      font: "var(--font-family-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif)",
      'font-size': '1rem',
      text: '#212529',
      muted: '#6c757d',
      bg: '#ffffff',
      'bg-alt': 'rgba(0, 0, 0, 0.05)',
      'bg-header': '#e9ecef',
      'header-text': '#495057',
      'header-weight': '700',
      'bg-hover': 'rgba(0, 0, 0, 0.075)',
      'bg-selected': '#b8daff',
      border: '#dee2e6',
      primary: 'var(--primary, #007bff)',
      'primary-text': '#ffffff',
      focus: 'rgba(0, 123, 255, 0.25)',
      radius: '0.25rem',
      shadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
      'cell-py': '0.75rem',
      'cell-px': '0.75rem',
    },
    dark: {
      font: "var(--font-family-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif)",
      'font-size': '1rem',
      text: '#ffffff',
      muted: '#adb5bd',
      bg: '#343a40',
      'bg-alt': 'rgba(255, 255, 255, 0.05)',
      'bg-header': '#23272b',
      'header-text': '#ffffff',
      'header-weight': '700',
      'bg-hover': 'rgba(255, 255, 255, 0.075)',
      'bg-selected': '#1d4f86',
      border: '#454d55',
      primary: 'var(--primary, #007bff)',
      'primary-text': '#ffffff',
      focus: 'rgba(0, 123, 255, 0.4)',
      radius: '0.25rem',
      shadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.5)',
      'cell-py': '0.75rem',
      'cell-px': '0.75rem',
    },
  },

  // Bootstrap 5.3: lê --bs-* (inclusive o modo escuro via data-bs-theme="dark")
  bootstrap5: {
    light: {
      font: 'var(--bs-body-font-family, ' + SYSTEM_FONT + ')',
      'font-size': 'var(--bs-body-font-size, 1rem)',
      text: 'var(--bs-body-color, #212529)',
      muted: 'var(--bs-secondary-color, rgba(33, 37, 41, 0.75))',
      bg: 'var(--bs-body-bg, #ffffff)',
      'bg-alt': 'rgba(var(--bs-emphasis-color-rgb, 0, 0, 0), 0.05)',
      'bg-header': 'var(--bs-tertiary-bg, #f8f9fa)',
      'header-text': 'var(--bs-emphasis-color, #000000)',
      'header-weight': '600',
      'bg-hover': 'rgba(var(--bs-emphasis-color-rgb, 0, 0, 0), 0.075)',
      'bg-selected': 'var(--bs-primary-bg-subtle, #cfe2ff)',
      border: 'var(--bs-border-color, #dee2e6)',
      primary: 'var(--bs-primary, #0d6efd)',
      'primary-text': '#ffffff',
      focus: 'rgba(var(--bs-primary-rgb, 13, 110, 253), 0.25)',
      radius: 'var(--bs-border-radius, 0.375rem)',
      shadow: 'var(--bs-box-shadow, 0 0.5rem 1rem rgba(0, 0, 0, 0.15))',
      'cell-py': '0.5rem',
      'cell-px': '0.5rem',
    },
    dark: {
      font: 'var(--bs-body-font-family, ' + SYSTEM_FONT + ')',
      'font-size': 'var(--bs-body-font-size, 1rem)',
      text: '#dee2e6',
      muted: 'rgba(222, 226, 230, 0.75)',
      bg: '#212529',
      'bg-alt': 'rgba(255, 255, 255, 0.05)',
      'bg-header': '#2b3035',
      'header-text': '#ffffff',
      'header-weight': '600',
      'bg-hover': 'rgba(255, 255, 255, 0.075)',
      'bg-selected': '#031633',
      border: '#495057',
      primary: 'var(--bs-primary, #0d6efd)',
      'primary-text': '#ffffff',
      focus: 'rgba(13, 110, 253, 0.4)',
      radius: 'var(--bs-border-radius, 0.375rem)',
      shadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.5)',
      'cell-py': '0.5rem',
      'cell-px': '0.5rem',
    },
  },

  // Tailwind: lê as variáveis do Tailwind 4 (--color-*, --font-sans, --radius-lg); no 3 usa a paleta padrão.
  // Defina --color-primary no seu tema para trocar a cor de destaque.
  tailwind: {
    light: {
      font: "var(--font-sans, ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji')",
      'font-size': 'var(--text-sm, 0.875rem)',
      text: 'var(--color-gray-900, #111827)',
      muted: 'var(--color-gray-500, #6b7280)',
      bg: 'var(--color-white, #ffffff)',
      'bg-alt': 'var(--color-gray-50, #f9fafb)',
      'bg-header': 'var(--color-gray-50, #f9fafb)',
      'header-text': 'var(--color-gray-900, #111827)',
      'header-weight': '600',
      'bg-hover': 'var(--color-gray-100, #f3f4f6)',
      'bg-selected': 'var(--color-indigo-50, #eef2ff)',
      border: 'var(--color-gray-200, #e5e7eb)',
      primary: 'var(--color-primary, var(--color-indigo-600, #4f46e5))',
      'primary-text': '#ffffff',
      focus: 'rgba(99, 102, 241, 0.5)',
      radius: 'var(--radius-lg, 0.5rem)',
      shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      'cell-py': '0.625rem',
      'cell-px': '0.75rem',
    },
    dark: {
      font: "var(--font-sans, ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji')",
      'font-size': 'var(--text-sm, 0.875rem)',
      text: 'var(--color-gray-100, #f3f4f6)',
      muted: 'var(--color-gray-400, #9ca3af)',
      bg: 'var(--color-gray-900, #111827)',
      'bg-alt': 'rgba(255, 255, 255, 0.03)',
      'bg-header': 'var(--color-gray-800, #1f2937)',
      'header-text': 'var(--color-white, #ffffff)',
      'header-weight': '600',
      'bg-hover': 'rgba(255, 255, 255, 0.06)',
      'bg-selected': 'rgba(99, 102, 241, 0.25)',
      border: 'rgba(255, 255, 255, 0.1)',
      primary: 'var(--color-primary, var(--color-indigo-500, #6366f1))',
      'primary-text': '#ffffff',
      focus: 'rgba(129, 140, 248, 0.5)',
      radius: 'var(--radius-lg, 0.5rem)',
      shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
      'cell-py': '0.625rem',
      'cell-px': '0.75rem',
    },
  },

  // Angular Material 3: lê --mat-sys-* (que já mudam no tema escuro); sem elas, a paleta base do M3
  material: {
    light: {
      font: "var(--mat-sys-body-medium-font, Roboto, 'Helvetica Neue', sans-serif)",
      'font-size': 'var(--mat-sys-body-medium-size, 14px)',
      text: 'var(--mat-sys-on-surface, #1d1b20)',
      muted: 'var(--mat-sys-on-surface-variant, #49454f)',
      bg: 'var(--mat-sys-surface, #fef7ff)',
      'bg-alt': 'var(--mat-sys-surface-container-low, #f7f2fa)',
      'bg-header': 'var(--mat-sys-surface, #fef7ff)',
      'header-text': 'var(--mat-sys-on-surface-variant, #49454f)',
      'header-weight': '500',
      'bg-hover': 'var(--mat-sys-surface-container-high, #ece6f0)',
      'bg-selected': 'var(--mat-sys-secondary-container, #e8def8)',
      border: 'var(--mat-sys-outline-variant, #cac4d0)',
      primary: 'var(--mat-sys-primary, #6750a4)',
      'primary-text': 'var(--mat-sys-on-primary, #ffffff)',
      focus: 'var(--mat-sys-primary, #6750a4)',
      radius: 'var(--mat-sys-corner-small, 8px)',
      shadow: 'var(--mat-sys-level2, 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15))',
      'cell-py': '14px',
      'cell-px': '16px',
    },
    dark: {
      font: "var(--mat-sys-body-medium-font, Roboto, 'Helvetica Neue', sans-serif)",
      'font-size': 'var(--mat-sys-body-medium-size, 14px)',
      text: 'var(--mat-sys-on-surface, #e6e0e9)',
      muted: 'var(--mat-sys-on-surface-variant, #cac4d0)',
      bg: 'var(--mat-sys-surface, #141218)',
      'bg-alt': 'var(--mat-sys-surface-container-low, #1d1b20)',
      'bg-header': 'var(--mat-sys-surface, #141218)',
      'header-text': 'var(--mat-sys-on-surface-variant, #cac4d0)',
      'header-weight': '500',
      'bg-hover': 'var(--mat-sys-surface-container-high, #2b2930)',
      'bg-selected': 'var(--mat-sys-secondary-container, #4a4458)',
      border: 'var(--mat-sys-outline-variant, #49454f)',
      primary: 'var(--mat-sys-primary, #d0bcff)',
      'primary-text': 'var(--mat-sys-on-primary, #381e72)',
      focus: 'var(--mat-sys-primary, #d0bcff)',
      radius: 'var(--mat-sys-corner-small, 8px)',
      shadow: 'var(--mat-sys-level2, 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15))',
      'cell-py': '14px',
      'cell-px': '16px',
    },
  },
};

const DENSITY: Record<Density, number> = { compact: 0.5, standard: 1, comfortable: 1.5 };

function block(selector: string, p: Palette): string {
  return `${selector}{${(Object.keys(p) as ThemeToken[]).map((k) => `--_t-${k}:${p[k]};`).join('')}}`;
}

/**
 * CSS dos temas para o `:host` de um componente. Atributos lidos:
 * `data-bm-theme`, `data-bm-appearance` e `data-bm-density`.
 */
export function themeCss(): string {
  const out: string[] = [];
  const tokens = Object.keys(THEME_TOKENS) as ThemeToken[];
  // Variáveis finais usadas pelos estilos: a pública vence a do tema
  const finals = tokens
    .filter((k) => k !== 'cell-py' && k !== 'cell-px')
    .map((k) => `--_${k}:var(${THEME_TOKENS[k]},var(--_t-${k}));`)
    .join('');
  out.push(
    `:host{--_density:1;${finals}` +
      '--_cell-py:calc(var(--bm-cell-padding-y,var(--_t-cell-py)) * var(--_density));' +
      '--_cell-px:var(--bm-cell-padding-x,var(--_t-cell-px));' +
      'font-family:var(--_font);font-size:var(--_font-size);color:var(--_text);}',
  );
  out.push(block(':host', THEME_DEFS.default.light));
  for (const name of THEMES) {
    const def = THEME_DEFS[name];
    const t = name === 'default' ? '' : `[data-bm-theme='${name}']`;
    if (t) out.push(block(`:host(${t})`, def.light));
    out.push(block(`:host(${t}[data-bm-appearance='dark'])`, def.dark));
    out.push(`@media (prefers-color-scheme: dark){${block(`:host(${t}[data-bm-appearance='auto'])`, def.dark)}}`);
  }
  for (const d of Object.keys(DENSITY) as Density[]) {
    if (d !== 'standard') out.push(`:host([data-bm-density='${d}']){--_density:${DENSITY[d]};}`);
  }
  return out.join('\n');
}

/** Valores de um tema (para documentação ou para montar um tema próprio). */
export function themePalette(theme: ThemeName, appearance: 'light' | 'dark' = 'light'): Record<string, string> {
  const p = (THEME_DEFS[theme] || THEME_DEFS.default)[appearance];
  const out: Record<string, string> = {};
  (Object.keys(p) as ThemeToken[]).forEach((k) => (out[THEME_TOKENS[k]] = p[k]));
  return out;
}

// ------------------------------------------------------------------ configuração global

export interface BmConfig {
  /** Tema de todas as grids que não tiverem o atributo `theme`. */
  theme?: ThemeName;
  appearance?: Appearance;
  density?: Density;
  /** Idioma padrão (números, datas e textos). */
  locale?: string;
  /** Moeda do formato `'currency'` (ex.: "BRL"). Padrão: BRL no pt-BR, USD nos outros idiomas. */
  currency?: string;
}

const CONFIG_KEY = '__brunomouradevConfig';
export const CONFIG_EVENT = 'bm-config-changed';

/** Configuração global atual (compartilhada entre data-grid e pivot-grid). */
export function getConfig(): BmConfig {
  const g = (typeof globalThis !== 'undefined' ? globalThis : {}) as any;
  return g[CONFIG_KEY] || {};
}

/**
 * Define o padrão de todas as grids da página, de uma vez:
 * `configure({ theme: 'bootstrap4', density: 'compact', locale: 'pt-BR' })`.
 * Atributos no elemento continuam valendo mais que a configuração.
 */
export function configure(config: BmConfig): void {
  const g = (typeof globalThis !== 'undefined' ? globalThis : {}) as any;
  g[CONFIG_KEY] = { ...(g[CONFIG_KEY] || {}), ...config };
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONFIG_EVENT));
  }
}

export interface ThemeHost {
  theme?: ThemeName;
  appearance?: Appearance;
  density?: Density;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

/** Aplica no elemento os atributos que o CSS dos temas lê (propriedade > configure() > padrão). */
export function applyThemeAttributes(el: ThemeHost): void {
  const cfg = getConfig();
  const set = (name: string, value: string) => {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  };
  set('data-bm-theme', el.theme || cfg.theme || 'default');
  set('data-bm-appearance', el.appearance || cfg.appearance || 'light');
  set('data-bm-density', el.density || cfg.density || 'standard');
}
