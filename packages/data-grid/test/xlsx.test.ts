import { describe, expect, it } from 'vitest';
import {
  columnLetter,
  crc32,
  excelDate,
  excelNumberFormat,
  resolveColumns,
  toXlsx,
  unzipStore,
  type ColumnDef,
} from '../src/engine/index';

const data = [
  { id: 1, nome: 'Ana & <Cia>', uf: 'PR', valor: 1234.5, venc: '2026-01-10', pago: true },
  { id: 2, nome: 'Bruno', uf: 'SP', valor: 20, venc: '2026-02-01', pago: false },
  { id: 3, nome: 'Carla', uf: 'PR', valor: null, venc: null, pago: true },
];
const defs: ColumnDef[] = [
  { dataField: 'id', caption: 'Nº' },
  { dataField: 'nome', caption: 'Cliente' },
  { dataField: 'uf', caption: 'UF' },
  { dataField: 'valor', caption: 'Valor', format: { style: 'currency', currency: 'BRL' } },
  { dataField: 'venc', caption: 'Vencimento', dataType: 'date' },
  { dataField: 'pago', caption: 'Pago' },
  { dataField: 'obs', caption: 'Obs', visible: false },
];
const cols = resolveColumns(defs, data);
const sheetOf = (bytes: Uint8Array) => unzipStore(bytes)['xl/worksheets/sheet1.xml'];
const rowsOf = (xml: string) => xml.match(/<row [^>]*>.*?<\/row>/g) || [];

describe('exportação Excel', () => {
  it('zip: CRC32 padrão e as partes do pacote', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
    const files = unzipStore(toXlsx(data, cols, { locale: 'pt-BR' }));
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(files['xl/workbook.xml']).toContain('<sheet name="Dados"');
  });

  it('auxiliares: letra da coluna, data serial e formato de moeda', () => {
    expect([0, 25, 26, 701, 702].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
    expect(excelDate(new Date(2026, 0, 10))).toBe(46032);
    expect(excelDate(new Date(2026, 0, 10, 12))).toBe(46032.5);
    expect(excelNumberFormat({ style: 'currency', currency: 'BRL' }, 'pt-BR')).toBe('"R$" #,##0.00;-"R$" #,##0.00');
    expect(excelNumberFormat({ style: 'percent', minimumFractionDigits: 1 }, 'pt-BR')).toBe('#,##0.0%');
    expect(excelNumberFormat({ maximumFractionDigits: 2 }, 'pt-BR')).toBe('#,##0.00');
    expect(excelNumberFormat(undefined, 'pt-BR')).toBeNull();
  });

  it('cabeçalho + linhas: números e datas como valores, texto escapado, vazios omitidos', () => {
    const xml = sheetOf(toXlsx(data, cols, { locale: 'pt-BR' }));
    const rows = rowsOf(xml);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('>Nº<');
    expect(rows[0]).not.toContain('Obs'); // coluna escondida fica de fora
    expect(rows[1]).toContain('<v>1234.5</v>');
    expect(rows[1]).toContain('<v>46032</v>');
    expect(rows[1]).toContain('Ana &amp; &lt;Cia&gt;');
    expect(rows[1]).toContain('>Sim<');
    expect(rows[3]).not.toMatch(/r="D4"/); // valor nulo: sem célula
    expect(xml).toContain('<autoFilter ref="A1:F4"/>');
    expect(xml).toContain('state="frozen"');
  });

  it('agrupamento: linhas de grupo com nível de tópico e totais alinhados', () => {
    const xml = sheetOf(
      toXlsx([data[0], data[2], data[1]], cols, {
        locale: 'pt-BR',
        groups: [{ field: 'uf', order: 'asc' }],
        groupSummary: [{ column: 'valor', summaryType: 'sum', alignByColumn: true }],
      }),
    );
    const rows = rowsOf(xml);
    expect(rows[0]).not.toContain('>UF<'); // coluna agrupada sai da tabela
    expect(rows[1]).toContain('UF: PR (2 itens)');
    expect(rows[1]).toContain('<v>1234.5</v>');
    expect(rows[2]).toContain('outlineLevel="1"');
    expect(rows[4]).toContain('UF: SP (1 item)');
    expect(xml).toContain('outlineLevelRow="1"');
    expect(xml).not.toContain('<autoFilter');
  });

  it('totais na última linha como número com o formato da coluna', () => {
    const files = unzipStore(
      toXlsx(data, cols, {
        locale: 'pt-BR',
        summary: [
          { column: 'valor', summaryType: 'sum' },
          { column: 'id', summaryType: 'count' },
        ],
      }),
    );
    const rows = rowsOf(files['xl/worksheets/sheet1.xml']);
    const last = rows[rows.length - 1];
    expect(last).toContain('<v>1254.5</v>');
    expect(last).toContain('<v>3</v>');
    expect(files['xl/styles.xml']).toContain('formatCode="&quot;R$&quot; #,##0.00;-&quot;R$&quot; #,##0.00"');
    // o autofiltro não inclui a linha de totais
    expect(files['xl/worksheets/sheet1.xml']).toContain('<autoFilter ref="A1:F4"/>');
  });
});
