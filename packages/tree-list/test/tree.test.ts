import { describe, expect, it } from 'vitest';
import { resolveColumns } from '@brunomouradev/data-grid/engine';
import { buildTree, checkState, filterTree, flattenTree, rollupValues, sortTree, toggleRecursive } from '../src/engine/tree';

// Plano de contas simplificado
const contas = [
  { id: 1, parentId: null, nome: 'Receitas', valor: null },
  { id: 2, parentId: 1, nome: 'Vendas', valor: 1000 },
  { id: 3, parentId: 1, nome: 'Serviços', valor: 500 },
  { id: 4, parentId: null, nome: 'Despesas', valor: null },
  { id: 5, parentId: 4, nome: 'Pessoal', valor: null },
  { id: 6, parentId: 5, nome: 'Salários', valor: 300 },
  { id: 7, parentId: 5, nome: 'Benefícios', valor: 100 },
  { id: 8, parentId: 4, nome: 'Aluguel', valor: 200 },
  { id: 9, parentId: 99, nome: 'Órfã', valor: 1 }, // pai não existe: vira raiz
];
const cols = resolveColumns([{ dataField: 'nome' }, { dataField: 'valor', dataType: 'number' }], contas);
const names = (rows: { node: { data: any } }[]) => rows.map((r) => r.node.data.nome).join(',');

describe('TreeList: montar a árvore', () => {
  it('lista plana (id/parentId), órfão vira raiz, níveis', () => {
    const t = buildTree(contas);
    expect(t.roots.map((n) => n.data.nome)).toEqual(['Receitas', 'Despesas', 'Órfã']);
    expect(t.byKey.get(6)!.level).toBe(2);
    expect(t.byKey.get(5)!.hasChildren).toBe(true);
    expect(t.all.map((n) => n.key)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('lista hierárquica (itemsExpr)', () => {
    const t = buildTree([{ id: 'a', nome: 'A', items: [{ id: 'b', nome: 'B', items: [{ id: 'c', nome: 'C' }] }] }], { itemsExpr: 'items' });
    expect(t.byKey.get('c')!.level).toBe(2);
    expect(t.byKey.get('c')!.parent!.key).toBe('b');
  });

  it('ciclo não trava: o nó vira raiz', () => {
    const t = buildTree([
      { id: 1, parentId: 2 },
      { id: 2, parentId: 1 },
    ]);
    expect(t.all).toHaveLength(2);
    expect(t.roots.length).toBeGreaterThan(0);
  });

  it('hasItemsExpr: item sem filhos carregados mas com filhos a carregar', () => {
    const t = buildTree([{ id: 1, parentId: null, temFilhos: true }], { hasItemsExpr: 'temFilhos' });
    expect(t.byKey.get(1)!.hasChildren).toBe(true);
  });
});

describe('TreeList: exibir', () => {
  it('só as raízes quando nada está aberto; abre por chave', () => {
    const t = buildTree(contas);
    expect(names(flattenTree(t, () => false))).toBe('Receitas,Despesas,Órfã');
    const open = new Set([4, 5]);
    expect(names(flattenTree(t, (n) => open.has(n.key)))).toBe('Receitas,Despesas,Pessoal,Salários,Benefícios,Aluguel,Órfã');
  });

  it('ordena irmãos sem misturar níveis', () => {
    const t = buildTree(contas);
    sortTree(t, [{ field: 'nome', order: 'asc' }], cols, 'pt-BR');
    expect(names(flattenTree(t, () => true))).toBe('Despesas,Aluguel,Pessoal,Benefícios,Salários,Órfã,Receitas,Serviços,Vendas');
  });

  it('busca mantém o caminho até o item e abre os ancestrais', () => {
    const t = buildTree(contas);
    const f = filterTree(t, { filters: [], searchText: 'salar' }, cols, 'pt-BR');
    const rows = flattenTree(t, () => false, f);
    expect(names(rows)).toBe('Despesas,Pessoal,Salários');
    expect(rows.map((r) => r.matched)).toEqual([false, false, true]);
    // recolhido pelo usuário durante o filtro
    expect(names(flattenTree(t, () => false, f, (n) => n.key === 4))).toBe('Despesas');
  });

  it('filtro por coluna (>250)', () => {
    const t = buildTree(contas);
    const f = filterTree(t, { filters: [{ field: 'valor', operation: '>', value: 250 }], searchText: '' }, cols, 'pt-BR');
    expect(names(flattenTree(t, () => false, f))).toBe('Receitas,Vendas,Serviços,Despesas,Pessoal,Salários');
  });
});

describe('TreeList: seleção em cascata', () => {
  it('marcar o pai marca os filhos; o avô só quando todos os filhos estão marcados', () => {
    const t = buildTree(contas);
    let s = toggleRecursive(new Set(), t.byKey.get(5)!, true);
    expect(Array.from(s).sort()).toEqual([5, 6, 7]);
    expect(checkState(s, t.byKey.get(4)!)).toBe('some');
    s = toggleRecursive(s, t.byKey.get(8)!, true);
    expect(s.has(4)).toBe(true);
    expect(checkState(s, t.byKey.get(4)!)).toBe('all');
    s = toggleRecursive(s, t.byKey.get(7)!, false);
    expect(s.has(5)).toBe(false);
    expect(s.has(4)).toBe(false);
    expect(checkState(s, t.byKey.get(5)!)).toBe('some');
  });
});

describe('TreeList: total dos filhos', () => {
  it('soma as folhas abaixo de cada pai (respeitando o filtro)', () => {
    const t = buildTree(contas);
    const r = rollupValues(t, cols[1], 'sum');
    expect(r.get(t.byKey.get(1)!)).toBe(1500);
    expect(r.get(t.byKey.get(4)!)).toBe(600);
    expect(r.get(t.byKey.get(5)!)).toBe(400);
    expect(r.has(t.byKey.get(6)!)).toBe(false); // folha: usa o próprio valor
    const f = filterTree(t, { filters: [], searchText: 'sal' }, cols, 'pt-BR');
    expect(rollupValues(t, cols[1], 'sum', f.visible).get(t.byKey.get(4)!)).toBe(300);
    expect(rollupValues(t, cols[1], 'count').get(t.byKey.get(4)!)).toBe(3);
  });
});
