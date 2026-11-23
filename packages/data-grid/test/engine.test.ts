import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  applySearch,
  applySort,
  computeSummary,
  paginate,
  parseFilterInput,
  query,
  resolveColumns,
  toCsv,
} from '../src/engine/index';

const data = [
  { id: 1, nome: 'Ana Souza', cidade: 'São Paulo', valor: 1500.5, ativo: true, data: '2026-01-10', cliente: { uf: 'SP' } },
  { id: 2, nome: 'Bruno Lima', cidade: 'Curitiba', valor: 250, ativo: false, data: '2026-03-05', cliente: { uf: 'PR' } },
  { id: 3, nome: 'Carla Dias', cidade: 'Maringá', valor: null, ativo: true, data: '2026-03-05', cliente: { uf: 'PR' } },
  { id: 4, nome: 'álvaro Reis', cidade: 'Londrina', valor: 99.9, ativo: true, data: '2025-12-31', cliente: { uf: 'PR' } },
];

const cols = resolveColumns(
  [
    { dataField: 'id' },
    { dataField: 'nome' },
    { dataField: 'cidade' },
    { dataField: 'valor' },
    { dataField: 'ativo' },
    { dataField: 'data' },
    { dataField: 'cliente.uf' },
  ],
  data,
);
const L = 'pt-BR';

describe('resolveColumns', () => {
  it('infere tipos, caption e alinhamento', () => {
    const byField = Object.fromEntries(cols.map((c) => [c.dataField, c]));
    expect(byField.id.dataType).toBe('number');
    expect(byField.id.alignment).toBe('right');
    expect(byField.nome.dataType).toBe('string');
    expect(byField.ativo.dataType).toBe('boolean');
    expect(byField.data.dataType).toBe('date');
    expect(byField['cliente.uf'].caption).toBe('Uf');
  });

  it('gera colunas automaticamente a partir da primeira linha', () => {
    const auto = resolveColumns(undefined, [{ valorTotal: 1, nome_cliente: 'x' }]);
    expect(auto.map((c) => c.caption)).toEqual(['Valor Total', 'Nome cliente']);
  });
});

describe('parseFilterInput', () => {
  it('entende operadores em colunas numéricas', () => {
    expect(parseFilterInput('>100', 'number')).toEqual({ operation: '>', value: 100 });
    expect(parseFilterInput('<= 1.234,5', 'number')).toEqual({ operation: '<=', value: 1234.5 });
    expect(parseFilterInput('!=0', 'number')).toEqual({ operation: '<>', value: 0 });
    expect(parseFilterInput('abc', 'number')).toBeNull();
  });
  it('usa "contains" para texto', () => {
    expect(parseFilterInput('ana', 'string')).toEqual({ operation: 'contains', value: 'ana' });
  });
});

describe('applyFilters', () => {
  it('filtra texto ignorando acentos e caixa', () => {
    const r = applyFilters(data, [{ field: 'nome', operation: 'contains', value: 'ALVARO' }], cols);
    expect(r.map((x) => x.id)).toEqual([4]);
  });
  it('filtra números', () => {
    const r = applyFilters(data, [{ field: 'valor', operation: '>', value: 200 }], cols);
    expect(r.map((x) => x.id)).toEqual([1, 2]);
  });
  it('filtra datas pelo dia', () => {
    const r = applyFilters(data, [{ field: 'data', operation: '=', value: '2026-03-05' }], cols);
    expect(r.map((x) => x.id)).toEqual([2, 3]);
  });
  it('filtra boolean e campo aninhado', () => {
    const r = applyFilters(
      data,
      [
        { field: 'ativo', operation: '=', value: true },
        { field: 'cliente.uf', operation: '=', value: 'pr' },
      ],
      cols,
    );
    expect(r.map((x) => x.id)).toEqual([3, 4]);
  });
});

describe('applySearch', () => {
  it('procura em todas as colunas visíveis', () => {
    expect(applySearch(data, 'curitiba', cols, L).map((x) => x.id)).toEqual([2]);
    expect(applySearch(data, 'maringa', cols, L).map((x) => x.id)).toEqual([3]);
  });
  it('encontra pelo valor formatado', () => {
    expect(applySearch(data, '1.500,5', cols, L).map((x) => x.id)).toEqual([1]);
  });
});

describe('applySort', () => {
  it('ordena texto com collation (acentos)', () => {
    const r = applySort(data, [{ field: 'nome', order: 'asc' }], cols, L);
    expect(r.map((x) => x.id)).toEqual([4, 1, 2, 3]);
  });
  it('coloca nulos primeiro em asc e por último em desc', () => {
    expect(applySort(data, [{ field: 'valor', order: 'asc' }], cols, L).map((x) => x.id)).toEqual([3, 4, 2, 1]);
    expect(applySort(data, [{ field: 'valor', order: 'desc' }], cols, L).map((x) => x.id)).toEqual([1, 2, 4, 3]);
  });
  it('ordena por várias colunas e é estável', () => {
    const r = applySort(
      data,
      [
        { field: 'cliente.uf', order: 'asc' },
        { field: 'data', order: 'desc' },
      ],
      cols,
      L,
    );
    expect(r.map((x) => x.id)).toEqual([2, 3, 4, 1]);
  });
});

describe('paginate / query', () => {
  it('pagina e corrige índice fora do limite', () => {
    const p = paginate([1, 2, 3, 4, 5], 9, 2);
    expect(p).toEqual({ pageRows: [5], pageCount: 3, pageIndex: 2 });
    expect(paginate([1, 2, 3], 0, 0).pageRows).toEqual([1, 2, 3]);
  });
  it('executa o pipeline completo', () => {
    const r = query(
      data,
      cols,
      {
        filters: [{ field: 'cliente.uf', operation: '=', value: 'PR' }],
        searchText: '',
        sorts: [{ field: 'id', order: 'desc' }],
        pageIndex: 0,
        pageSize: 2,
      },
      L,
    );
    expect(r.totalCount).toBe(3);
    expect(r.pageCount).toBe(2);
    expect(r.pageRows.map((x) => x.id)).toEqual([4, 3]);
  });
});

describe('computeSummary', () => {
  it('calcula soma, média, contagem, mínimo e máximo', () => {
    const sum = computeSummary(data, { column: 'valor', summaryType: 'sum' }, cols, L, { sum: 'Soma' });
    expect(sum.value).toBeCloseTo(1850.4);
    expect(sum.text).toBe('Soma: 1.850,4');
    expect(computeSummary(data, { column: 'valor', summaryType: 'avg' }, cols, L).value).toBeCloseTo(616.8);
    expect(computeSummary(data, { column: 'id', summaryType: 'count', displayFormat: '{0} registros' }, cols, L).text).toBe(
      '4 registros',
    );
    expect(computeSummary(data, { column: 'valor', summaryType: 'min' }, cols, L).value).toBe(99.9);
    expect(computeSummary(data, { column: 'valor', summaryType: 'max' }, cols, L).value).toBe(1500.5);
  });
});

describe('datas sem horário', () => {
  it('"AAAA-MM-DD" é interpretada no fuso local (não volta um dia)', () => {
    const rows: { data: string }[] = [{ data: '2026-01-01' }];
    const [c] = resolveColumns([{ dataField: 'data' }], rows);
    expect(toCsv(rows, [c], L)).toBe('Data\r\n01/01/2026');
  });
});

describe('toCsv', () => {
  it('usa valores formatados e escapa separadores', () => {
    const c = resolveColumns([{ dataField: 'nome' }, { dataField: 'valor' }], [{ nome: 'a;b', valor: 1.5 }]);
    expect(toCsv([{ nome: 'a;b', valor: 1.5 }], c, L)).toBe('Nome;Valor\r\n"a;b";1,5');
  });
});
