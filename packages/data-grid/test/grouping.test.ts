import { describe, expect, it } from 'vitest';
import { groupKey, groupSorts, query, resolveColumns, type ColumnDef, type GridRowItem } from '../src/engine/index';

const data = [
  { id: 1, uf: 'PR', cidade: 'Curitiba', valor: 10, venc: '2026-01-10' },
  { id: 2, uf: 'SP', cidade: 'Santos', valor: 20, venc: '2026-01-10' },
  { id: 3, uf: 'PR', cidade: 'Londrina', valor: 30, venc: '2026-02-01' },
  { id: 4, uf: 'pr', cidade: 'Curitiba', valor: 40, venc: '2026-01-10T15:00:00' },
  { id: 5, uf: null, cidade: 'Sem UF', valor: 50, venc: '2026-03-05' },
  { id: 6, uf: 'SP', cidade: 'Campinas', valor: 60, venc: '2026-02-01' },
];
const defs: ColumnDef[] = [
  { dataField: 'id' },
  { dataField: 'uf', dataType: 'string' },
  { dataField: 'cidade' },
  { dataField: 'valor' },
  { dataField: 'venc', dataType: 'date' },
];
const cols = resolveColumns(defs, data);
const base = { filters: [], searchText: '', sorts: [], pageIndex: 0, pageSize: 0 };

/** "G0:pr(3)" para grupos, "#id" para linhas, "~" para continuação. */
const show = (items: GridRowItem[] = []) =>
  items
    .map((it) =>
      it.type === 'group'
        ? `${it.continued ? '~' : ''}G${it.group.level}:${it.group.key}(${it.group.rows.length})${it.expanded ? '' : '+'}`
        : '#' + (it.row as any).id,
    )
    .join(' ');

describe('agrupamento', () => {
  it('chave ignora caixa/acento e agrupa data pelo dia', () => {
    expect(groupKey('Paraná', 'string')).toBe(groupKey('PARANA', 'string'));
    expect(groupKey('2026-01-10', 'date')).toBe(groupKey('2026-01-10T15:00:00', 'date'));
    expect(groupKey(null, 'string')).toBe('');
  });

  it('ordena primeiro pelos grupos e mantém a ordenação do usuário dentro', () => {
    expect(groupSorts([{ field: 'uf', order: 'desc' }], [{ field: 'valor', order: 'desc' }, { field: 'uf', order: 'asc' }])).toEqual([
      { field: 'uf', order: 'desc' },
      { field: 'valor', order: 'desc' },
    ]);
  });

  it('um nível: grupos com linhas, vazio primeiro em asc', () => {
    const r = query(data, cols, { ...base, groups: [{ field: 'uf', order: 'asc' }] }, 'pt-BR');
    expect(show(r.items)).toBe('G0:(1) #5 G0:pr(3) #1 #3 #4 G0:sp(2) #2 #6');
    expect(r.totalCount).toBe(6);
    expect(r.pageRows.map((x) => x.id)).toEqual([5, 1, 3, 4, 2, 6]);
  });

  it('dois níveis e ordenação do usuário dentro do grupo', () => {
    const r = query(
      data,
      cols,
      { ...base, sorts: [{ field: 'valor', order: 'desc' }], groups: [{ field: 'uf', order: 'desc' }, { field: 'venc', order: 'asc' }] },
      'pt-BR',
    );
    const pr = r.groups![1];
    expect(pr.key).toBe('pr');
    expect(pr.children!.map((g) => g.rows.map((x) => x.id))).toEqual([[4, 1], [3]]);
    expect(show(r.items).startsWith('G0:sp(2) G1:2026-1-10(1) #2 G1:2026-2-1(1) #6 G0:pr(3)')).toBe(true);
  });

  it('recolher: o grupo fica sem linhas; overrides por grupo', () => {
    const groups = [{ field: 'uf', order: 'asc' as const }];
    const collapsed = query(data, cols, { ...base, groups, groupExpansion: { all: false, overrides: {} } }, 'pt-BR');
    expect(show(collapsed.items)).toBe('G0:(1)+ G0:pr(3)+ G0:sp(2)+');
    expect(collapsed.pageRows).toEqual([]);
    const sp = collapsed.groups![2].path;
    const one = query(data, cols, { ...base, groups, groupExpansion: { all: false, overrides: { [sp]: true } } }, 'pt-BR');
    expect(show(one.items)).toBe('G0:(1)+ G0:pr(3)+ G0:sp(2) #2 #6');
  });

  it('paginação conta as linhas de grupo e repete o cabeçalho na página seguinte', () => {
    const groups = [{ field: 'uf', order: 'asc' as const }, { field: 'cidade', order: 'asc' as const }];
    const p0 = query(data, cols, { ...base, groups, pageSize: 4 }, 'pt-BR');
    expect(p0.pageCount).toBe(4); // 14 itens: 3 UFs + 5 cidades + 6 linhas
    expect(show(p0.items)).toBe('G0:(1) G1:sem uf(1) #5 G0:pr(3)');
    const p1 = query(data, cols, { ...base, groups, pageSize: 4, pageIndex: 1 }, 'pt-BR');
    expect(show(p1.items)).toBe('~G0:pr(3) G1:curitiba(2) #1 #4 G1:londrina(1)');
    const p2 = query(data, cols, { ...base, groups, pageSize: 4, pageIndex: 2 }, 'pt-BR');
    expect(show(p2.items)).toBe('~G0:pr(3) ~G1:londrina(1) #3 G0:sp(2) G1:campinas(1) #6');
  });

  it('filtro e busca valem antes do agrupamento; campo desconhecido é ignorado', () => {
    const r = query(data, cols, { ...base, searchText: 'curitiba', groups: [{ field: 'uf', order: 'asc' }, { field: 'xx', order: 'asc' }] }, 'pt-BR');
    expect(show(r.items)).toBe('G0:pr(2) #1 #4');
  });
});
