import { describe, expect, it } from 'vitest';
import { applyHeaderFilters, headerFilterItems, query, resolveColumns, type ColumnDef } from '../src/engine/index';

const data = [
  { id: 1, uf: 'PR', valor: 10, venc: '2026-01-10', pago: true },
  { id: 2, uf: 'SP', valor: 20, venc: '2026-01-10T15:00:00', pago: false },
  { id: 3, uf: 'pr', valor: 10, venc: '2026-02-01', pago: true },
  { id: 4, uf: null, valor: 5, venc: null, pago: true },
  { id: 5, uf: 'São Paulo', valor: 100, venc: '2026-02-01', pago: false },
];
const defs: ColumnDef[] = [
  { dataField: 'id' },
  { dataField: 'uf', dataType: 'string' },
  { dataField: 'valor', format: { style: 'currency', currency: 'BRL' } },
  { dataField: 'venc', dataType: 'date' },
  { dataField: 'pago' },
];
const cols = resolveColumns(defs, data);
const col = (f: string) => cols.find((c) => c.dataField === f)!;
const texts = { yes: 'Sim', no: 'Não', blank: '(vazio)' };
const ids = (rows: any[]) => rows.map((r) => r.id);

describe('filtro do cabeçalho', () => {
  it('lista os valores distintos com a quantidade, vazio primeiro', () => {
    const items = headerFilterItems(data, col('uf'), 'pt-BR', texts);
    expect(items.map((i) => `${i.text}:${i.count}`)).toEqual(['(vazio):1', 'PR:2', 'São Paulo:1', 'SP:1']);
  });

  it('números e datas em ordem de valor, com o texto formatado; data agrupa pelo dia', () => {
    expect(headerFilterItems(data, col('valor'), 'pt-BR', texts).map((i) => i.text.replace(/\s/g, ' '))).toEqual([
      'R$ 5,00',
      'R$ 10,00',
      'R$ 20,00',
      'R$ 100,00',
    ]);
    expect(headerFilterItems(data, col('venc'), 'pt-BR', texts).map((i) => `${i.text}:${i.count}`)).toEqual([
      '(vazio):1',
      '10/01/2026:2',
      '01/02/2026:2',
    ]);
    expect(headerFilterItems(data, col('pago'), 'pt-BR', texts).map((i) => i.text)).toEqual(['Não', 'Sim']);
  });

  it('include mantém só os valores marcados (sem diferenciar caixa)', () => {
    expect(ids(applyHeaderFilters(data, [{ field: 'uf', type: 'include', values: ['pr', ''] }], cols))).toEqual([1, 3, 4]);
  });

  it('exclude esconde os valores; exclude vazio não filtra', () => {
    expect(ids(applyHeaderFilters(data, [{ field: 'venc', type: 'exclude', values: ['2026-1-10'] }], cols))).toEqual([3, 4, 5]);
    expect(ids(applyHeaderFilters(data, [{ field: 'uf', type: 'exclude', values: [] }], cols))).toEqual([1, 2, 3, 4, 5]);
  });

  it('vários filtros somam (E) e entram no query antes da busca e da paginação', () => {
    const r = query(
      data,
      cols,
      {
        filters: [],
        searchText: '',
        sorts: [{ field: 'valor', order: 'desc' }],
        pageIndex: 0,
        pageSize: 0,
        headerFilters: [
          { field: 'pago', type: 'include', values: ['1'] },
          { field: 'valor', type: 'exclude', values: ['5'] },
        ],
      },
      'pt-BR',
    );
    expect(ids(r.rows)).toEqual([1, 3]);
    expect(r.totalCount).toBe(2);
  });
});
