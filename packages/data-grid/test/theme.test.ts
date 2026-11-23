import { describe, expect, it } from 'vitest';
import { applyThemeAttributes, configure, getConfig, THEMES, themeCss, themePalette } from '../src/engine/index';

const fakeHost = (own: Record<string, string> = {}) => {
  const attrs: Record<string, string> = {};
  return {
    ...own,
    attrs,
    setAttribute: (n: string, v: string) => (attrs[n] = v),
    getAttribute: (n: string) => (n in attrs ? attrs[n] : null),
  } as any;
};

describe('temas', () => {
  it('gera um bloco por tema, com claro, escuro e automático', () => {
    const css = themeCss();
    for (const t of THEMES.filter((x) => x !== 'default')) {
      expect(css).toContain(`:host([data-bm-theme='${t}'])`);
      expect(css).toContain(`:host([data-bm-theme='${t}'][data-bm-appearance='dark'])`);
      expect(css).toContain(`:host([data-bm-theme='${t}'][data-bm-appearance='auto'])`);
    }
    expect(css).toContain(":host([data-bm-density='compact']){--_density:0.5;}");
  });

  it('as variáveis públicas --bm-* sempre vencem o tema', () => {
    const css = themeCss();
    expect(css).toContain('--_primary:var(--bm-color-primary,var(--_t-primary));');
    expect(css).toContain('--_cell-py:calc(var(--bm-cell-padding-y,var(--_t-cell-py)) * var(--_density));');
  });

  it('os temas leem as variáveis do framework, com a cor padrão como reserva', () => {
    expect(themePalette('bootstrap5')['--bm-color-primary']).toBe('var(--bs-primary, #0d6efd)');
    expect(themePalette('bootstrap4')['--bm-color-primary']).toBe('var(--primary, #007bff)');
    expect(themePalette('material')['--bm-color-bg']).toBe('var(--mat-sys-surface, #fef7ff)');
    expect(themePalette('tailwind', 'dark')['--bm-color-bg']).toBe('var(--color-gray-900, #111827)');
  });

  it('configure() define o padrão; o atributo do elemento vence', () => {
    configure({ theme: 'bootstrap4', density: 'compact', locale: 'pt-BR' });
    expect(getConfig()).toMatchObject({ theme: 'bootstrap4', density: 'compact', locale: 'pt-BR' });
    const a = fakeHost();
    applyThemeAttributes(a);
    expect(a.attrs).toEqual({ 'data-bm-theme': 'bootstrap4', 'data-bm-appearance': 'light', 'data-bm-density': 'compact' });
    const b = fakeHost({ theme: 'material', appearance: 'dark' });
    applyThemeAttributes(b);
    expect(b.attrs['data-bm-theme']).toBe('material');
    expect(b.attrs['data-bm-appearance']).toBe('dark');
    configure({ theme: undefined, density: undefined, locale: undefined });
    const c = fakeHost();
    applyThemeAttributes(c);
    expect(c.attrs['data-bm-theme']).toBe('default');
  });
});
