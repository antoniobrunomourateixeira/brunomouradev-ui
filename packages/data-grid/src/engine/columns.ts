import type { ColumnLayoutItem } from './types';
import type { ResolvedColumn } from './query';

/**
 * Layout das colunas: ordem de exibição e visibilidade, por dataField.
 * Funções puras (sem DOM) usadas pelo seletor de colunas e pelo arrastar do cabeçalho.
 */

/** Layout padrão: ordem por `visibleIndex` (estável) e visibilidade de `visible`. */
export function defaultColumnLayout<T>(columns: ResolvedColumn<T>[]): ColumnLayoutItem[] {
  return columns
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.visibleIndex ?? a.i) - (b.c.visibleIndex ?? b.i) || a.i - b.i)
    .map(({ c }) => (c.fixed ? { dataField: c.dataField, visible: c.visible, fixed: true } : { dataField: c.dataField, visible: c.visible }));
}

/**
 * Aplica um layout salvo sobre as colunas atuais. Campos que não existem mais são
 * ignorados; colunas novas entram na posição padrão relativa, com a visibilidade padrão.
 */
export function mergeColumnLayout<T>(columns: ResolvedColumn<T>[], saved: ColumnLayoutItem[] | undefined | null): ColumnLayoutItem[] {
  const base = defaultColumnLayout(columns);
  if (!saved || !saved.length) return base;
  const known = new Map(base.map((x) => [x.dataField, x]));
  const out: ColumnLayoutItem[] = [];
  const seen = new Set<string>();
  for (const s of saved) {
    if (!known.has(s.dataField) || seen.has(s.dataField)) continue;
    seen.add(s.dataField);
    const item: ColumnLayoutItem = { dataField: s.dataField, visible: s.visible !== false };
    if (typeof s.width === 'number' && s.width > 0) item.width = Math.round(s.width);
    const fixed = typeof s.fixed === 'boolean' ? s.fixed : known.get(s.dataField)!.fixed;
    if (fixed) item.fixed = true;
    out.push(item);
  }
  // Colunas que não estavam no layout salvo: entram depois da vizinha anterior no padrão
  base.forEach((b, i) => {
    if (seen.has(b.dataField)) return;
    let at = 0;
    for (let k = i - 1; k >= 0; k--) {
      const idx = out.findIndex((o) => o.dataField === base[k].dataField);
      if (idx >= 0) {
        at = idx + 1;
        break;
      }
    }
    out.splice(at, 0, { ...b });
    seen.add(b.dataField);
  });
  return ensureOneVisible(out);
}

/** Garante pelo menos uma coluna visível (a primeira). */
function ensureOneVisible(layout: ColumnLayoutItem[]): ColumnLayoutItem[] {
  if (!layout.length || layout.some((x) => x.visible)) return layout;
  return layout.map((x, i) => (i === 0 ? { ...x, visible: true } : x));
}

/** Mostra ou esconde uma coluna. Não deixa esconder a última visível. */
export function setColumnVisibility(layout: ColumnLayoutItem[], dataField: string, visible: boolean): ColumnLayoutItem[] {
  if (!visible && layout.filter((x) => x.visible).length <= 1) return layout;
  return layout.map((x) => (x.dataField === dataField ? { ...x, visible } : x));
}

/**
 * Move uma coluna para antes de `beforeField` (null = para o fim).
 * Usado pelo arrastar: a posição vem das colunas visíveis.
 */
export function moveColumnBefore(layout: ColumnLayoutItem[], dataField: string, beforeField: string | null): ColumnLayoutItem[] {
  if (dataField === beforeField) return layout;
  const item = layout.find((x) => x.dataField === dataField);
  if (!item) return layout;
  const rest = layout.filter((x) => x.dataField !== dataField);
  const at = beforeField == null ? rest.length : rest.findIndex((x) => x.dataField === beforeField);
  rest.splice(at < 0 ? rest.length : at, 0, item);
  return rest;
}

/** Move uma coluna para a posição `visibleIndex` entre as colunas visíveis. */
export function moveColumnToVisibleIndex(layout: ColumnLayoutItem[], dataField: string, visibleIndex: number): ColumnLayoutItem[] {
  const visible = layout.filter((x) => x.visible && x.dataField !== dataField);
  const before = visibleIndex >= 0 && visibleIndex < visible.length ? visible[visibleIndex].dataField : null;
  return moveColumnBefore(layout, dataField, before);
}

/** Colunas na ordem do layout, com `visible` do layout. */
export function applyColumnLayout<T>(columns: ResolvedColumn<T>[], layout: ColumnLayoutItem[]): ResolvedColumn<T>[] {
  const byField = new Map(columns.map((c) => [c.dataField, c]));
  const out: ResolvedColumn<T>[] = [];
  for (const l of layout) {
    const c = byField.get(l.dataField);
    if (!c) continue;
    const fixed = l.fixed != null ? l.fixed : !!c.fixed;
    const width = l.width != null ? l.width : c.width;
    out.push(c.visible === l.visible && !!c.fixed === fixed && c.width === width ? c : { ...c, visible: l.visible, fixed, width });
  }
  return out;
}

/** Os dois layouts são iguais (mesma ordem e visibilidade)? */
export function sameColumnLayout(a: ColumnLayoutItem[], b: ColumnLayoutItem[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (x, i) =>
        x.dataField === b[i].dataField && x.visible === b[i].visible && (x.width || 0) === (b[i].width || 0) && !!x.fixed === !!b[i].fixed,
    )
  );
}

/** Define larguras (px) de várias colunas de uma vez. `null` volta à largura padrão. */
export function setColumnWidths(layout: ColumnLayoutItem[], widths: Record<string, number | null>): ColumnLayoutItem[] {
  return layout.map((x) => {
    if (!(x.dataField in widths)) return x;
    const w = widths[x.dataField];
    const next = { ...x };
    if (w == null) delete next.width;
    else next.width = Math.max(20, Math.round(w));
    return next;
  });
}

/** Fixa (ou solta) uma coluna à esquerda. */
export function setColumnFixed(layout: ColumnLayoutItem[], dataField: string, fixed: boolean): ColumnLayoutItem[] {
  return layout.map((x) => (x.dataField === dataField ? { ...x, fixed } : x));
}

/** Ordem de exibição: as colunas fixas primeiro (mantendo a ordem entre elas). */
export function fixedFirst<C extends { fixed?: boolean }>(columns: C[]): C[] {
  return [...columns.filter((c) => c.fixed), ...columns.filter((c) => !c.fixed)];
}
