import type { HeaderFilter, HeaderFilterItem } from './types';
import type { ResolvedColumn } from './query';
import { groupKey } from './grouping';
import { comparable, formatValue, getCellValue } from './values';
import type { FormatTexts } from './values';

/**
 * Filtro do cabeçalho (lista de valores, como no Excel). Os valores são comparados
 * pela chave normalizada: texto sem acento/caixa, data pelo dia, vazio = "".
 */

/** Chave do filtro do cabeçalho para um valor da coluna. */
export function headerFilterKey<T>(value: any, col: ResolvedColumn<T>): string {
  return groupKey(value, col.dataType);
}

export function applyHeaderFilters<T>(rows: T[], filters: HeaderFilter[] | undefined, columns: ResolvedColumn<T>[]): T[] {
  const active = (filters || [])
    .map((f) => ({ f, col: columns.find((c) => c.dataField === f.field), set: new Set(f.values) }))
    .filter((x) => !!x.col && (x.f.type === 'exclude' ? x.set.size > 0 : true)) as {
    f: HeaderFilter;
    col: ResolvedColumn<T>;
    set: Set<string>;
  }[];
  if (!active.length) return rows;
  return rows.filter((row) =>
    active.every(({ f, col, set }) => {
      const has = set.has(headerFilterKey(getCellValue(row, col), col));
      return f.type === 'exclude' ? !has : has;
    }),
  );
}

/**
 * Valores distintos da coluna, com a quantidade de linhas de cada um.
 * Ordem: vazio primeiro, depois crescente (texto pelo idioma, números e datas pelo valor).
 */
export function headerFilterItems<T>(
  rows: T[],
  col: ResolvedColumn<T>,
  locale: string,
  texts: FormatTexts & { blank: string },
): HeaderFilterItem[] {
  const map = new Map<string, HeaderFilterItem & { sort: number | string | null }>();
  for (const row of rows) {
    const value = getCellValue(row, col);
    const key = headerFilterKey(value, col);
    const cur = map.get(key);
    if (cur) cur.count++;
    else {
      const text = key === '' ? texts.blank : formatValue(value, col.dataType, col.format, locale, row, texts) || texts.blank;
      map.set(key, { key, text, value, count: 1, sort: key === '' ? null : comparable(value, col.dataType) });
    }
  }
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return Array.from(map.values())
    .sort((a, b) => {
      if (a.sort == null) return b.sort == null ? 0 : -1;
      if (b.sort == null) return 1;
      if (typeof a.sort === 'string' && typeof b.sort === 'string') return collator.compare(a.sort, b.sort);
      return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0;
    })
    .map(({ key, text, value, count }) => ({ key, text, value, count }));
}
