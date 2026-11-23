import { applyFilters, applySearch, applySort, getField, toNumber } from '@brunomouradev/data-grid/engine';
import type { FilterDescriptor, HeaderFilter, ResolvedColumn, SortDescriptor, SummaryType } from '@brunomouradev/data-grid/engine';
import { applyHeaderFilters } from '@brunomouradev/data-grid/engine';

/**
 * Motor do TreeList (sem DOM): monta a árvore a partir de uma lista "plana" (id + parentId)
 * ou já hierárquica (items), ordena irmãos, filtra mantendo os ancestrais, achata para exibição
 * e calcula totais dos filhos.
 */

export interface TreeNode<T = any> {
  key: any;
  data: T;
  parentKey: any;
  level: number;
  parent: TreeNode<T> | null;
  children: TreeNode<T>[];
  /** Tem filhos (carregados ou a carregar sob demanda). */
  hasChildren: boolean;
}

export interface TreeOptions {
  /** Campo da chave. Padrão: "id". */
  keyExpr?: string;
  /** Lista plana: campo do pai. Padrão: "parentId". */
  parentIdExpr?: string;
  /** Lista hierárquica: campo com os filhos (ex.: "items"). Se informado, ignora parentIdExpr. */
  itemsExpr?: string;
  /** Valor do pai que indica raiz. Padrão: null/undefined/"" (e pais que não existem na lista). */
  rootValue?: any;
  /** Campo booleano que diz que o item tem filhos ainda não carregados (carregamento sob demanda). */
  hasItemsExpr?: string;
}

export interface Tree<T = any> {
  roots: TreeNode<T>[];
  byKey: Map<any, TreeNode<T>>;
  /** Todos os nós em profundidade (pai antes dos filhos). */
  all: TreeNode<T>[];
}

const isRoot = (parentKey: any, opt: TreeOptions) =>
  opt.rootValue !== undefined ? parentKey === opt.rootValue || parentKey == null : parentKey == null || parentKey === '';

/** Monta a árvore. Ciclos (A pai de B, B pai de A) são quebrados: o nó vira raiz. */
export function buildTree<T>(data: T[], opt: TreeOptions = {}): Tree<T> {
  const keyExpr = opt.keyExpr || 'id';
  const byKey = new Map<any, TreeNode<T>>();
  const roots: TreeNode<T>[] = [];
  let auto = 0;

  if (opt.itemsExpr) {
    const add = (items: T[] | undefined, parent: TreeNode<T> | null) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        let key = getField(item, keyExpr);
        if (key == null || byKey.has(key)) key = '__auto' + auto++;
        const node: TreeNode<T> = { key, data: item, parentKey: parent ? parent.key : null, level: 0, parent, children: [], hasChildren: false };
        byKey.set(key, node);
        (parent ? parent.children : roots).push(node);
        add(getField(item, opt.itemsExpr!), node);
      }
    };
    add(data, null);
  } else {
    const parentExpr = opt.parentIdExpr || 'parentId';
    for (const item of data) {
      let key = getField(item, keyExpr);
      if (key == null || byKey.has(key)) key = '__auto' + auto++;
      byKey.set(key, { key, data: item, parentKey: getField(item, parentExpr), level: 0, parent: null, children: [], hasChildren: false });
    }
    for (const node of byKey.values()) {
      const p = isRoot(node.parentKey, opt) ? undefined : byKey.get(node.parentKey);
      // evita ciclo: o pai não pode ser descendente do próprio nó
      let cyc = false;
      for (let a: TreeNode<T> | null | undefined = p; a; a = a.parent) {
        if (a === node) {
          cyc = true;
          break;
        }
      }
      if (p && !cyc) {
        node.parent = p;
        p.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  const all: TreeNode<T>[] = [];
  const walk = (list: TreeNode<T>[], level: number) => {
    for (const n of list) {
      n.level = level;
      n.hasChildren = n.children.length > 0 || (!!opt.hasItemsExpr && getField(n.data, opt.hasItemsExpr) === true);
      all.push(n);
      walk(n.children, level + 1);
    }
  };
  walk(roots, 0);
  return { roots, byKey, all };
}

/** Ordena os irmãos de cada nível (a hierarquia é mantida). */
export function sortTree<T>(tree: Tree<T>, sorts: SortDescriptor[], columns: ResolvedColumn<T>[], locale: string): void {
  if (!sorts.length) return;
  const sortList = (list: TreeNode<T>[]) => {
    if (list.length > 1) {
      const map = new Map<T, TreeNode<T>>();
      list.forEach((n) => map.set(n.data, n));
      const sorted = applySort(
        list.map((n) => n.data),
        sorts,
        columns,
        locale,
      );
      sorted.forEach((d, i) => (list[i] = map.get(d)!));
    }
    list.forEach((n) => sortList(n.children));
  };
  sortList(tree.roots);
  tree.all.length = 0;
  const walk = (list: TreeNode<T>[]) => list.forEach((n) => (tree.all.push(n), walk(n.children)));
  walk(tree.roots);
}

export interface TreeFilterResult<T> {
  /** Nós que passam no filtro/busca. */
  matched: Set<TreeNode<T>>;
  /** Nós exibidos: os que passam e todos os seus ancestrais. null = sem filtro. */
  visible: Set<TreeNode<T>> | null;
}

/** Filtra e busca; mantém os ancestrais dos nós encontrados (para mostrar o caminho). */
export function filterTree<T>(
  tree: Tree<T>,
  state: { filters: FilterDescriptor[]; headerFilters?: HeaderFilter[]; searchText: string },
  columns: ResolvedColumn<T>[],
  locale: string,
): TreeFilterResult<T> {
  const active = state.filters.length > 0 || !!(state.headerFilters && state.headerFilters.length) || !!state.searchText.trim();
  if (!active) return { matched: new Set(tree.all), visible: null };
  let rows = tree.all.map((n) => n.data);
  rows = applyFilters(rows, state.filters, columns);
  rows = applyHeaderFilters(rows, state.headerFilters, columns);
  rows = applySearch(rows, state.searchText, columns, locale);
  const pass = new Set(rows);
  const matched = new Set<TreeNode<T>>();
  const visible = new Set<TreeNode<T>>();
  for (const n of tree.all) {
    if (!pass.has(n.data)) continue;
    matched.add(n);
    for (let a: TreeNode<T> | null = n; a && !visible.has(a); a = a.parent) visible.add(a);
  }
  return { matched, visible };
}

export interface TreeRow<T = any> {
  node: TreeNode<T>;
  level: number;
  expanded: boolean;
  hasChildren: boolean;
  /** Passou no filtro (false = só aparece porque é ancestral de um que passou). */
  matched: boolean;
}

/**
 * Lista na ordem de exibição. Com filtro ativo, os ancestrais dos encontrados
 * aparecem abertos (a menos que o usuário tenha recolhido de propósito).
 */
export function flattenTree<T>(
  tree: Tree<T>,
  isExpanded: (node: TreeNode<T>) => boolean,
  filter?: TreeFilterResult<T>,
  collapsedOverride?: (node: TreeNode<T>) => boolean,
): TreeRow<T>[] {
  const out: TreeRow<T>[] = [];
  const visible = filter ? filter.visible : null;
  const walk = (list: TreeNode<T>[]) => {
    for (const n of list) {
      if (visible && !visible.has(n)) continue;
      const kids = visible ? n.children.filter((c) => visible.has(c)) : n.children;
      const hasChildren = visible ? kids.length > 0 : n.hasChildren;
      const expanded = hasChildren && (visible ? !(collapsedOverride && collapsedOverride(n)) : isExpanded(n));
      out.push({ node: n, level: n.level, expanded, hasChildren, matched: !filter || filter.matched.has(n) });
      if (expanded) walk(kids);
    }
  };
  walk(tree.roots);
  return out;
}

/** Descendentes de um nó (sem ele). */
export function descendants<T>(node: TreeNode<T>): TreeNode<T>[] {
  const out: TreeNode<T>[] = [];
  const walk = (n: TreeNode<T>) => n.children.forEach((c) => (out.push(c), walk(c)));
  walk(node);
  return out;
}

/**
 * Seleção em cascata: marcar um nó marca os descendentes; os ancestrais ficam marcados
 * só quando todos os filhos estão. Devolve o novo conjunto de chaves.
 */
export function toggleRecursive<T>(selected: Set<any>, node: TreeNode<T>, checked: boolean): Set<any> {
  const next = new Set(selected);
  [node, ...descendants(node)].forEach((n) => (checked ? next.add(n.key) : next.delete(n.key)));
  for (let p = node.parent; p; p = p.parent) {
    if (p.children.every((c) => next.has(c.key))) next.add(p.key);
    else next.delete(p.key);
  }
  return next;
}

/** Estado da caixa de um nó na seleção em cascata. */
export function checkState<T>(selected: Set<any>, node: TreeNode<T>): 'all' | 'some' | 'none' {
  if (!node.children.length) return selected.has(node.key) ? 'all' : 'none';
  const d = descendants(node);
  const n = d.filter((x) => selected.has(x.key)).length + (selected.has(node.key) ? 1 : 0);
  return n === 0 ? 'none' : n === d.length + 1 ? 'all' : 'some';
}

/**
 * Totais dos filhos ("rollup"): para cada nó com filhos, agrega o valor das folhas
 * descendentes (só as visíveis, se houver filtro). Folhas ficam com o próprio valor.
 */
export function rollupValues<T>(
  tree: Tree<T>,
  column: ResolvedColumn<T>,
  type: SummaryType,
  visible?: Set<TreeNode<T>> | null,
): Map<TreeNode<T>, number | null> {
  const out = new Map<TreeNode<T>, number | null>();
  const leafNums = (n: TreeNode<T>): number[] => {
    const kids = visible ? n.children.filter((c) => visible.has(c)) : n.children;
    if (!kids.length) {
      const v = toNumber(column.calculateCellValue ? column.calculateCellValue(n.data) : getField(n.data, column.dataField));
      return v == null ? [] : [v];
    }
    return kids.reduce((acc, c) => acc.concat(leafNums(c)), [] as number[]);
  };
  for (const n of tree.all) {
    if (visible && !visible.has(n)) continue;
    const kids = visible ? n.children.filter((c) => visible.has(c)) : n.children;
    if (!kids.length) continue;
    const nums = leafNums(n);
    let v: number | null = null;
    if (type === 'count') v = nums.length;
    else if (nums.length) {
      if (type === 'sum') v = nums.reduce((a, b) => a + b, 0);
      else if (type === 'avg') v = nums.reduce((a, b) => a + b, 0) / nums.length;
      else if (type === 'min') v = Math.min(...nums);
      else if (type === 'max') v = Math.max(...nums);
    }
    out.set(n, v);
  }
  return out;
}
