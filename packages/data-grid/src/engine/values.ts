import type { ColumnDef, DataType, FormatShortcut, ValueFormat } from './types';
import { getConfig } from './theme';

/** Tipo de dado que cada atalho de formato implica. */
export function shortcutDataType(format: ValueFormat | undefined): DataType | undefined {
  if (typeof format !== 'string') return undefined;
  return format === 'date' || format === 'datetime' || format === 'time' ? 'date' : 'number';
}

/** Moeda do atalho 'currency': a de configure(), senão BRL no pt-BR e USD nos outros. */
export function defaultCurrency(locale: string): string {
  return getConfig().currency || (/^pt(-BR)?$/i.test(locale) ? 'BRL' : 'USD');
}

/** Troca um atalho ('currency', 'date'...) pelas opções do Intl. Outros formatos voltam iguais. */
export function normalizeFormat(
  format: ValueFormat | undefined,
  locale: string,
): Exclude<ValueFormat, FormatShortcut> | undefined {
  if (typeof format !== 'string') return format;
  switch (format) {
    case 'currency':
      return { style: 'currency', currency: defaultCurrency(locale) };
    case 'number':
      return { maximumFractionDigits: 2 };
    case 'integer':
      return { useGrouping: false, maximumFractionDigits: 0 };
    case 'percent':
      return { style: 'unit', unit: 'percent', maximumFractionDigits: 2 } as Intl.NumberFormatOptions;
    case 'date':
      return { day: '2-digit', month: '2-digit', year: 'numeric' };
    case 'datetime':
      return { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    case 'time':
      return { hour: '2-digit', minute: '2-digit' };
    default:
      return undefined;
  }
}

/** Lê um campo, aceitando caminho aninhado ("a.b.c"). */
export function getField(row: any, path: string): any {
  if (row == null) return undefined;
  if (path.indexOf('.') < 0) return row[path];
  let cur = row;
  for (const part of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function getCellValue(row: any, column: ColumnDef): any {
  return column.calculateCellValue ? column.calculateCellValue(row) : getField(row, column.dataField);
}

export function inferDataType(value: any): DataType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  return 'string';
}

/** "valorTotal" / "valor_total" -> "Valor Total" */
export function humanize(field: string): string {
  const last = field.split('.').pop() || field;
  return last
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converte string ISO / timestamp em Date. Retorna null se inválido.
 * "AAAA-MM-DD" (sem horário) vira meia-noite LOCAL — `new Date("2026-01-10")`
 * seria meia-noite UTC e, no Brasil, cairia no dia anterior.
 */
export function toDate(value: any): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const m = typeof value === 'string' ? DATE_ONLY.exec(value) : null;
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function toNumber(value: any): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/**
 * Valor normalizado para comparação/ordenação:
 * number -> number, date -> timestamp, boolean -> 0/1, string -> string.
 */
export function comparable(value: any, dataType: DataType): number | string | null {
  if (value == null || value === '') return null;
  switch (dataType) {
    case 'number':
      return toNumber(value);
    case 'date': {
      const d = toDate(value);
      return d ? d.getTime() : null;
    }
    case 'boolean':
      return value ? 1 : 0;
    default:
      return String(value);
  }
}

const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(locale: string, opts?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(opts || {});
  let f = numberFormatCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    numberFormatCache.set(key, f);
  }
  return f;
}

function dateFormatter(locale: string, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(opts || {});
  let f = dateFormatCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, opts);
    dateFormatCache.set(key, f);
  }
  return f;
}

export interface FormatTexts {
  yes: string;
  no: string;
}

/** Texto de exibição de um valor (também usado pela busca e pela exportação). */
export function formatValue(
  value: any,
  dataType: DataType,
  format: ValueFormat | undefined,
  locale: string,
  row?: any,
  texts: FormatTexts = { yes: 'Sim', no: 'Não' },
): string {
  format = normalizeFormat(format, locale);
  if (typeof format === 'function') return format(value, row);
  if (value == null || value === '') return '';
  switch (dataType) {
    case 'number': {
      const n = toNumber(value);
      return n == null ? String(value) : numberFormatter(locale, format as Intl.NumberFormatOptions).format(n);
    }
    case 'date': {
      const d = toDate(value);
      return d ? dateFormatter(locale, format as Intl.DateTimeFormatOptions).format(d) : String(value);
    }
    case 'boolean':
      return value ? texts.yes : texts.no;
    default:
      return String(value);
  }
}
