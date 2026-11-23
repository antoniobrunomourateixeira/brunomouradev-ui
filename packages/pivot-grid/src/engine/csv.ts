import type { PivotCube, PivotView } from './types';
import { displayValue, formatDisplay } from './display';

function esc(value: string, sep: string): string {
  return /["\r\n]/.test(value) || value.indexOf(sep) >= 0 ? '"' + value.replace(/"/g, '""') + '"' : value;
}

/** Exporta o que está visível na pivot (cabeçalhos em várias linhas, linhas com recuo). */
export function pivotToCsv(cube: PivotCube, view: PivotView, locale: string, separator = ';'): string {
  const lines: string[] = [];

  // Expande colspan/rowspan dos cabeçalhos para uma matriz
  const width = view.columns.length;
  const matrix: string[][] = view.headerRows.map(() => new Array(width).fill(''));
  const occupied: boolean[][] = view.headerRows.map(() => new Array(width).fill(false));
  view.headerRows.forEach((row, r) => {
    let c = 0;
    for (const cell of row) {
      while (c < width && occupied[r][c]) c++;
      matrix[r][c] = cell.text;
      for (let rr = r; rr < r + cell.rowspan && rr < matrix.length; rr++) {
        for (let cc = c; cc < c + cell.colspan; cc++) occupied[rr][cc] = true;
      }
      c += cell.colspan;
    }
  });
  const H = view.rowHeaderColumns || 1;
  const tabular = view.rows.some((r) => r.headers);
  const corner: string[] = tabular
    ? Array.from({ length: H }, (_, i) => (cube.rowFields[i] ? cube.rowFields[i].caption : ''))
    : [cube.rowFields.map((f) => f.caption).join(' / ')];
  const blankCorner = corner.map(() => '');
  matrix.forEach((row, r) => lines.push((r === 0 ? corner : blankCorner).concat(row).map((v) => esc(v, separator)).join(separator)));

  // No layout tabular o texto dos grupos se repete em cada linha (mais útil numa planilha)
  const carry: string[] = new Array(H).fill('');
  for (const row of view.rows) {
    let label: string[];
    if (tabular) {
      for (const h of row.headers || []) {
        carry[h.column] = h.text;
        for (let k = h.column + 1; k < h.column + h.colspan; k++) carry[k] = '';
      }
      label = carry.slice();
    } else {
      label = ['  '.repeat(row.level) + row.text];
    }
    const values = view.columns.map((col) => {
      const v = displayValue(cube, row.pathKey, col.pathKey, col.dataIndex);
      return formatDisplay(v, cube.dataFields[col.dataIndex], locale);
    });
    lines.push(label.concat(values).map((v) => esc(v, separator)).join(separator));
  }
  return lines.join('\r\n');
}
