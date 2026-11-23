import { configure, THEMES, type Appearance, type Density, type ThemeName } from '@brunomouradev/data-grid';

/**
 * Seletores de tema, aparência e densidade do playground.
 * Usa `configure()`: muda todas as grids da página de uma vez.
 */
const KEY = 'bm-playground-theme';
const LABELS: Record<ThemeName, string> = {
  default: 'Padrão',
  bootstrap4: 'Bootstrap 4',
  bootstrap5: 'Bootstrap 5',
  tailwind: 'Tailwind',
  material: 'Material',
};

interface Saved {
  theme: ThemeName;
  appearance: Appearance;
  density: Density;
}

function load(): Saved {
  const base: Saved = { theme: 'default', appearance: 'light', density: 'standard' };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return base;
  }
}

function select<T extends string>(label: string, options: [T, string][], value: T, onChange: (v: T) => void): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.append(label + ' ');
  const sel = document.createElement('select');
  for (const [v, text] of options) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = text;
    o.selected = v === value;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => onChange(sel.value as T));
  wrap.appendChild(sel);
  return wrap;
}

export function mountThemePicker(container: HTMLElement): void {
  const state = load();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    configure(state);
    const dark = state.appearance === 'dark' || (state.appearance === 'auto' && media.matches);
    document.documentElement.classList.toggle('pg-dark', dark);
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  };
  media.addEventListener('change', apply);
  container.prepend(
    select('Tema', THEMES.map((t) => [t, LABELS[t]] as [ThemeName, string]), state.theme, (v) => ((state.theme = v), apply())),
    select<Appearance>('Aparência', [['light', 'clara'], ['dark', 'escura'], ['auto', 'do sistema']], state.appearance, (v) => ((state.appearance = v), apply())),
    select<Density>('Densidade', [['compact', 'compacta'], ['standard', 'normal'], ['comfortable', 'confortável']], state.density, (v) => ((state.density = v), apply())),
  );
  apply();
}
