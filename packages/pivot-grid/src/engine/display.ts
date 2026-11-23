import { formatValue, writeXlsx, excelNumberFormat } from '@brunomouradev/data-grid/engine';
import type { XlsxCell } from '@brunomouradev/data-grid/engine';
import { PATH_SEP } from './fields';
import type { PivotCellInfo, PivotColumnItem, PivotCube, PivotNode, PivotView, ResolvedPivotField, SummaryDisplayMode } from './types';

/**
 * "Mostrar valores como", formatação condicional e exportação Excel da pivot.
 * Tudo calculado a partir do cubo (sem reagregar os dados).
 */

const PERCENT_MODES: SummaryDisplayMode[] = [
  'percentOfGrandTotal',
  'percentOfRowTotal',
  'percentOfColumnTotal',
  'percentOfParentRow',
  'percentOfParentColumn',
  'percentDifferenceFromPrevious',
];

export function isPercentMode(mode: SummaryDisplayMode | undefined): boolean {
  return !!mode && PERCENT_MODES.indexOf(mode) >= 0;
}

interface NodeRef {
  node: PivotNode;
  parent: PivotNode | null;
}

const indexCache = new WeakMap<PivotCube, { rows: Map<string, NodeRef>; cols: Map<string, NodeRef> }>();

function indexTree(root: PivotNode): Map<string, NodeRef> {
  const map = new Map<string, NodeRef>();
  map.set(root.pathKey, { node: root, parent: null });
  const walk = (n: PivotNode) => {
    for (const c of n.children) {
      map.set(c.pathKey, { node: c, parent: n });
      walk(c);
    }
  };
  walk(root);
  return map;
}

function indexOf(cube: PivotCube) {
  let idx = indexCache.get(cube);
  if (!idx) {
    idx = { rows: indexTree(cube.rowRoot), cols: indexTree(cube.columnRoot) };
    indexCache.set(cube, idx);
  }
  return idx;
}

function parentKey(pathKey: string): string {
  const i = pathKey.lastIndexOf(PATH_SEP);
  return i < 0 ? '' : pathKey.slice(0, i);
}

const ratio = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b);

/** Valor exibido na célula conforme o `summaryDisplayMode` do campo de dados. */
export function displayValue(cube: PivotCube, rowKey: string, colKey: string, dataIndex: number): number | null {
  const f = cube.dataFields[dataIndex];
  const mode = f.summaryDisplayMode || 'absolute';
  const v = cube.getValue(rowKey, colKey, dataIndex);
  switch (mode) {
    case 'absolute':
      return v;
    case 'percentOfGrandTotal':
      return ratio(v, cube.getValue('', '', dataIndex));
    case 'percentOfRowTotal':
      return ratio(v, cube.getValue(rowKey, '', dataIndex));
    case 'percentOfColumnTotal':
      return ratio(v, cube.getValue('', colKey, dataIndex));
    case 'percentOfParentRow':
      return ratio(v, cube.getValue(rowKey === '' ? '' : parentKey(rowKey), colKey, dataIndex));
    case 'percentOfParentColumn':
      return ratio(v, cube.getValue(rowKey, colKey === '' ? '' : parentKey(colKey), dataIndex));
    case 'differenceFromPrevious':
    case 'percentDifferenceFromPrevious':
    case 'runningTotal': {
      if (colKey === '') return mode === 'runningTotal' ? v : null;
      const ref = indexOf(cube).cols.get(colKey);
      if (!ref || !ref.parent) return null;
      const siblings = ref.parent.children;
      const i = siblings.indexOf(ref.node);
      if (mode === 'runningTotal') {
        let sum: number | null = null;
        for (let k = 0; k <= i; k++) {
          const x = cube.getValue(rowKey, siblings[k].pathKey, dataIndex);
          if (x != null) sum = (sum || 0) + x;
        }
        return sum;
      }
      if (i <= 0 || v == null) return null;
      const prev = cube.getValue(rowKey, siblings[i - 1].pathKey, dataIndex);
      if (prev == null) return null;
      return mode === 'differenceFromPrevious' ? v - prev : prev === 0 ? null : (v - prev) / Math.abs(prev);
    }
  }
  return v;
}

/** Texto da célula (com o formato do campo ou em %). */
export function formatDisplay(value: number | null, f: ResolvedPivotField, locale: string): string {
  if (value == null) return '';
  if (isPercentMode(f.summaryDisplayMode)) {
    return formatValue(value, 'number', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }, locale);
  }
  if (f.summaryType === 'count' && (!f.summaryDisplayMode || f.summaryDisplayMode === 'absolute')) {
    return formatValue(value, 'number', undefined, locale);
  }
  return formatValue(value, 'number', f.summaryType === 'count' ? undefined : f.format, locale);
}

// ------------------------------------------------------------------ formatação condicional

export interface ConditionalStats {
  min: number;
  max: number;
  maxAbs: number;
}

/** Mínimo e máximo dos valores (sem totais) de cada campo de dados, como exibidos na view. */
export function conditionalStats(cube: PivotCube, view: PivotView): (ConditionalStats | null)[] {
  return cube.dataFields.map((f, d) => {
    const cf = f.conditionalFormat;
    if (!cf || typeof cf === 'function') return null;
    let min = Infinity;
    let max = -Infinity;
    for (const row of view.rows) {
      if (row.isGrandTotal || row.isTotal || row.expanded) continue; // grupo aberto = subtotal
      for (const col of view.columns) {
        if (col.dataIndex !== d || col.type !== 'value') continue;
        const v = displayValue(cube, row.pathKey, col.pathKey, d);
        if (v == null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return min === Infinity ? null : { min, max, maxAbs: Math.max(Math.abs(min), Math.abs(max)) };
  });
}

type RGBA = [number, number, number, number];

/** Aceita #rgb, #rrggbb, #rrggbbaa, rgb() e rgba(). */
export function parseColor(c: string): RGBA | null {
  const s = c.trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some((x) => isNaN(x))) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}

function mix(a: RGBA, b: RGBA, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const c = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k);
  const alpha = Math.round((a[3] + (b[3] - a[3]) * k) * 1000) / 1000;
  return `rgba(${c(0)}, ${c(1)}, ${c(2)}, ${alpha})`;
}

/** Estilo CSS da célula pela formatação condicional (ou null). */
export function conditionalStyle(
  f: ResolvedPivotField,
  value: number | null,
  stats: ConditionalStats | null,
  info: PivotCellInfo,
): Record<string, string> | null {
  const cf = f.conditionalFormat;
  if (!cf) return null;
  if (typeof cf === 'function') return cf(value, info) || null;
  if (info.isTotal || value == null || !stats) return null;
  if (cf.type === 'colorScale') {
    const lo = parseColor(cf.minColor || 'rgba(99, 190, 123, 0)');
    const hi = parseColor(cf.maxColor || 'rgba(99, 190, 123, 0.6)');
    if (!lo || !hi) return null;
    const span = stats.max - stats.min;
    const t = span ? (value - stats.min) / span : 1;
    const mid = cf.midColor ? parseColor(cf.midColor) : null;
    const bg = mid ? (t < 0.5 ? mix(lo, mid, t * 2) : mix(mid, hi, (t - 0.5) * 2)) : mix(lo, hi, t);
    return { 'background-color': bg };
  }
  if (cf.type === 'dataBar') {
    if (!stats.maxAbs) return null;
    const pct = Math.round((Math.abs(value) / stats.maxAbs) * 100);
    const color = value < 0 ? cf.negativeColor || 'rgba(201, 42, 42, 0.28)' : cf.color || 'rgba(31, 111, 235, 0.28)';
    return { 'background-image': `linear-gradient(90deg, ${color} ${pct}%, transparent ${pct}%)` };
  }
  return null;
}

// ------------------------------------------------------------------ Excel

export interface PivotXlsxOptions {
  locale: string;
  sheetName?: string;
}

/** Exporta o que está visível na pivot para .xlsx: cabeçalhos mesclados, números de verdade, totais em negrito. */
export function pivotToXlsx(cube: PivotCube, view: PivotView, options: PivotXlsxOptions): Uint8Array {
  const H = view.rowHeaderColumns || 1;
  const tabular = view.rows.some((r) => r.headers);
  const headRows = view.headerRows.length;
  const rows: (XlsxCell | null)[][] = [];
  const merges: { row: number; col: number; rowspan: number; colspan: number }[] = [];
  const head = (v: string): XlsxCell => ({ v, bold: true, fill: 2, border: 1, align: 'center' });

  // Cabeçalhos das colunas (com colspan/rowspan mesclados)
  const width = view.columns.length;
  const occupied: boolean[][] = view.headerRows.map(() => new Array(width).fill(false));
  for (let r = 0; r < headRows; r++) rows.push(new Array(H + width).fill(null));
  // Canto: nomes dos campos de linha
  if (tabular) {
    for (let i = 0; i < H; i++) {
      rows[0][i] = { ...head(cube.rowFields[i] ? cube.rowFields[i].caption : ''), align: 'left' };
      merges.push({ row: 0, col: i, rowspan: headRows, colspan: 1 });
      for (let r = 1; r < headRows; r++) rows[r][i] = head('');
    }
  } else {
    rows[0][0] = { ...head(cube.rowFields.map((f) => f.caption).join(' / ')), align: 'left' };
    merges.push({ row: 0, col: 0, rowspan: headRows, colspan: 1 });
    for (let r = 1; r < headRows; r++) rows[r][0] = head('');
  }
  view.headerRows.forEach((cells, r) => {
    let c = 0;
    for (const cell of cells) {
      while (c < width && occupied[r][c]) c++;
      rows[r][H + c] = { ...head(cell.text), fill: cell.type === 'total' || cell.type === 'grand' ? 3 : 2 };
      for (let rr = r; rr < r + cell.rowspan && rr < headRows; rr++) {
        for (let cc = c; cc < c + cell.colspan; cc++) {
          occupied[rr][cc] = true;
          if (rr !== r || cc !== c) rows[rr][H + cc] = head('');
        }
      }
      merges.push({ row: r, col: H + c, rowspan: cell.rowspan, colspan: cell.colspan });
      c += cell.colspan;
    }
  });

  // Formatos por campo de dados
  const fmts = cube.dataFields.map((f) =>
    isPercentMode(f.summaryDisplayMode) ? '0.0%' : f.summaryType === 'count' ? '#,##0' : excelNumberFormat(f.format, options.locale) || null,
  );
  const outline: number[] = new Array(headRows).fill(0);
  const carry: string[] = new Array(H).fill('');
  for (const row of view.rows) {
    const strong = row.isGrandTotal || row.isTotal || row.expanded;
    const line: (XlsxCell | null)[] = new Array(H + width).fill(null);
    if (tabular) {
      for (const h of row.headers || []) {
        carry[h.column] = h.text;
        for (let k = h.column + 1; k < h.column + h.colspan; k++) carry[k] = '';
      }
      carry.forEach((t, i) => (line[i] = { v: t, bold: strong, fill: row.isGrandTotal ? 3 : 0 }));
    } else {
      line[0] = { v: row.text, bold: strong, indent: row.level > 0 ? row.level : 0, fill: row.isGrandTotal ? 3 : 0 };
    }
    view.columns.forEach((col: PivotColumnItem, i) => {
      const v = displayValue(cube, row.pathKey, col.pathKey, col.dataIndex);
      const total = strong || col.type !== 'value';
      line[H + i] = { v: v == null ? null : v, numFmt: fmts[col.dataIndex], bold: total, fill: row.isGrandTotal || col.type === 'grand' ? 3 : 0 };
    });
    rows.push(line);
    outline.push(row.isGrandTotal ? 0 : Math.max(0, row.level));
  }

  return writeXlsx({
    name: options.sheetName || 'Pivot',
    rows,
    merges,
    freezeRows: headRows,
    freezeCols: H,
    outlineLevels: outline,
    colWidths: Array.from({ length: H + width }, (_, i) => (i < H ? (tabular ? 18 : 32) : 14)),
  });
}
