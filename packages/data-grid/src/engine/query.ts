import type {
  ColumnDef,
  DataType,
  FilterDescriptor,
  FilterOperation,
  QueryResult,
  QueryState,
  SortDescriptor,
  SummaryItem,
  SummaryResult,
} from './types';
import { comparable, formatValue, getCellValue, humanize, inferDataType, shortcutDataType, toDate, toNumber } from './values';
import { buildGroups, flattenGroups, groupSorts, paginateItems } from './grouping';
import { applyHeaderFilters } from './header-filter';

export type ResolvedColumn<T = any> = ColumnDef<T> & {
  caption: string;
  dataType: DataType;
  visible: boolean;
  allowSorting: boolean;
  allowFiltering: boolean;
  allowSearch: boolean;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Completa as colunas com valores padrão. Sem colunas, gera a partir da primeira linha. */
export function resolveColumns<T>(columns: ColumnDef<T>[] | undefined, data: T[]): ResolvedColumn<T>[] {
  const defs: ColumnDef<T>[] =
    columns && columns.length
      ? columns
      : Object.keys((data[0] as any) || {}).map((dataField) => ({ dataField }));

  const sample = data.slice(0, 20);
  return defs.map((col) => {
    let dataType = col.dataType || shortcutDataType(col.format);
    if (!dataType) {
      const first = sample.map((r) => getCellValue(r, col)).find((v) => v != null && v !== '');
      dataType = typeof first === 'string' && ISO_DATE.test(first) ? 'date' : inferDataType(first);
    }
    return {
      ...col,
      caption: col.caption != null ? col.caption : humanize(col.dataField),
      dataType,
      alignment: col.alignment || (dataType === 'number' ? 'right' : dataType === 'boolean' ? 'center' : 'left'),
      visible: col.visible !== false,
      allowSorting: col.allowSorting !== false,
      allowFiltering: col.allowFiltering !== false,
      allowSearch: col.allowSearch !== false,
    };
  });
}

/** Remove acentos e caixa para comparação de texto. */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Converte "1.234,56" ou "1234.56" em número. */
export function parseLocaleNumber(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const normalized = t.indexOf(',') >= 0 ? t.replace(/\./g, '').replace(',', '.') : t;
  return toNumber(normalized);
}

const pad = (n: number) => (n < 10 ? '0' : '') + n;
const isoDay = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

/**
 * Período digitado: "2026" (ano), "05/2026" ou "2026-05" (mês), "10/05/2026" ou "2026-05-10" (dia).
 * Em inglês dos EUA a ordem é mês/dia. Devolve o primeiro e o último dia ("AAAA-MM-DD").
 */
export function parseDatePeriod(text: string, locale = 'pt-BR'): { from: string; to: string } | null {
  const s = text.trim();
  if (!s) return null;
  const mdy = /^en-US$/i.test(locale);
  let y: number;
  let m: number | undefined;
  let d: number | undefined;
  let r: RegExpExecArray | null;
  if ((r = /^(\d{4})$/.exec(s))) y = +r[1];
  else if ((r = /^(\d{4})-(\d{1,2})$/.exec(s))) (y = +r[1]), (m = +r[2]);
  else if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s))) (y = +r[1]), (m = +r[2]), (d = +r[3]);
  else if ((r = /^(\d{1,2})[/.-](\d{4})$/.exec(s))) (m = +r[1]), (y = +r[2]);
  else if ((r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) {
    y = r[3].length === 2 ? 2000 + +r[3] : +r[3];
    m = mdy ? +r[1] : +r[2];
    d = mdy ? +r[2] : +r[1];
  } else {
    const dt = toDate(s);
    if (!dt) return null;
    return { from: isoDay(dt), to: isoDay(dt) };
  }
  if (m != null && (m < 1 || m > 12)) return null;
  if (m == null) return { from: y + '-01-01', to: y + '-12-31' };
  if (d == null) return { from: isoDay(new Date(y, m - 1, 1)), to: isoDay(new Date(y, m, 0)) };
  const one = new Date(y, m - 1, d);
  if (one.getMonth() !== m - 1) return null;
  return { from: isoDay(one), to: isoDay(one) };
}

/**
 * Interpreta o texto digitado no filter row.
 * - Números: operador como prefixo (">100", "<=50", "<>0") e intervalo "10..50".
 * - Datas: dia, mês ou ano ("10/05/2026", "05/2026", "2026"), com operador (">05/2026" = depois de maio)
 *   e intervalo "01/05/2026..15/05/2026".
 * - Texto: usa a operação padrão (contém).
 */
export function parseFilterInput(
  text: string,
  dataType: DataType,
  defaultOperation?: FilterOperation,
  locale = 'pt-BR',
): { operation: FilterOperation; value: any } | null {
  const raw = text.trim();
  if (!raw) return null;

  if (dataType === 'number') {
    const range = raw.split('..');
    if (range.length === 2 || defaultOperation === 'between') {
      const a = parseLocaleNumber(range[0] || '');
      const b = range.length === 2 ? parseLocaleNumber(range[1] || '') : null;
      if (a == null && b == null) return null;
      return { operation: 'between', value: [a, b] };
    }
    const m = /^(>=|<=|<>|!=|>|<|=)?\s*(.*)$/.exec(raw);
    const op = (m && m[1]) || '';
    const value = parseLocaleNumber((m && m[2]) || '');
    if (value == null) return null;
    const operation = (op === '!=' ? '<>' : op || defaultOperation || '=') as FilterOperation;
    return { operation, value };
  }
  if (dataType === 'date') {
    const range = raw.split('..');
    if (range.length === 2 || defaultOperation === 'between') {
      const a = range[0].trim() ? parseDatePeriod(range[0], locale) : null;
      const b = range.length === 2 && range[1].trim() ? parseDatePeriod(range[1], locale) : null;
      if (!a && !b) return null;
      return { operation: 'between', value: [a ? a.from : null, b ? b.to : a && range.length < 2 ? a.to : null] };
    }
    const m = /^(>=|<=|<>|!=|>|<|=)?\s*(.*)$/.exec(raw);
    const op = ((m && m[1]) === '!=' ? '<>' : (m && m[1]) || defaultOperation || '=') as FilterOperation;
    const p = parseDatePeriod((m && m[2]) || '', locale);
    if (!p) return null;
    const single = p.from === p.to;
    switch (op) {
      case '=':
        return single ? { operation: '=', value: p.from } : { operation: 'between', value: [p.from, p.to] };
      case '<':
        return { operation: '<', value: p.from };
      case '<=':
        return { operation: '<=', value: p.to };
      case '>':
        return { operation: '>', value: p.to };
      case '>=':
        return { operation: '>=', value: p.from };
      case '<>':
        return single ? { operation: '<>', value: p.from } : { operation: 'notbetween', value: [p.from, p.to] };
      default:
        return { operation: op, value: p.from };
    }
  }
  if (dataType === 'boolean') {
    return { operation: '=', value: raw === 'true' };
  }
  return { operation: defaultOperation || 'contains', value: raw };
}

function startOfDay(value: any): number | null {
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(+value.slice(0, 4), +value.slice(5, 7) - 1, +value.slice(8, 10))
    : toDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function matchFilter(cell: any, filter: FilterDescriptor, col: ResolvedColumn): boolean {
  const { operation, value } = filter;

  if (col.dataType === 'string') {
    const a = cell == null ? '' : foldText(String(cell));
    const b = value == null ? '' : foldText(String(value));
    switch (operation) {
      case 'contains': return a.indexOf(b) >= 0;
      case 'notcontains': return a.indexOf(b) < 0;
      case 'startswith': return a.startsWith(b);
      case 'endswith': return a.endsWith(b);
      case '=': return a === b;
      case '<>': return a !== b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '>=': return a >= b;
    }
  }

  if (operation === 'between' || operation === 'notbetween') {
    const [lo, hi] = Array.isArray(value) ? value : [value, null];
    const key = (x: any) => (col.dataType === 'date' ? startOfDay(x) : comparable(x, col.dataType));
    const a0 = key(cell);
    const l = lo == null || lo === '' ? null : key(lo);
    const h = hi == null || hi === '' ? null : key(hi);
    if (l == null && h == null) return true;
    const inside = a0 != null && (l == null || a0 >= l) && (h == null || a0 <= h);
    return operation === 'between' ? inside : !inside;
  }

  // Datas são comparadas pelo dia (ignora horário).
  const a = col.dataType === 'date' ? startOfDay(cell) : comparable(cell, col.dataType);
  const b = col.dataType === 'date' ? startOfDay(value) : comparable(value, col.dataType);
  if (b == null) return true;
  if (a == null) return operation === '<>';
  switch (operation) {
    case '=': return a === b;
    case '<>': return a !== b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    case 'contains': return String(a).indexOf(String(b)) >= 0;
    case 'notcontains': return String(a).indexOf(String(b)) < 0;
    case 'startswith': return String(a).startsWith(String(b));
    case 'endswith': return String(a).endsWith(String(b));
  }
}

export function applyFilters<T>(rows: T[], filters: FilterDescriptor[], columns: ResolvedColumn<T>[]): T[] {
  const active = filters
    .map((f) => ({ f, col: columns.find((c) => c.dataField === f.field) }))
    .filter((x): x is { f: FilterDescriptor; col: ResolvedColumn<T> } => !!x.col && x.f.value != null && x.f.value !== '');
  if (!active.length) return rows;
  return rows.filter((row) => active.every(({ f, col }) => matchFilter(getCellValue(row, col), f, col)));
}

/** Busca global: procura o texto no valor formatado de cada coluna visível. */
export function applySearch<T>(rows: T[], text: string, columns: ResolvedColumn<T>[], locale: string): T[] {
  const needle = foldText(text.trim());
  if (!needle) return rows;
  const cols = columns.filter((c) => c.visible && c.allowSearch);
  return rows.filter((row) =>
    cols.some((col) => {
      const v = getCellValue(row, col);
      const txt = formatValue(v, col.dataType, col.format, locale, row);
      return foldText(txt).indexOf(needle) >= 0 || (v != null && foldText(String(v)).indexOf(needle) >= 0);
    }),
  );
}

/** Ordenação estável e multi-coluna. Nulos ficam no início em "asc". */
/** `byDay`: campos de data comparados só pelo dia (usado no agrupamento). */
export function applySort<T>(rows: T[], sorts: SortDescriptor[], columns: ResolvedColumn<T>[], locale: string, byDay?: string[]): T[] {
  const active = sorts
    .map((s) => ({ s, col: columns.find((c) => c.dataField === s.field) }))
    .filter((x): x is { s: SortDescriptor; col: ResolvedColumn<T> } => !!x.col);
  if (!active.length) return rows;

  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const keyed = rows.map((row, index) => ({
    row,
    index,
    keys: active.map(({ s, col }) =>
      col.dataType === 'date' && byDay && byDay.indexOf(s.field) >= 0
        ? startOfDay(getCellValue(row, col))
        : comparable(getCellValue(row, col), col.dataType),
    ),
  }));

  keyed.sort((x, y) => {
    for (let i = 0; i < active.length; i++) {
      const a = x.keys[i];
      const b = y.keys[i];
      let cmp = 0;
      if (a == null && b == null) cmp = 0;
      else if (a == null) cmp = -1;
      else if (b == null) cmp = 1;
      else if (typeof a === 'string' && typeof b === 'string') cmp = collator.compare(a, b);
      else cmp = a < b ? -1 : a > b ? 1 : 0;
      if (cmp !== 0) return active[i].s.order === 'desc' ? -cmp : cmp;
    }
    return x.index - y.index;
  });
  return keyed.map((k) => k.row);
}

export function paginate<T>(rows: T[], pageIndex: number, pageSize: number) {
  if (!pageSize || pageSize <= 0) {
    return { pageRows: rows, pageCount: 1, pageIndex: 0 };
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const idx = Math.min(Math.max(0, pageIndex), pageCount - 1);
  return { pageRows: rows.slice(idx * pageSize, idx * pageSize + pageSize), pageCount, pageIndex: idx };
}

/** Pipeline completo: filtro -> busca -> ordenação -> paginação. */
export function query<T>(data: T[], columns: ResolvedColumn<T>[], state: QueryState, locale: string): QueryResult<T> {
  let rows = applyFilters(data, state.filters, columns);
  rows = applyHeaderFilters(rows, state.headerFilters, columns);
  rows = applySearch(rows, state.searchText, columns, locale);
  const groups = (state.groups || []).filter((g) => columns.some((c) => c.dataField === g.field));
  if (groups.length) {
    rows = applySort(rows, groupSorts(groups, state.sorts), columns, locale, groups.map((g) => g.field));
    const tree = buildGroups(rows, groups, columns);
    const items = flattenGroups(tree, state.groupExpansion, groups.length);
    const page = paginateItems(items, state.pageIndex, state.pageSize);
    const pageRows: T[] = [];
    for (const it of page.pageItems) if (it.type === 'data') pageRows.push(it.row);
    return { rows, totalCount: rows.length, pageRows, items: page.pageItems, groups: tree, pageCount: page.pageCount, pageIndex: page.pageIndex };
  }
  rows = applySort(rows, state.sorts, columns, locale);
  const page = paginate(rows, state.pageIndex, state.pageSize);
  return { rows, totalCount: rows.length, ...page };
}

export function computeSummary<T>(
  rows: T[],
  item: SummaryItem,
  columns: ResolvedColumn<T>[],
  locale: string,
  captions: Record<string, string> = {},
): SummaryResult {
  const col = columns.find((c) => c.dataField === item.column);
  let value: number | null = null;

  if (item.summaryType === 'count') {
    value = rows.length;
  } else if (col) {
    const nums: number[] = [];
    for (const r of rows) {
      const raw = getCellValue(r, col);
      const n = col.dataType === 'date' ? (toDate(raw) ? toDate(raw)!.getTime() : null) : toNumber(raw);
      if (n != null) nums.push(n);
    }
    if (nums.length) {
      switch (item.summaryType) {
        case 'sum': value = nums.reduce((a, b) => a + b, 0); break;
        case 'avg': value = nums.reduce((a, b) => a + b, 0) / nums.length; break;
        case 'min': value = Math.min(...nums); break;
        case 'max': value = Math.max(...nums); break;
      }
    }
  }

  let formatted = '';
  if (value != null) {
    const isDate = col && col.dataType === 'date' && (item.summaryType === 'min' || item.summaryType === 'max');
    const fmt = item.valueFormat || (item.summaryType === 'count' ? undefined : col && col.format);
    formatted = formatValue(isDate ? new Date(value) : value, isDate ? 'date' : 'number', fmt, locale);
  }
  const label = captions[item.summaryType] || item.summaryType;
  const display = item.displayFormat != null ? item.displayFormat : label + ': {0}';
  return { ...item, value, text: value == null ? '' : display.replace('{0}', formatted) };
}
