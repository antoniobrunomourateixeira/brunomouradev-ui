import { toNumber } from '@brunomouradev/data-grid/engine';
import {
  PATH_SEP,
  compareValues,
  fieldText,
  fieldValue,
  pathKeyOf,
  rawFieldValue,
  valueKey,
} from './fields';
import type {
  ExpansionState,
  PivotColumnItem,
  PivotCube,
  PivotHeaderCell,
  PivotLayoutOptions,
  PivotNode,
  PivotRowHeaderCell,
  PivotRowItem,
  PivotView,
  ResolvedPivotField,
  SummaryType,
} from './types';

const CELL_SEP = '\u0002';

interface Acc {
  sum: number;
  n: number;
  count: number;
  min: number;
  max: number;
}

function newAcc(): Acc {
  return { sum: 0, n: 0, count: 0, min: Infinity, max: -Infinity };
}

function finalize(acc: Acc | undefined, type: SummaryType): number | null {
  if (!acc) return null;
  switch (type) {
    case 'count': return acc.count;
    case 'sum': return acc.n ? acc.sum : null;
    case 'avg': return acc.n ? acc.sum / acc.n : null;
    case 'min': return acc.n ? acc.min : null;
    case 'max': return acc.n ? acc.max : null;
  }
}

function byArea(fields: ResolvedPivotField[], area: string) {
  return fields
    .map((f, i) => ({ f, i }))
    .filter((x) => x.f.area === area)
    .sort((a, b) => (a.f.areaIndex ?? a.i) - (b.f.areaIndex ?? b.i) || a.i - b.i)
    .map((x) => x.f);
}

function rootNode(field: ResolvedPivotField): PivotNode {
  return { value: null, key: '', path: [], pathKey: '', level: -1, text: '', field, children: [] };
}

/** Registro passa nos filtros de todos os campos que têm filterValues. */
export function makeRecordFilter(fields: ResolvedPivotField[]): (row: any) => boolean {
  // include + [] = nada passa (usuário desmarcou tudo); exclude + [] = sem filtro
  const active = fields
    .filter((f) => Array.isArray(f.filterValues))
    .filter((f) => !(f.filterType === 'exclude' && f.filterValues!.length === 0))
    .map((f) => ({ f, keys: new Set(f.filterValues!.map(valueKey)), exclude: f.filterType === 'exclude' }));
  if (!active.length) return () => true;
  return (row) =>
    active.every(({ f, keys, exclude }) => {
      const has = keys.has(valueKey(fieldValue(row, f)));
      return exclude ? !has : has;
    });
}

/**
 * Etapa 1 (pesada): filtra, agrupa e agrega. Gera as árvores de linhas e colunas
 * e os acumuladores de todas as combinações (inclusive subtotais e total geral).
 */
export function buildCube<T>(data: T[], fields: ResolvedPivotField<T>[], locale: string, blankText = '(vazio)'): PivotCube {
  const rowFields = byArea(fields, 'row');
  const columnFields = byArea(fields, 'column');
  let dataFields = byArea(fields, 'data');
  if (!dataFields.length) {
    dataFields = [
      { name: '__count', caption: /^pt/i.test(locale) ? 'Quantidade' : 'Count', dataType: 'number', summaryType: 'count', sortOrder: 'asc', area: 'data' },
    ];
  }

  const basePass = makeRecordFilter(fields);
  // Top N: mantém só os N valores com maior (ou menor) total em cada campo de linha/coluna que pedir
  const topFilters = [...rowFields, ...columnFields]
    .filter((f) => f.topN && f.topN.count > 0)
    .map((f) => {
      const t = f.topN!;
      let d = dataFields.findIndex((x) => x.name === t.dataField || x.dataField === t.dataField);
      if (d < 0) d = 0;
      const df = dataFields[d];
      const accs = new Map<string, Acc>();
      for (const row of data) {
        if (!basePass(row)) continue;
        const k = valueKey(fieldValue(row, f));
        let a = accs.get(k);
        if (!a) accs.set(k, (a = newAcc()));
        a.count++;
        const n = df.name === '__count' ? null : toNumber(rawFieldValue(row, df));
        if (n != null) {
          a.sum += n;
          a.n++;
          if (n < a.min) a.min = n;
          if (n > a.max) a.max = n;
        }
      }
      const ranked = Array.from(accs.entries())
        .map(([k, a]) => ({ k, v: finalize(a, df.summaryType) }))
        .filter((x) => x.v != null)
        .sort((a, b) => (t.bottom ? a.v! - b.v! : b.v! - a.v!));
      return { f, keep: new Set(ranked.slice(0, t.count).map((x) => x.k)) };
    });
  const pass = topFilters.length
    ? (row: any) => basePass(row) && topFilters.every(({ f, keep }) => keep.has(valueKey(fieldValue(row, f))))
    : basePass;
  const rowRoot = rootNode(rowFields[0] || dataFields[0]);
  const columnRoot = rootNode(columnFields[0] || dataFields[0]);
  const cells = new Map<string, Acc[]>();
  let recordCount = 0;

  const insertPath = (root: PivotNode, levels: ResolvedPivotField[], row: any, out: string[]) => {
    out.length = 0;
    out.push('');
    let node = root;
    const keys: string[] = [];
    for (let l = 0; l < levels.length; l++) {
      const f = levels[l];
      const v = fieldValue(row, f);
      const k = valueKey(v);
      keys.push(k);
      let child = (node as any)._map ? (node as any)._map.get(k) : undefined;
      if (!child) {
        child = {
          value: v,
          key: k,
          path: node.path.concat([v]),
          pathKey: pathKeyOf(keys),
          level: l,
          text: fieldText(v, f, locale, blankText),
          field: f,
          children: [],
        } as PivotNode;
        if (!(node as any)._map) (node as any)._map = new Map();
        (node as any)._map.set(k, child);
        node.children.push(child);
      }
      node = child;
      out.push(node.pathKey);
    }
  };

  const rowKeys: string[] = [];
  const colKeys: string[] = [];
  const D = dataFields.length;

  for (const row of data) {
    if (!pass(row)) continue;
    recordCount++;
    insertPath(rowRoot, rowFields, row, rowKeys);
    insertPath(columnRoot, columnFields, row, colKeys);

    const nums: (number | null)[] = dataFields.map((f) => (f.name === '__count' ? null : toNumber(rawFieldValue(row, f))));

    for (let i = 0; i < rowKeys.length; i++) {
      for (let j = 0; j < colKeys.length; j++) {
        const key = rowKeys[i] + CELL_SEP + colKeys[j];
        let accs = cells.get(key);
        if (!accs) {
          accs = [];
          for (let d = 0; d < D; d++) accs.push(newAcc());
          cells.set(key, accs);
        }
        for (let d = 0; d < D; d++) {
          const a = accs[d];
          a.count++;
          const n = nums[d];
          if (n != null) {
            a.sum += n;
            a.n++;
            if (n < a.min) a.min = n;
            if (n > a.max) a.max = n;
          }
        }
      }
    }
  }

  const getValue = (rowPathKey: string, columnPathKey: string, dataIndex: number) => {
    const accs = cells.get(rowPathKey + CELL_SEP + columnPathKey);
    return finalize(accs && accs[dataIndex], dataFields[dataIndex].summaryType);
  };

  // Ordena as árvores pelo valor do campo ou, com sortBySummaryField, pelo total
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const sortTree = (node: PivotNode, isRow: boolean) => {
    delete (node as any)._map;
    if (!node.children.length) return;
    const field = node.children[0].field;
    const sign = field.sortOrder === 'desc' ? -1 : 1;
    const byValue = (a: PivotNode, b: PivotNode) => {
      if (a.value == null || b.value == null) return compareValues(a.value, b.value, collator);
      return sign * compareValues(a.value, b.value, collator);
    };
    const d = summarySortIndex(field, dataFields);
    if (d < 0) {
      node.children.sort(byValue);
    } else {
      const other = pathKeyOf((field.sortBySummaryPath || []).map(valueKey));
      const totals = new Map<PivotNode, number | null>();
      for (const c of node.children) {
        totals.set(c, isRow ? getValue(c.pathKey, other, d) : getValue(other, c.pathKey, d));
      }
      node.children.sort((a, b) => {
        const va = totals.get(a)!;
        const vb = totals.get(b)!;
        if (va == null || vb == null) return va == null && vb == null ? byValue(a, b) : va == null ? 1 : -1;
        return sign * (va - vb) || byValue(a, b);
      });
    }
    node.children.forEach((c) => sortTree(c, isRow));
  };
  sortTree(rowRoot, true);
  sortTree(columnRoot, false);

  return {
    rowFields,
    columnFields,
    dataFields,
    rowRoot,
    columnRoot,
    recordCount,
    getValue,
  };
}

/** Índice do campo de dados usado na ordenação por total, ou -1. */
export function summarySortIndex(field: ResolvedPivotField, dataFields: ResolvedPivotField[]): number {
  const s = field.sortBySummaryField;
  if (!s) return -1;
  return dataFields.findIndex((f) => f.name === s || f.dataField === s);
}

export function isExpanded(node: PivotNode, exp: ExpansionState): boolean {
  if (!node.children.length) return false;
  const o = exp.overrides[node.pathKey];
  if (o !== undefined) return o;
  if (exp.all !== undefined) return exp.all;
  return !!node.field.expanded;
}

/**
 * Etapa 2 (leve): monta o que fica visível de acordo com expandir/recolher.
 * Linhas usam layout em árvore (o subtotal fica na própria linha do grupo).
 */
export function buildView(cube: PivotCube, opts: PivotLayoutOptions): PivotView {
  const D = cube.dataFields.length;

  // Ordenação das linhas por uma coluna (para o indicador no cabeçalho)
  const sortField = cube.rowFields.find((f) => summarySortIndex(f, cube.dataFields) >= 0);
  const rowSort = sortField
    ? {
        dataIndex: summarySortIndex(sortField, cube.dataFields),
        pathKey: pathKeyOf((sortField.sortBySummaryPath || []).map(valueKey)),
        order: sortField.sortOrder,
      }
    : null;
  const sortOf = (pathKey: string, dataIndex: number) =>
    rowSort && rowSort.pathKey === pathKey && rowSort.dataIndex === dataIndex ? rowSort.order : undefined;
  // Com um campo de dados, o cabeçalho-folha é ordenável; com vários, a linha de nomes dos campos é
  const leafSort = (pathKey: string) => (D === 1 ? { dataIndex: 0, sortOrder: sortOf(pathKey, 0) } : {});

  // ---- linhas
  const { rows, rowHeaderColumns } = opts.rowLayout === 'tabular' ? tabularRows(cube, opts) : treeRows(cube, opts);

  // ---- colunas (folhas)
  const leaves: { pathKey: string; path: any[]; type: 'value' | 'total' | 'grand' }[] = [];
  const hasTotalCol = (n: PivotNode) => opts.showColumnTotals && isExpanded(n, opts.columnExpansion);
  const leafCount = (n: PivotNode): number =>
    isExpanded(n, opts.columnExpansion) ? n.children.reduce((s, c) => s + leafCount(c), 0) + (hasTotalCol(n) ? 1 : 0) : 1;
  const depthOf = (n: PivotNode, level: number): number =>
    isExpanded(n, opts.columnExpansion)
      ? Math.max(...n.children.map((c) => depthOf(c, level + 1)), hasTotalCol(n) ? level + 2 : 0)
      : level + 1;

  const topCols = cube.columnRoot.children;
  const showGrandCol = opts.showColumnGrandTotals || !topCols.length;
  const depth = Math.max(1, ...topCols.map((c) => depthOf(c, 0)));
  const headerRows: PivotHeaderCell[][] = [];
  for (let i = 0; i < depth; i++) headerRows.push([]);

  const walkCols = (node: PivotNode, level: number) => {
    const expanded = isExpanded(node, opts.columnExpansion);
    if (expanded) {
      headerRows[level].push({
        text: node.text,
        colspan: leafCount(node) * D,
        rowspan: 1,
        type: 'value',
        pathKey: node.pathKey,
        path: node.path,
        expandable: true,
        expanded: true,
      });
      node.children.forEach((c) => walkCols(c, level + 1));
      if (hasTotalCol(node)) {
        headerRows[level + 1].push({
          text: node.text + ' ' + opts.texts.total,
          colspan: D,
          rowspan: depth - level - 1,
          type: 'total',
          pathKey: node.pathKey,
          path: node.path,
          expandable: false,
          expanded: false,
          ...leafSort(node.pathKey),
        });
        leaves.push({ pathKey: node.pathKey, path: node.path, type: 'total' });
      }
    } else {
      headerRows[level].push({
        text: node.text,
        colspan: D,
        rowspan: depth - level,
        type: 'value',
        pathKey: node.pathKey,
        path: node.path,
        expandable: node.children.length > 0,
        expanded: false,
        ...leafSort(node.pathKey),
      });
      leaves.push({ pathKey: node.pathKey, path: node.path, type: 'value' });
    }
  };
  topCols.forEach((c) => walkCols(c, 0));
  if (showGrandCol) {
    headerRows[0].push({
      text: opts.texts.grandTotal,
      colspan: D,
      rowspan: depth,
      type: 'grand',
      pathKey: '',
      path: [],
      expandable: false,
      expanded: false,
      ...leafSort(''),
    });
    leaves.push({ pathKey: '', path: [], type: 'grand' });
  }

  // Linha com os nomes dos campos de dados quando há mais de um
  if (D > 1) {
    headerRows.push(
      leaves.flatMap((l) =>
        cube.dataFields.map((f, d) => ({
          text: f.caption,
          colspan: 1,
          rowspan: 1,
          type: 'data' as const,
          pathKey: l.pathKey,
          path: l.path,
          expandable: false,
          expanded: false,
          dataIndex: d,
          sortOrder: sortOf(l.pathKey, d),
        })),
      ),
    );
  }

  const columns: PivotColumnItem[] = leaves.flatMap((l) =>
    cube.dataFields.map((_, d) => ({ pathKey: l.pathKey, path: l.path, type: l.type, dataIndex: d })),
  );

  return { rows, columns, headerRows, rowHeaderColumns };
}

function grandRow(opts: PivotLayoutOptions, headerColumns: number, tabular: boolean): PivotRowItem {
  const text = opts.texts.grandTotal;
  return {
    node: null, pathKey: '', path: [], level: 0, text, expandable: false, expanded: false, isGrandTotal: true, isTotal: false,
    headers: tabular
      ? [{ text, rowspan: 1, colspan: headerColumns, column: 0, type: 'grand', pathKey: '', path: [], expandable: false, expanded: false }]
      : undefined,
  };
}

function treeRows(cube: PivotCube, opts: PivotLayoutOptions) {
  const rows: PivotRowItem[] = [];
  const walk = (node: PivotNode) => {
    for (const child of node.children) {
      const expanded = isExpanded(child, opts.rowExpansion);
      rows.push({
        node: child,
        pathKey: child.pathKey,
        path: child.path,
        level: child.level,
        text: child.text,
        expandable: child.children.length > 0,
        expanded,
        isGrandTotal: false,
        isTotal: false,
      });
      if (expanded) walk(child);
    }
  };
  walk(cube.rowRoot);
  if (opts.showRowGrandTotals || !rows.length) rows.push(grandRow(opts, 1, false));
  return { rows, rowHeaderColumns: 1 };
}

/**
 * Layout tabular: uma coluna por nível visível. O cabeçalho de um grupo expandido ocupa
 * (rowspan) as linhas dos filhos, e o subtotal vai numa linha própria logo abaixo.
 */
function tabularRows(cube: PivotCube, opts: PivotLayoutOptions) {
  const showTotals = opts.showRowTotals !== false;
  const exp = (n: PivotNode) => isExpanded(n, opts.rowExpansion);

  // Colunas = nível mais profundo visível + 1
  const depthOf = (n: PivotNode): number => (exp(n) ? Math.max(...n.children.map(depthOf)) : n.level + 1);
  const columns = Math.max(1, ...cube.rowRoot.children.map(depthOf));
  // Linhas ocupadas pelos filhos de um grupo expandido (sem a linha de total do próprio grupo)
  const span = (n: PivotNode): number => n.children.reduce((s, c) => s + (exp(c) ? span(c) + (showTotals ? 1 : 0) : 1), 0);

  const rows: PivotRowItem[] = [];
  let pending: PivotRowHeaderCell[] = [];
  const cell = (n: PivotNode, over: Partial<PivotRowHeaderCell>): PivotRowHeaderCell => ({
    text: n.text, rowspan: 1, colspan: 1, column: n.level, type: 'value', pathKey: n.pathKey, path: n.path,
    expandable: n.children.length > 0, expanded: false, ...over,
  });

  const walk = (node: PivotNode) => {
    for (const child of node.children) {
      if (exp(child)) {
        pending.push(cell(child, { rowspan: span(child), expanded: true }));
        walk(child);
        if (showTotals) {
          rows.push({
            node: child, pathKey: child.pathKey, path: child.path, level: child.level,
            text: child.text + ' ' + opts.texts.total, expandable: false, expanded: false, isGrandTotal: false, isTotal: true,
            headers: [cell(child, { text: child.text + ' ' + opts.texts.total, colspan: columns - child.level, type: 'total', expandable: false })],
          });
        }
      } else {
        pending.push(cell(child, { colspan: columns - child.level }));
        rows.push({
          node: child, pathKey: child.pathKey, path: child.path, level: child.level, text: child.text,
          expandable: child.children.length > 0, expanded: false, isGrandTotal: false, isTotal: false,
          headers: pending,
        });
        pending = [];
      }
    }
  };
  walk(cube.rowRoot);
  if (opts.showRowGrandTotals || !rows.length) rows.push(grandRow(opts, columns, true));
  return { rows, rowHeaderColumns: columns };
}

/** Todos os pathKeys expansíveis de uma árvore (para expandir/recolher tudo). */
export function expandablePathKeys(root: PivotNode): string[] {
  const out: string[] = [];
  const walk = (n: PivotNode) =>
    n.children.forEach((c) => {
      if (c.children.length) out.push(c.pathKey);
      walk(c);
    });
  walk(root);
  return out;
}

/** Registros que compõem uma célula (drill down). */
export function drillDown<T>(
  data: T[],
  fields: ResolvedPivotField<T>[],
  cube: PivotCube,
  rowPath: any[],
  columnPath: any[],
): T[] {
  const pass = makeRecordFilter(fields);
  const rk = rowPath.map(valueKey);
  const ck = columnPath.map(valueKey);
  return data.filter(
    (r) =>
      pass(r) &&
      rk.every((k, i) => valueKey(fieldValue(r, cube.rowFields[i])) === k) &&
      ck.every((k, i) => valueKey(fieldValue(r, cube.columnFields[i])) === k),
  );
}

export { PATH_SEP };
