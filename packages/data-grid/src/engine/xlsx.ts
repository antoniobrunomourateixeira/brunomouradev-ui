import type { GroupDescriptor, GroupInfo, SummaryItem, ValueFormat } from './types';
import { computeSummary } from './query';
import type { ResolvedColumn } from './query';
import { buildGroups } from './grouping';
import { formatValue, getCellValue, normalizeFormat, toDate, toNumber } from './values';
import { zipStore } from './zip';

/**
 * Exportação para Excel (.xlsx) sem dependências.
 * Números e datas vão como valores de verdade (somáveis no Excel), com o formato da coluna.
 */

export interface XlsxTexts {
  yes: string;
  no: string;
  /** Valor vazio no título do grupo. */
  blank: string;
  /** "{0} itens" */
  items: string;
  item: string;
  sum: string;
  avg: string;
  min: string;
  max: string;
  count: string;
}

export interface XlsxOptions {
  locale: string;
  /** Nome da aba. Padrão: "Dados". */
  sheetName?: string;
  /** Agrupamento: vira linhas de grupo com recolher/expandir do Excel (estrutura de tópicos). */
  groups?: GroupDescriptor[];
  groupSummary?: SummaryItem[];
  /** Totais na última linha. */
  summary?: SummaryItem[];
  texts?: Partial<XlsxTexts>;
}

const DEFAULT_TEXTS: XlsxTexts = {
  yes: 'Sim',
  no: 'Não',
  blank: '(vazio)',
  items: '{0} itens',
  item: '1 item',
  sum: 'Soma',
  avg: 'Média',
  min: 'Mín',
  max: 'Máx',
  count: 'Qtd',
};

// ------------------------------------------------------------------ helpers

function xmlEscape(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 -> "A", 26 -> "AA" */
export function columnLetter(index: number): string {
  let s = '';
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Data -> número de série do Excel (dias desde 1899-12-30), pelo horário local. */
export function excelDate(d: Date): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

/** Converte as opções do Intl.NumberFormat num formato de número do Excel. */
export function excelNumberFormat(format: ValueFormat | undefined, locale: string): string | null {
  format = normalizeFormat(format, locale);
  if (!format || typeof format === 'function') return null;
  const o = format as Intl.NumberFormatOptions;
  let decimals = o.minimumFractionDigits != null ? o.minimumFractionDigits : o.maximumFractionDigits;
  if (decimals == null && o.style === 'currency' && o.currency) {
    decimals = new Intl.NumberFormat(locale, { style: 'currency', currency: o.currency }).resolvedOptions().maximumFractionDigits;
  }
  if (decimals == null && o.style === 'percent') decimals = 0;
  // Sem estilo e sem casas decimais definidas: deixa o "Geral" do Excel
  if (decimals == null && !o.style) return null;
  const grouping = o.useGrouping === false ? '0' : '#,##0';
  const base = grouping + (decimals && decimals > 0 ? '.' + '0'.repeat(Math.min(decimals, 10)) : '');
  if (o.style === 'percent') return base + '%';
  if (o.style === 'unit' && (o as any).unit === 'percent') return base + '"%"';
  if (o.style === 'currency' && o.currency) {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: o.currency }).formatToParts(1);
    const ci = parts.findIndex((p) => p.type === 'currency');
    const ii = parts.findIndex((p) => p.type === 'integer');
    const symbol = '"' + parts[ci].value.replace(/"/g, '') + '"';
    const before = ci < ii;
    const gap = parts.some((p, i) => p.type === 'literal' && i > Math.min(ci, ii) && i < Math.max(ci, ii)) ? ' ' : '';
    const pos = before ? symbol + gap + base : base + gap + symbol;
    return pos + ';-' + pos;
  }
  return base;
}

/** Registro de estilos (cellXfs). Cada combinação vira um índice. */
class StyleSheet {
  private numFmts: string[] = [];
  private xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private map = new Map<string, number>();

  /** fill: 0 nenhum, 2 cabeçalho, 3 grupo. border: 0 nenhuma, 1 linha embaixo, 2 linha em cima. */
  get(opts: { numFmt?: string | number | null; bold?: boolean; fill?: 0 | 2 | 3; border?: 0 | 1 | 2; indent?: number; wrap?: boolean; align?: 'left' | 'center' | 'right' }): number {
    const key = JSON.stringify(opts);
    const hit = this.map.get(key);
    if (hit != null) return hit;
    let numFmtId = 0;
    if (typeof opts.numFmt === 'number') numFmtId = opts.numFmt;
    else if (opts.numFmt) {
      let i = this.numFmts.indexOf(opts.numFmt);
      if (i < 0) i = this.numFmts.push(opts.numFmt) - 1;
      numFmtId = 164 + i;
    }
    const align = opts.indent || opts.wrap || opts.align
      ? `<alignment${opts.align ? ` horizontal="${opts.align}"` : ''}${opts.indent ? ` indent="${opts.indent}"` : ''}${opts.wrap ? ' wrapText="1" vertical="top"' : ''}/>`
      : '';
    const xf =
      `<xf numFmtId="${numFmtId}" fontId="${opts.bold ? 1 : 0}" fillId="${opts.fill || 0}" borderId="${opts.border || 0}" xfId="0"` +
      `${numFmtId ? ' applyNumberFormat="1"' : ''}${opts.bold ? ' applyFont="1"' : ''}${opts.fill ? ' applyFill="1"' : ''}` +
      `${opts.border ? ' applyBorder="1"' : ''}${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`;
    const idx = this.xfs.push(xf) - 1;
    this.map.set(key, idx);
    return idx;
  }

  xml(): string {
    const fmts = this.numFmts.length
      ? `<numFmts count="${this.numFmts.length}">${this.numFmts
          .map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xmlEscape(f)}"/>`)
          .join('')}</numFmts>`
      : '';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      fmts +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F6"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE6ECF5"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"><color rgb="FFBFC6CE"/></bottom><diagonal/></border>' +
      '<border><left/><right/><top style="thin"><color rgb="FFBFC6CE"/></top><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  }
}

function sheetNameOf(name: string | undefined): string {
  const clean = (name || 'Dados').replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return clean || 'Dados';
}

// ------------------------------------------------------------------ planilha

/**
 * Gera o arquivo .xlsx (bytes) com as linhas e colunas informadas.
 * Use as colunas visíveis na ordem da tela; colunas agrupadas saem da tabela
 * e viram linhas de grupo.
 */
export function toXlsx<T>(rows: T[], columns: ResolvedColumn<T>[], options: XlsxOptions): Uint8Array {
  const texts = { ...DEFAULT_TEXTS, ...(options.texts || {}) };
  const locale = options.locale;
  const groups = (options.groups || []).filter((g) => columns.some((c) => c.dataField === g.field));
  const groupedFields = new Set(groups.map((g) => g.field));
  const cols = columns.filter((c) => c.visible && !groupedFields.has(c.dataField));
  const depth = groups.length;
  const styles = new StyleSheet();
  const captions: Record<string, string> = { sum: texts.sum, avg: texts.avg, min: texts.min, max: texts.max, count: texts.count };

  const colFmt = cols.map((c) => {
    if (typeof c.format === 'function') return null;
    if (c.dataType === 'number') return excelNumberFormat(c.format, locale);
    if (c.dataType === 'date') {
      const o = (normalizeFormat(c.format, locale) || {}) as Intl.DateTimeFormatOptions;
      if (o.hour != null && o.day == null) return 20;
      return o.hour != null || o.timeStyle != null ? 22 : 14;
    }
    return null;
  });
  const sHeader = styles.get({ bold: true, fill: 2, border: 1 });
  const sData = colFmt.map((f) => styles.get({ numFmt: f }));
  const widths = cols.map((c) => Math.max(8, c.caption.length + 3));

  const lines: string[] = [];
  let r = 0;

  type Cell = { kind: 'n'; v: number; s: number } | { kind: 's'; v: string; s: number } | null;
  const writeRow = (cells: Cell[], attrs = '') => {
    r++;
    const xs: string[] = [];
    cells.forEach((cell, i) => {
      if (!cell) return;
      const ref = columnLetter(i) + r;
      const s = cell.s ? ` s="${cell.s}"` : '';
      if (cell.kind === 'n') xs.push(`<c r="${ref}"${s}><v>${cell.v}</v></c>`);
      else if (cell.v !== '') xs.push(`<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.v)}</t></is></c>`);
      else if (cell.s) xs.push(`<c r="${ref}"${s}/>`);
    });
    lines.push(`<row r="${r}"${attrs}>${xs.join('')}</row>`);
  };

  const dataCell = (row: T, i: number, measure: boolean): Cell => {
    const col = cols[i];
    const value = getCellValue(row, col);
    if (value == null || value === '') return null;
    if (typeof col.format !== 'function') {
      if (col.dataType === 'number') {
        const n = toNumber(value);
        if (n != null && isFinite(n)) {
          if (measure) widths[i] = Math.max(widths[i], formatValue(n, 'number', col.format, locale).length + 2);
          return { kind: 'n', v: n, s: sData[i] };
        }
      } else if (col.dataType === 'date') {
        const d = toDate(value);
        if (d) {
          if (measure) widths[i] = Math.max(widths[i], colFmt[i] === 22 ? 17 : 12);
          return { kind: 'n', v: excelDate(d), s: sData[i] };
        }
      }
    }
    const text = formatValue(value, col.dataType, col.format, locale, row, texts);
    if (measure) widths[i] = Math.max(widths[i], Math.min(text.length + 2, 60));
    return { kind: 's', v: text, s: 0 };
  };

  // Cabeçalho
  writeRow(cols.map((c) => ({ kind: 's', v: c.caption, s: sHeader })));

  // Corpo
  let measured = 0;
  const writeData = (list: T[]) => {
    const attrs = depth ? ` outlineLevel="${depth}"` : '';
    for (const row of list) {
      writeRow(cols.map((_, i) => dataCell(row, i, measured < 500)), attrs);
      measured++;
    }
  };

  if (depth) {
    const aligned = (options.groupSummary || []).filter((s) => s.alignByColumn && cols.some((c) => c.dataField === (s.showInColumn || s.column)));
    const inline = (options.groupSummary || []).filter((s) => aligned.indexOf(s) < 0);
    const tree = buildGroups(rows, groups, columns);
    const walk = (list: GroupInfo<T>[]) => {
      for (const g of list) {
        const col = columns.find((c) => c.dataField === g.field)!;
        const valueText = formatValue(g.value, col.dataType, col.format, locale, g.rows[0], texts) || texts.blank;
        const meta = inline.length
          ? inline
              .map((it) => computeSummary(g.rows, it, columns, locale, captions).text)
              .filter((t) => t)
              .join(', ')
          : g.rows.length === 1
            ? texts.item
            : texts.items.replace('{0}', String(g.rows.length));
        const cells: Cell[] = cols.map(() => null);
        cells[0] = { kind: 's', v: `${col.caption}: ${valueText}${meta ? ' (' + meta + ')' : ''}`, s: styles.get({ bold: true, fill: 3, indent: g.level }) };
        cols.forEach((c, i) => {
          if (i === 0) return;
          const items = aligned.filter((s) => (s.showInColumn || s.column) === c.dataField);
          if (items.length === 1) {
            const res = computeSummary(g.rows, items[0], columns, locale, captions);
            const fmt = items[0].summaryType === 'count' ? null : items[0].valueFormat ? excelNumberFormat(items[0].valueFormat, locale) : colFmt[i];
            cells[i] = res.value == null ? { kind: 's', v: '', s: styles.get({ bold: true, fill: 3 }) } : { kind: 'n', v: res.value, s: styles.get({ numFmt: fmt, bold: true, fill: 3 }) };
          } else if (items.length > 1) {
            const t = items.map((it) => computeSummary(g.rows, it, columns, locale, captions).text).join(' · ');
            cells[i] = { kind: 's', v: t, s: styles.get({ bold: true, fill: 3 }) };
          } else {
            cells[i] = { kind: 's', v: '', s: styles.get({ bold: true, fill: 3 }) };
          }
        });
        writeRow(cells, g.level ? ` outlineLevel="${g.level}"` : '');
        if (g.children) walk(g.children);
        else writeData(g.rows);
      }
    };
    walk(tree);
  } else {
    writeData(rows);
  }
  const lastDataRow = r;

  // Totais
  const summary = options.summary || [];
  if (summary.length) {
    const cells: Cell[] = cols.map((c) => {
      const items = summary.filter((s) => (s.showInColumn || s.column) === c.dataField);
      const sBold = styles.get({ bold: true, border: 2 });
      if (!items.length) return { kind: 's', v: '', s: sBold };
      const results = items.map((it) => computeSummary(rows, it, columns, locale, captions));
      if (results.length === 1 && results[0].value != null) {
        const it = items[0];
        const src = columns.find((x) => x.dataField === it.column);
        const isDate = !!src && src.dataType === 'date' && (it.summaryType === 'min' || it.summaryType === 'max');
        const fmt = it.summaryType === 'count' ? null : isDate ? 14 : it.valueFormat ? excelNumberFormat(it.valueFormat, locale) : src ? excelNumberFormat(src.format, locale) : null;
        const v = isDate ? excelDate(new Date(results[0].value)) : results[0].value;
        return { kind: 'n', v, s: styles.get({ numFmt: fmt, bold: true, border: 2 }) };
      }
      return { kind: 's', v: results.map((x) => x.text).filter((t) => t).join('\n'), s: styles.get({ bold: true, border: 2, wrap: true }) };
    });
    writeRow(cells);
  }

  const lastCol = columnLetter(Math.max(0, cols.length - 1));
  const sheetName = sheetNameOf(options.sheetName);
  const useFilter = !depth && cols.length > 0;
  const colsXml = cols
    .map((c, i) => {
      const w = typeof c.width === 'number' ? Math.max(c.width / 7, widths[i] * 0.6) : widths[i];
      return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(80, Math.round(w * 10) / 10)}" customWidth="1"/>`;
    })
    .join('');

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    (depth ? '<sheetPr><outlinePr summaryBelow="0"/></sheetPr>' : '') +
    `<dimension ref="A1:${lastCol}${Math.max(1, r)}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<sheetFormatPr defaultRowHeight="15"${depth ? ` outlineLevelRow="${depth}"` : ''}/>` +
    (colsXml ? `<cols>${colsXml}</cols>` : '') +
    `<sheetData>${lines.join('')}</sheetData>` +
    (useFilter ? `<autoFilter ref="A1:${lastCol}${lastDataRow}"/>` : '') +
    '</worksheet>';

  return packageXlsx(sheetName, sheet, styles.xml(), useFilter ? `$A$1:$${lastCol}$${lastDataRow}` : null);
}

/** Monta o pacote .xlsx (zip) com uma aba. `filterRange` = intervalo do autofiltro ($A$1:$F$10). */
function packageXlsx(sheetName: string, sheet: string, stylesXml: string, filterRange: string | null): Uint8Array {
  const quoted = "'" + sheetName.replace(/'/g, "''") + "'";
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    (filterRange
      ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${xmlEscape(quoted)}!${filterRange}</definedName></definedNames>`
      : '') +
    '</workbook>';
  const enc = new TextEncoder();
  return zipStore([
    {
      name: '[Content_Types].xml',
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '</Types>',
      ),
    },
    {
      name: '_rels/.rels',
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
      ),
    },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '</Relationships>',
      ),
    },
    { name: 'xl/styles.xml', data: enc.encode(stylesXml) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) },
  ]);
}


// ------------------------------------------------------------------ planilha genérica

/** Uma célula de `writeXlsx`. Número vira número de verdade; texto vira texto. */
export interface XlsxCell {
  v: string | number | null | undefined;
  /** Formato do número (código do Excel, ex.: '#,##0.00' ou '0.0%'), ou id interno (14 = data). */
  numFmt?: string | number | null;
  bold?: boolean;
  /** 0 nenhum, 2 cinza (cabeçalho), 3 azulado (grupo/total). */
  fill?: 0 | 2 | 3;
  /** 0 nenhuma, 1 linha embaixo, 2 linha em cima. */
  border?: 0 | 1 | 2;
  indent?: number;
  wrap?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface XlsxSheet {
  /** Nome da aba. Padrão: "Dados". */
  name?: string;
  /** Linhas da planilha; `null` = célula vazia. */
  rows: (XlsxCell | null)[][];
  /** Largura de cada coluna (em caracteres). Sem ela, calcula pelo conteúdo. */
  colWidths?: number[];
  /** Linhas/colunas congeladas no topo/à esquerda. */
  freezeRows?: number;
  freezeCols?: number;
  /** Células mescladas (índices a partir de 0). */
  merges?: { row: number; col: number; rowspan: number; colspan: number }[];
  /** Nível de tópico por linha (agrupar/recolher no Excel). */
  outlineLevels?: number[];
  /** Autofiltro na primeira linha até a linha `autoFilterRows` (índice, a partir de 0). */
  autoFilterRows?: number;
}

/** Gera um .xlsx a partir de uma matriz de células (usado pelo PivotGrid e pelo TreeList). */
export function writeXlsx(spec: XlsxSheet): Uint8Array {
  const styles = new StyleSheet();
  const width = spec.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const auto = new Array(width).fill(8);
  const lines: string[] = [];
  const outline = spec.outlineLevels || [];
  let maxLevel = 0;
  spec.rows.forEach((row, ri) => {
    const r = ri + 1;
    const xs: string[] = [];
    row.forEach((cell, ci) => {
      if (!cell) return;
      const ref = columnLetter(ci) + r;
      const sIdx = styles.get({ numFmt: cell.numFmt, bold: cell.bold, fill: cell.fill, border: cell.border, indent: cell.indent, wrap: cell.wrap, align: cell.align });
      const sAttr = sIdx ? ` s="${sIdx}"` : '';
      if (typeof cell.v === 'number' && isFinite(cell.v)) {
        xs.push(`<c r="${ref}"${sAttr}><v>${cell.v}</v></c>`);
        auto[ci] = Math.max(auto[ci], String(Math.round(cell.v)).length + 6);
      } else if (cell.v != null && cell.v !== '') {
        const t = String(cell.v);
        xs.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(t)}</t></is></c>`);
        auto[ci] = Math.max(auto[ci], Math.min(60, t.length + 2 + (cell.indent || 0) * 2));
      } else if (sIdx) {
        xs.push(`<c r="${ref}"${sAttr}/>`);
      }
    });
    const lvl = outline[ri] || 0;
    if (lvl > maxLevel) maxLevel = lvl;
    lines.push(`<row r="${r}"${lvl ? ` outlineLevel="${lvl}"` : ''}>${xs.join('')}</row>`);
  });
  const lastCol = columnLetter(Math.max(0, width - 1));
  const fr = spec.freezeRows || 0;
  const fc = spec.freezeCols || 0;
  const pane =
    fr || fc
      ? `<pane${fc ? ` xSplit="${fc}"` : ''}${fr ? ` ySplit="${fr}"` : ''} topLeftCell="${columnLetter(fc)}${fr + 1}" activePane="${fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight'}" state="frozen"/>`
      : '';
  const colsXml = auto
    .map((w, i) => {
      const cw = spec.colWidths && spec.colWidths[i] != null ? spec.colWidths[i] : w;
      return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(80, Math.round(cw * 10) / 10)}" customWidth="1"/>`;
    })
    .join('');
  const merges = (spec.merges || []).filter((m) => m.rowspan > 1 || m.colspan > 1);
  const filterRows = spec.autoFilterRows;
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    (maxLevel ? '<sheetPr><outlinePr summaryBelow="0"/></sheetPr>' : '') +
    `<dimension ref="A1:${lastCol}${Math.max(1, spec.rows.length)}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"${maxLevel ? ` outlineLevelRow="${maxLevel}"` : ''}/>` +
    (colsXml ? `<cols>${colsXml}</cols>` : '') +
    `<sheetData>${lines.join('')}</sheetData>` +
    (filterRows != null ? `<autoFilter ref="A1:${lastCol}${filterRows + 1}"/>` : '') +
    (merges.length
      ? `<mergeCells count="${merges.length}">${merges
          .map((m) => `<mergeCell ref="${columnLetter(m.col)}${m.row + 1}:${columnLetter(m.col + m.colspan - 1)}${m.row + m.rowspan}"/>`)
          .join('')}</mergeCells>`
      : '') +
    '</worksheet>';
  return packageXlsx(sheetNameOf(spec.name), sheet, styles.xml(), filterRows != null ? `$A$1:$${lastCol}$${filterRows + 1}` : null);
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
