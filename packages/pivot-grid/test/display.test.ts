import { describe, expect, it } from 'vitest';
import { unzipStore } from '@brunomouradev/data-grid/engine';
import {
  buildCube,
  buildView,
  conditionalStats,
  conditionalStyle,
  displayValue,
  formatDisplay,
  parseColor,
  pathKeyOf,
  pivotToCsv,
  pivotToXlsx,
  resolveFields,
  valueKey,
  type PivotField,
  type PivotLayoutOptions,
} from '../src/engine/index';

const L = 'pt-BR';
// 2 regiões x 3 meses
const dados = [
  { regiao: 'Sul', mes: 1, valor: 100 },
  { regiao: 'Sul', mes: 2, valor: 150 },
  { regiao: 'Sul', mes: 3, valor: 50 },
  { regiao: 'Norte', mes: 1, valor: 300 },
  { regiao: 'Norte', mes: 3, valor: 400 },
  { regiao: 'Leste', mes: 2, valor: 10 },
];
const base = (data: Partial<PivotField> = {}, rows: Partial<PivotField> = {}): PivotField[] => [
  { dataField: 'regiao', area: 'row', ...rows },
  { dataField: 'mes', area: 'column', dataType: 'number' },
  { dataField: 'valor', area: 'data', ...data },
];
const opts: PivotLayoutOptions = {
  rowExpansion: { overrides: {} },
  columnExpansion: { overrides: {} },
  showRowGrandTotals: true,
  showColumnGrandTotals: true,
  showColumnTotals: true,
  texts: { total: 'Total', grandTotal: 'Total Geral' },
};
const cubeOf = (fields: PivotField[]) => buildCube(dados, resolveFields(fields, dados, L), L, '(vazio)');
const k = (...v: any[]) => pathKeyOf(v.map(valueKey));

describe('mostrar valores como', () => {
  it('% do total geral, da linha e da coluna', () => {
    const g = cubeOf(base({ summaryDisplayMode: 'percentOfGrandTotal' })); // total 1010
    expect(displayValue(g, k('Sul'), k(1), 0)).toBeCloseTo(100 / 1010);
    expect(displayValue(g, '', '', 0)).toBe(1);
    const r = cubeOf(base({ summaryDisplayMode: 'percentOfRowTotal' })); // Sul = 300
    expect(displayValue(r, k('Sul'), k(2), 0)).toBeCloseTo(0.5);
    const c = cubeOf(base({ summaryDisplayMode: 'percentOfColumnTotal' })); // mês 1 = 400
    expect(displayValue(c, k('Norte'), k(1), 0)).toBeCloseTo(0.75);
  });

  it('% do grupo pai (linha)', () => {
    const fields: PivotField[] = [
      { dataField: 'regiao', area: 'row' },
      { dataField: 'mes', area: 'row', dataType: 'number' },
      { dataField: 'valor', area: 'data', summaryDisplayMode: 'percentOfParentRow' },
    ];
    const cube = cubeOf(fields);
    expect(displayValue(cube, k('Sul', 2), '', 0)).toBeCloseTo(0.5); // 150 / 300
    expect(displayValue(cube, k('Sul'), '', 0)).toBeCloseTo(300 / 1010); // pai do grupo = total geral
  });

  it('diferença do anterior, % de diferença e acumulado', () => {
    const d = cubeOf(base({ summaryDisplayMode: 'differenceFromPrevious' }));
    expect(displayValue(d, k('Sul'), k(1), 0)).toBeNull(); // primeira coluna
    expect(displayValue(d, k('Sul'), k(2), 0)).toBe(50);
    expect(displayValue(d, k('Sul'), k(3), 0)).toBe(-100);
    expect(displayValue(d, k('Norte'), k(2), 0)).toBeNull(); // sem valor em fev
    const p = cubeOf(base({ summaryDisplayMode: 'percentDifferenceFromPrevious' }));
    expect(displayValue(p, k('Sul'), k(2), 0)).toBeCloseTo(0.5);
    const a = cubeOf(base({ summaryDisplayMode: 'runningTotal' }));
    expect([1, 2, 3].map((m) => displayValue(a, k('Sul'), k(m), 0))).toEqual([100, 250, 300]);
    expect(displayValue(a, k('Norte'), k(2), 0)).toBe(300); // acumulado continua mesmo sem valor no mês
  });

  it('texto em % e o CSV usa o valor exibido', () => {
    const cube = cubeOf(base({ summaryDisplayMode: 'percentOfRowTotal' }));
    expect(formatDisplay(0.5, cube.dataFields[0], L)).toBe('50,0%');
    const csv = pivotToCsv(cube, buildView(cube, opts), L);
    expect(csv).toContain('50,0%');
  });
});

describe('Top N', () => {
  it('mantém só os N maiores e os totais acompanham', () => {
    const cube = cubeOf(base({}, { topN: { count: 2 } }));
    expect(cube.rowRoot.children.map((n) => n.value).sort()).toEqual(['Norte', 'Sul']);
    expect(cube.getValue('', '', 0)).toBe(1000); // sem o Leste (10)
  });

  it('bottom pega os menores', () => {
    const cube = cubeOf(base({}, { topN: { count: 1, bottom: true } }));
    expect(cube.rowRoot.children.map((n) => n.value)).toEqual(['Leste']);
  });
});

describe('formatação condicional', () => {
  it('escala de cores do menor ao maior, sem pintar totais', () => {
    const cube = cubeOf(base({ conditionalFormat: { type: 'colorScale', minColor: '#ffffff', maxColor: '#000000' } }));
    const view = buildView(cube, opts);
    const [stats] = conditionalStats(cube, view);
    expect(stats).toEqual({ min: 10, max: 400, maxAbs: 400 });
    const f = cube.dataFields[0];
    const info = { rowPath: [], columnPath: [], isTotal: false, dataField: 'valor' };
    expect(conditionalStyle(f, 10, stats, info)).toEqual({ 'background-color': 'rgba(255, 255, 255, 1)' });
    expect(conditionalStyle(f, 400, stats, info)).toEqual({ 'background-color': 'rgba(0, 0, 0, 1)' });
    expect(conditionalStyle(f, 400, stats, { ...info, isTotal: true })).toBeNull();
  });

  it('barra de dados proporcional; função recebe a célula', () => {
    const bar = cubeOf(base({ conditionalFormat: { type: 'dataBar', color: 'red' } }));
    const [st] = conditionalStats(bar, buildView(bar, opts));
    const style = conditionalStyle(bar.dataFields[0], 200, st, { rowPath: [], columnPath: [], isTotal: false, dataField: 'valor' });
    expect(style!['background-image']).toBe('linear-gradient(90deg, red 50%, transparent 50%)');
    const fn = cubeOf(base({ conditionalFormat: (v, c) => (c.isTotal ? null : v! > 100 ? { color: 'green' } : null) }));
    expect(conditionalStyle(fn.dataFields[0], 150, null, { rowPath: ['Sul'], columnPath: [2], isTotal: false, dataField: 'valor' })).toEqual({ color: 'green' });
  });

  it('parseColor', () => {
    expect(parseColor('#0f0')).toEqual([0, 255, 0, 1]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30, 0.5]);
    expect(parseColor('azul')).toBeNull();
  });
});

describe('Excel da pivot', () => {
  it('cabeçalhos mesclados, valores numéricos e painel congelado', () => {
    // dois campos de dados: cada mês ocupa 2 colunas no cabeçalho (mesclado)
    const cube = cubeOf([
      ...base({ format: { style: 'currency', currency: 'BRL' } }),
      { name: 'qtd', dataField: 'valor', area: 'data', summaryType: 'count', caption: 'Qtd' },
    ]);
    const files = unzipStore(pivotToXlsx(cube, buildView(cube, opts), { locale: L }));
    const sheet = files['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('<mergeCell ref="B1:C1"/>');
    expect(sheet).toContain('<mergeCell ref="A1:A2"/>');
    expect(sheet).toContain('<v>1010</v>'); // total geral
    expect(sheet).toContain('state="frozen"');
    expect(files['xl/workbook.xml']).toContain('<sheet name="Pivot"');
    expect(files['xl/styles.xml']).toContain('R$');
  });
});
