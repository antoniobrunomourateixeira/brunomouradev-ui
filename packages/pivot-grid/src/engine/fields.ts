import { formatValue, getField, humanize, inferDataType, toDate } from '@brunomouradev/data-grid/engine';
import type { PivotField, ResolvedPivotField } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const INTERVAL_CAPTION_PT: Record<string, string> = {
  year: 'Ano',
  quarter: 'Trimestre',
  month: 'Mês',
  day: 'Dia',
  dayOfWeek: 'Dia da semana',
};
const INTERVAL_CAPTION_EN: Record<string, string> = {
  year: 'Year',
  quarter: 'Quarter',
  month: 'Month',
  day: 'Day',
  dayOfWeek: 'Day of week',
};

export function fieldName(f: PivotField): string {
  if (f.name) return f.name;
  const base = f.dataField || 'field';
  return f.groupInterval ? base + '.' + f.groupInterval : base;
}

/** Valor bruto do registro (sem agrupamento). */
export function rawFieldValue(row: any, f: PivotField): any {
  return f.selector ? f.selector(row) : f.dataField ? getField(row, f.dataField) : undefined;
}

/** Valor usado para agrupar (aplica groupInterval). */
export function fieldValue(row: any, f: PivotField): any {
  const raw = rawFieldValue(row, f);
  if (!f.groupInterval) {
    if (f.dataType === 'date') {
      const d = toDate(raw);
      return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null;
    }
    return raw == null || raw === '' ? null : raw;
  }
  const d = toDate(raw);
  if (!d) return null;
  switch (f.groupInterval) {
    case 'year': return d.getFullYear();
    case 'quarter': return Math.floor(d.getMonth() / 3) + 1;
    case 'month': return d.getMonth() + 1;
    case 'day': return d.getDate();
    case 'dayOfWeek': return d.getDay();
  }
}

/** Chave estável de um valor (Date, número, texto...). */
export function valueKey(v: any): string {
  if (v == null) return 'null';
  if (v instanceof Date) return 'd:' + v.getTime();
  return typeof v + ':' + String(v);
}

export const PATH_SEP = '\u0001';

export function pathKeyOf(keys: string[]): string {
  return keys.join(PATH_SEP);
}

export function resolveFields<T>(fields: PivotField<T>[], data: T[], locale: string): ResolvedPivotField<T>[] {
  const sample = data.slice(0, 20);
  const pt = /^pt/i.test(locale);
  return fields.map((f) => {
    let dataType = f.dataType;
    if (!dataType) {
      if (f.groupInterval) dataType = 'number';
      else {
        const first = sample.map((r) => rawFieldValue(r, f)).find((v) => v != null && v !== '');
        dataType = typeof first === 'string' && ISO_DATE.test(first) ? 'date' : inferDataType(first);
      }
    }
    let caption = f.caption;
    if (caption == null) {
      const base = f.dataField ? humanize(f.dataField) : fieldName(f);
      caption = f.groupInterval ? base + ' (' + (pt ? INTERVAL_CAPTION_PT : INTERVAL_CAPTION_EN)[f.groupInterval] + ')' : base;
    }
    return {
      ...f,
      name: fieldName(f),
      caption,
      dataType,
      summaryType: f.summaryType || (dataType === 'number' && !f.groupInterval ? 'sum' : 'count'),
      sortOrder: f.sortOrder || 'asc',
    };
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Texto exibido para um valor de linha/coluna. */
export function fieldText(value: any, f: ResolvedPivotField, locale: string, blank: string): string {
  if (typeof f.format === 'function') return f.format(value, null);
  if (value == null) return blank;
  switch (f.groupInterval) {
    case 'year':
    case 'day':
      return String(value);
    case 'quarter':
      return (/^pt/i.test(locale) ? 'T' : 'Q') + value;
    case 'month':
      return capitalize(new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, value - 1, 1)));
    case 'dayOfWeek':
      // 2 de janeiro de 2000 foi domingo
      return capitalize(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2000, 0, 2 + value)));
  }
  return formatValue(value, f.dataType, f.format, locale, null);
}

/** Valores distintos de um campo (para o filtro), já ordenados. */
export function distinctValues<T>(data: T[], f: ResolvedPivotField<T>, locale: string): any[] {
  const map = new Map<string, any>();
  for (const r of data) {
    const v = fieldValue(r, f);
    const k = valueKey(v);
    if (!map.has(k)) map.set(k, v);
  }
  return sortValues(Array.from(map.values()), f.sortOrder, locale);
}

export function compareValues(a: any, b: any, collator: Intl.Collator): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // vazios sempre no fim
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  return collator.compare(String(a), String(b));
}

export function sortValues(values: any[], order: 'asc' | 'desc', locale: string): any[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return values.slice().sort((a, b) => {
    if (a == null || b == null) return compareValues(a, b, collator);
    const c = compareValues(a, b, collator);
    return order === 'desc' ? -c : c;
  });
}
