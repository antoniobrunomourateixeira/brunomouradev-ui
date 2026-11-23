import type { DataType, GridRowItem, GroupDescriptor, GroupExpansion, GroupInfo, SortDescriptor } from './types';
import type { ResolvedColumn } from './query';
import { comparable, getCellValue, toDate } from './values';

/**
 * Agrupamento: funções puras usadas por `query()` quando há `groups`.
 * As linhas chegam ordenadas pelos campos de grupo; os grupos são as sequências
 * de linhas com a mesma chave.
 */

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Chave do grupo: texto sem acento/caixa, data pelo dia, vazio = "". */
export function groupKey(value: any, dataType: DataType): string {
  if (value == null || value === '') return '';
  if (dataType === 'date') {
    const d = toDate(value);
    return d ? d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() : String(value);
  }
  if (dataType === 'string') return fold(String(value)).trim();
  const c = comparable(value, dataType);
  return c == null ? '' : String(c);
}

/** Ordenação usada com agrupamento: primeiro os grupos, depois a ordenação do usuário. */
export function groupSorts(groups: GroupDescriptor[], sorts: SortDescriptor[]): SortDescriptor[] {
  return [
    ...groups.map((g) => ({ field: g.field, order: g.order })),
    ...sorts.filter((s) => !groups.some((g) => g.field === s.field)),
  ];
}

/** Monta a árvore de grupos a partir de linhas já ordenadas por `groupSorts`. */
export function buildGroups<T>(rows: T[], groups: GroupDescriptor[], columns: ResolvedColumn<T>[]): GroupInfo<T>[] {
  const cols = groups.map((g) => columns.find((c) => c.dataField === g.field)!);
  const build = (list: T[], level: number, parent: string): GroupInfo<T>[] => {
    const col = cols[level];
    const out: GroupInfo<T>[] = [];
    let cur: GroupInfo<T> | null = null;
    for (const row of list) {
      const value = getCellValue(row, col);
      const key = groupKey(value, col.dataType);
      if (!cur || cur.key !== key) {
        cur = { field: col.dataField, value, key, path: parent + '\u001f' + key, level, rows: [] };
        out.push(cur);
      }
      cur.rows.push(row);
    }
    if (level + 1 < cols.length) out.forEach((g) => (g.children = build(g.rows, level + 1, g.path)));
    return out;
  };
  return cols.length ? build(rows, 0, '') : [];
}

export function isGroupExpanded(expansion: GroupExpansion | undefined, path: string): boolean {
  if (!expansion) return true;
  const o = expansion.overrides[path];
  return o != null ? o : expansion.all;
}

/** Lista na ordem de exibição: cabeçalhos de grupo e, dos grupos expandidos, as linhas. */
export function flattenGroups<T>(groups: GroupInfo<T>[], expansion: GroupExpansion | undefined, depth: number): GridRowItem<T>[] {
  const out: GridRowItem<T>[] = [];
  const walk = (list: GroupInfo<T>[]) => {
    for (const g of list) {
      const expanded = isGroupExpanded(expansion, g.path);
      out.push({ type: 'group', group: g, expanded, continued: false });
      if (!expanded) continue;
      if (g.children) walk(g.children);
      else for (const row of g.rows) out.push({ type: 'data', row, level: depth });
    }
  };
  walk(groups);
  return out;
}

/**
 * Pagina a lista de grupos e linhas. Se a página começa no meio de um grupo,
 * os cabeçalhos dele são repetidos no topo, marcados como `continued`.
 */
export function paginateItems<T>(items: GridRowItem<T>[], pageIndex: number, pageSize: number) {
  if (!pageSize || pageSize <= 0) return { pageItems: items, pageCount: 1, pageIndex: 0 };
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const idx = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const start = idx * pageSize;
  const page = items.slice(start, start + pageSize);
  const first = page[0];
  if (first) {
    let need = first.type === 'data' ? first.level : first.group.level;
    const prefix: GridRowItem<T>[] = [];
    for (let i = start - 1; i >= 0 && need > 0; i--) {
      const it = items[i];
      if (it.type === 'group' && it.group.level < need) {
        prefix.unshift({ ...it, continued: true });
        need = it.group.level;
      }
    }
    page.unshift(...prefix);
  }
  return { pageItems: page, pageCount, pageIndex: idx };
}
