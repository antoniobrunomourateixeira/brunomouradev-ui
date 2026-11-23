import { describe, expect, it } from 'vitest';
import {
  buildCube,
  buildView,
  distinctValues,
  drillDown,
  expandablePathKeys,
  fieldText,
  pivotToCsv,
  resolveFields,
  type PivotField,
  type PivotLayoutOptions,
} from '../src/engine/index';

const L = 'pt-BR';
const vendas = [
  { regiao: 'Sul', uf: 'PR', data: '2025-02-10', valor: 100, qtd: 1 },
  { regiao: 'Sul', uf: 'PR', data: '2025-05-03', valor: 200, qtd: 2 },
  { regiao: 'Sul', uf: 'SC', data: '2026-01-20', valor: 50, qtd: 1 },
  { regiao: 'Sudeste', uf: 'SP', data: '2026-03-15', valor: 400, qtd: 4 },
  { regiao: 'Sudeste', uf: 'SP', data: '2025-11-30', valor: null, qtd: 3 },
  { regiao: null, uf: 'XX', data: '2026-07-01', valor: 10, qtd: 1 },
];

const baseFields: PivotField[] = [
  { dataField: 'regiao', area: 'row', expanded: true },
  { dataField: 'uf', area: 'row' },
  { dataField: 'data', groupInterval: 'year', area: 'column' },
  { dataField: 'data', groupInterval: 'quarter', area: 'column' },
  { dataField: 'valor', area: 'data', format: { style: 'currency', currency: 'BRL' } },
];

const opts = (over: Partial<PivotLayoutOptions> = {}): PivotLayoutOptions => ({
  rowExpansion: { overrides: {} },
  columnExpansion: { overrides: {} },
  showRowGrandTotals: true,
  showColumnGrandTotals: true,
  showColumnTotals: true,
  texts: { total: 'Total', grandTotal: 'Total Geral' },
  ...over,
});

const cubeOf = (fields: PivotField[]) => buildCube(vendas, resolveFields(fields, vendas, L), L, '(vazio)');

describe('resolveFields', () => {
  it('gera nomes, captions e summaryType padrão', () => {
    const f = resolveFields(baseFields, vendas, L);
    expect(f.map((x) => x.name)).toEqual(['regiao', 'uf', 'data.year', 'data.quarter', 'valor']);
    expect(f[2].caption).toBe('Data (Ano)');
    expect(f[4].summaryType).toBe('sum');
    expect(f[0].summaryType).toBe('count');
  });
});

describe('fieldText', () => {
  it('formata intervalos de data', () => {
    const [m] = resolveFields([{ dataField: 'data', groupInterval: 'month' }], vendas, L);
    expect(fieldText(3, m, L, '')).toBe('Março');
    const [q] = resolveFields([{ dataField: 'data', groupInterval: 'quarter' }], vendas, L);
    expect(fieldText(2, q, L, '')).toBe('T2');
    const [w] = resolveFields([{ dataField: 'data', groupInterval: 'dayOfWeek' }], vendas, L);
    expect(fieldText(0, w, L, '')).toBe('Domingo');
  });
});

describe('buildCube', () => {
  const cube = cubeOf(baseFields);

  it('monta as árvores ordenadas, com vazios no fim', () => {
    expect(cube.rowRoot.children.map((n) => n.text)).toEqual(['Sudeste', 'Sul', '(vazio)']);
    expect(cube.rowRoot.children[1].children.map((n) => n.text)).toEqual(['PR', 'SC']);
    expect(cube.columnRoot.children.map((n) => n.text)).toEqual(['2025', '2026']);
  });

  it('agrega total geral, subtotais e células', () => {
    const sul = cube.rowRoot.children[1];
    const pr = sul.children[0];
    const y2025 = cube.columnRoot.children[0];
    expect(cube.getValue('', '', 0)).toBe(760);
    expect(cube.getValue(sul.pathKey, '', 0)).toBe(350);
    expect(cube.getValue(pr.pathKey, y2025.pathKey, 0)).toBe(300);
    const q2 = y2025.children.find((n) => n.value === 2)!;
    expect(cube.getValue(pr.pathKey, q2.pathKey, 0)).toBe(200);
  });

  it('soma ignora nulos e retorna null quando não há valor', () => {
    const sp = cube.rowRoot.children[0].children[0];
    const y2025 = cube.columnRoot.children[0];
    expect(cube.getValue(sp.pathKey, y2025.pathKey, 0)).toBeNull();
  });

  it('calcula avg, count, min e max', () => {
    const c = cubeOf([
      { dataField: 'regiao', area: 'row' },
      { dataField: 'valor', area: 'data', summaryType: 'avg', name: 'avg' },
      { dataField: 'valor', area: 'data', summaryType: 'count', name: 'cnt' },
      { dataField: 'valor', area: 'data', summaryType: 'min', name: 'min' },
      { dataField: 'valor', area: 'data', summaryType: 'max', name: 'max' },
    ]);
    const sudeste = c.rowRoot.children[0].pathKey;
    expect([0, 1, 2, 3].map((d) => c.getValue(sudeste, '', d))).toEqual([400, 2, 400, 400]);
    expect(c.getValue('', '', 0)).toBe(152);
  });

  it('usa contagem quando não há campo de dados', () => {
    const c = cubeOf([{ dataField: 'uf', area: 'row' }]);
    expect(c.dataFields[0].summaryType).toBe('count');
    expect(c.getValue('', '', 0)).toBe(6);
  });

  it('aplica filtros include/exclude', () => {
    const inc = cubeOf([...baseFields, { dataField: 'uf', name: 'ufFiltro', area: 'filter', filterValues: ['PR', 'SP'] }]);
    expect(inc.recordCount).toBe(4);
    expect(inc.getValue('', '', 0)).toBe(700);
    const exc = cubeOf([{ dataField: 'regiao', area: 'row', filterValues: [null], filterType: 'exclude' }, baseFields[4]]);
    expect(exc.recordCount).toBe(5);
    const none = cubeOf([{ dataField: 'regiao', area: 'row', filterValues: [] }, baseFields[4]]);
    expect(none.recordCount).toBe(0);
  });
});

describe('buildView', () => {
  const cube = cubeOf(baseFields);

  it('mostra linhas expandidas pelo field.expanded e o total geral no fim', () => {
    const v = buildView(cube, opts());
    expect(v.rows.map((r) => '  '.repeat(r.level) + r.text)).toEqual([
      'Sudeste',
      '  SP',
      'Sul',
      '  PR',
      '  SC',
      '(vazio)',
      '  XX',
      'Total Geral',
    ]);
  });

  it('recolhe por override e por "all"', () => {
    const sul = cube.rowRoot.children[1].pathKey;
    const v = buildView(cube, opts({ rowExpansion: { overrides: { [sul]: false } } }));
    expect(v.rows.map((r) => r.text)).toEqual(['Sudeste', 'SP', 'Sul', '(vazio)', 'XX', 'Total Geral']);
    const all = buildView(cube, opts({ rowExpansion: { overrides: {}, all: false } }));
    expect(all.rows.map((r) => r.text)).toEqual(['Sudeste', 'Sul', '(vazio)', 'Total Geral']);
  });

  it('gera cabeçalhos com colspan/rowspan e colunas de subtotal', () => {
    const y2025 = cube.columnRoot.children[0].pathKey;
    const v = buildView(cube, opts({ columnExpansion: { overrides: { [y2025]: true } } }));
    // 2025 expandido: T1, T2, T4 + "2025 Total"; 2026 recolhido; Total Geral
    expect(v.headerRows[0].map((c) => [c.text, c.colspan, c.rowspan])).toEqual([
      ['2025', 4, 1],
      ['2026', 1, 2],
      ['Total Geral', 1, 2],
    ]);
    expect(v.headerRows[1].map((c) => c.text)).toEqual(['T1', 'T2', 'T4', '2025 Total']);
    expect(v.columns.map((c) => c.type)).toEqual(['value', 'value', 'value', 'total', 'value', 'grand']);
  });

  it('adiciona linha de campos de dados quando há mais de um', () => {
    const c = cubeOf([...baseFields, { dataField: 'qtd', area: 'data' }]);
    const v = buildView(c, opts());
    expect(v.headerRows).toHaveLength(2);
    expect(v.headerRows[0][0].colspan).toBe(2);
    expect(v.headerRows[1].slice(0, 2).map((h) => h.text)).toEqual(['Valor', 'Qtd']);
    expect(v.columns).toHaveLength(6);
  });

  it('pode esconder totais', () => {
    const v = buildView(cube, opts({ showRowGrandTotals: false, showColumnGrandTotals: false }));
    expect(v.rows.some((r) => r.isGrandTotal)).toBe(false);
    expect(v.columns.some((c) => c.type === 'grand')).toBe(false);
  });
});

describe('utilitários', () => {
  const fields = resolveFields(baseFields, vendas, L);
  const cube = buildCube(vendas, fields, L);

  it('distinctValues ordena e mantém vazio no fim', () => {
    expect(distinctValues(vendas, fields[0], L)).toEqual(['Sudeste', 'Sul', null]);
  });

  it('expandablePathKeys lista grupos com filhos', () => {
    expect(expandablePathKeys(cube.rowRoot)).toHaveLength(3);
  });

  it('drillDown retorna os registros da célula', () => {
    const r = drillDown(vendas, fields, cube, ['Sul', 'PR'], [2025]);
    expect(r.map((x) => x.valor)).toEqual([100, 200]);
  });

  it('pivotToCsv exporta cabeçalho e linhas', () => {
    const v = buildView(cube, opts({ rowExpansion: { overrides: {}, all: false } }));
    const csv = pivotToCsv(cube, v, L).split('\r\n');
    expect(csv[0]).toBe('Regiao / Uf;2025;2026;Total Geral');
    expect(csv[2]).toMatch(/^Sul;R\$\s300,00;R\$\s50,00;R\$\s350,00$/);
  });
});

describe('ordenação por total (sortBySummaryField)', () => {
  const withSort = (row: Partial<PivotField>, col: Partial<PivotField> = {}) =>
    resolveFields(
      [
        { dataField: 'regiao', area: 'row', ...row },
        { dataField: 'data', groupInterval: 'year', area: 'column', ...col },
        { dataField: 'valor', area: 'data' },
      ],
      vendas,
      L,
    );
  const rowValues = (fields: ReturnType<typeof withSort>) => buildCube(vendas, fields, L).rowRoot.children.map((n) => n.value);

  it('ordena linhas pelo total geral, decrescente', () => {
    // Sul 350, Sudeste 400, (vazio) 10
    expect(rowValues(withSort({ sortBySummaryField: 'valor', sortOrder: 'desc' }))).toEqual(['Sudeste', 'Sul', null]);
    expect(rowValues(withSort({ sortBySummaryField: 'valor', sortOrder: 'asc' }))).toEqual([null, 'Sul', 'Sudeste']);
  });

  it('ordena linhas por uma coluna específica; sem valor vai para o fim', () => {
    // 2025: Sul 300, Sudeste sem valor, (vazio) sem registros
    const fields = withSort({ sortBySummaryField: 'valor', sortBySummaryPath: [2025], sortOrder: 'asc' });
    expect(rowValues(fields)).toEqual(['Sul', 'Sudeste', null]);
  });

  it('ordena colunas pelo total geral das linhas', () => {
    // 2025 = 300, 2026 = 460
    const cube = buildCube(vendas, withSort({}, { sortBySummaryField: 'valor', sortOrder: 'desc' }), L);
    expect(cube.columnRoot.children.map((n) => n.value)).toEqual([2026, 2025]);
  });

  it('campo de dados inexistente é ignorado', () => {
    expect(rowValues(withSort({ sortBySummaryField: 'nada' }))).toEqual(['Sudeste', 'Sul', null]);
  });

  it('marca o cabeçalho da coluna usada na ordenação', () => {
    const cube = buildCube(vendas, withSort({ sortBySummaryField: 'valor', sortOrder: 'desc' }), L);
    const head = buildView(cube, opts()).headerRows[0];
    expect(head.map((c) => [c.text, c.dataIndex, c.sortOrder])).toEqual([
      ['2025', 0, undefined],
      ['2026', 0, undefined],
      ['Total Geral', 0, 'desc'],
    ]);
  });

  it('com vários campos de dados, a linha de nomes é que recebe o indicador', () => {
    const fields = resolveFields(
      [
        { dataField: 'regiao', area: 'row', sortBySummaryField: 'qtd', sortBySummaryPath: [2026], sortOrder: 'desc' },
        { dataField: 'data', groupInterval: 'year', area: 'column' },
        { dataField: 'valor', area: 'data' },
        { dataField: 'qtd', area: 'data' },
      ],
      vendas,
      L,
    );
    const cube = buildCube(vendas, fields, L);
    // qtd em 2026: Sudeste 4, Sul 1, (vazio) 1 → empate desfeito pelo valor
    expect(cube.rowRoot.children.map((n) => n.value)).toEqual(['Sudeste', 'Sul', null]);
    const v = buildView(cube, opts());
    expect(v.headerRows[0].every((c) => c.dataIndex === undefined)).toBe(true);
    const sorted = v.headerRows[1].filter((c) => c.sortOrder);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toMatchObject({ text: 'Qtd', path: [2026], dataIndex: 1 });
  });
});

describe('layout tabular', () => {
  const cube = () => buildCube(vendas, resolveFields(baseFields, vendas, L), L);
  const brief = (v: ReturnType<typeof buildView>) =>
    v.rows.map((r) => (r.headers || []).map((h) => `${h.text}[${h.column}:${h.rowspan}x${h.colspan}${h.type === 'value' ? '' : ' ' + h.type}]`).join(' | '));

  it('uma coluna por campo, cabeçalho do grupo com rowspan e linha de total abaixo', () => {
    const v = buildView(cube(), opts({ rowLayout: 'tabular' }));
    expect(v.rowHeaderColumns).toBe(2);
    expect(brief(v)).toEqual([
      'Sudeste[0:1x1] | SP[1:1x1]',
      'Sudeste Total[0:1x2 total]',
      'Sul[0:2x1] | PR[1:1x1]',
      'SC[1:1x1]',
      'Sul Total[0:1x2 total]',
      '(vazio)[0:1x1] | XX[1:1x1]',
      '(vazio) Total[0:1x2 total]',
      'Total Geral[0:1x2 grand]',
    ]);
    const sulTotal = v.rows[4];
    expect(sulTotal.isTotal).toBe(true);
    expect(cube().getValue(sulTotal.pathKey, '', 0)).toBe(350);
  });

  it('tudo recolhido vira uma coluna, sem linhas de total', () => {
    const v = buildView(cube(), opts({ rowLayout: 'tabular', rowExpansion: { overrides: {}, all: false } }));
    expect(v.rowHeaderColumns).toBe(1);
    expect(brief(v)).toEqual(['Sudeste[0:1x1]', 'Sul[0:1x1]', '(vazio)[0:1x1]', 'Total Geral[0:1x1 grand]']);
    expect(v.rows[0].expandable).toBe(true);
  });

  it('showRowTotals: false remove as linhas de subtotal', () => {
    const v = buildView(cube(), opts({ rowLayout: 'tabular', showRowTotals: false, showRowGrandTotals: false }));
    expect(v.rows.some((r) => r.isTotal || r.isGrandTotal)).toBe(false);
    expect(brief(v)[1]).toBe('Sul[0:2x1] | PR[1:1x1]');
  });

  it('o layout em árvore continua igual', () => {
    const v = buildView(cube(), opts());
    expect(v.rowHeaderColumns).toBe(1);
    expect(v.rows.every((r) => !r.headers && !r.isTotal)).toBe(true);
  });

  it('CSV repete o grupo em cada linha', () => {
    const c = cube();
    const csv = pivotToCsv(c, buildView(c, opts({ rowLayout: 'tabular' })), L).split('\r\n');
    expect(csv[0]).toBe('Regiao;Uf;2025;2026;Total Geral');
    expect(csv[3]).toMatch(/^Sul;PR;/);
    expect(csv[4]).toMatch(/^Sul;SC;/);
    expect(csv[5]).toMatch(/^Sul Total;;R\$\s300,00;R\$\s50,00;R\$\s350,00$/);
  });
});
