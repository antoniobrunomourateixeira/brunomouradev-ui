import type { ResolvedColumn } from './query';
import { formatValue, getCellValue } from './values';

function escapeCsv(value: string, separator: string): string {
  return /["\r\n]/.test(value) || value.indexOf(separator) >= 0 ? '"' + value.replace(/"/g, '""') + '"' : value;
}

/**
 * Gera CSV com os valores formatados das colunas visíveis.
 * O separador padrão é ";" para abrir direto no Excel em pt-BR.
 */
export function toCsv<T>(rows: T[], columns: ResolvedColumn<T>[], locale: string, separator = ';'): string {
  const cols = columns.filter((c) => c.visible);
  const lines = [cols.map((c) => escapeCsv(c.caption, separator)).join(separator)];
  for (const row of rows) {
    lines.push(
      cols
        .map((c) => escapeCsv(formatValue(getCellValue(row, c), c.dataType, c.format, locale, row), separator))
        .join(separator),
    );
  }
  return lines.join('\r\n');
}
