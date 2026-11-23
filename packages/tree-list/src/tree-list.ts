import { LitElement, css, html, nothing, unsafeCSS } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import {
  GRID_CSS,
  XLSX_MIME,
  applyThemeAttributes,
  computeSummary,
  excelDate,
  excelNumberFormat,
  formatValue,
  getCellValue,
  getConfig,
  parseFilterInput,
  resolveColumns,
  toDate,
  toNumber,
  writeXlsx,
  footerSpans,
  CONFIG_EVENT,
} from '@brunomouradev/data-grid/engine';
import type {
  Appearance,
  ColumnDef,
  Density,
  FilterDescriptor,
  ResolvedColumn,
  SortDescriptor,
  SummaryItem,
  SummaryType,
  ThemeName,
  XlsxCell,
} from '@brunomouradev/data-grid/engine';
import { buildTree, checkState, filterTree, flattenTree, rollupValues, sortTree, toggleRecursive } from './engine/tree';
import type { Tree, TreeFilterResult, TreeNode, TreeRow } from './engine/tree';
import { defaultTreeListMessages } from './messages';
import type { TreeListMessages } from './messages';

/** Coluna do TreeList: tudo da coluna do DataGrid, mais o total dos filhos. */
export interface TreeColumnDef<T = any> extends ColumnDef<T> {
  /**
   * Nos itens com filhos, mostra o total das folhas abaixo (ex.: "sum" num plano de contas).
   * Vale quando o próprio item não tem valor; use `aggregateAlways` para sempre mostrar o total.
   */
  aggregate?: SummaryType;
  aggregateAlways?: boolean;
}

export interface TreeRowEventDetail<T = any> {
  data: T;
  key: any;
  level: number;
  hasChildren: boolean;
  originalEvent: MouseEvent;
}

export interface TreeSelectionChangedDetail<T = any> {
  selectedRowKeys: any[];
  selectedRowsData: T[];
}

export interface ExpandedChangedDetail {
  /** Chaves dos itens abertos. */
  expandedRowKeys: any[];
}

function defaultLocale(): string {
  if (typeof document !== 'undefined' && document.documentElement.lang) return document.documentElement.lang;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'pt-BR';
}

const treeStyles = css`
  .tree-cell {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-width: 0;
  }
  .tree-toggle,
  .tree-spacer {
    flex: none;
    width: 20px;
    height: 20px;
    margin-right: 4px;
  }
  .tree-toggle {
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--_muted);
    cursor: pointer;
    font-size: 11px;
    line-height: 20px;
  }
  .tree-toggle:hover {
    background: var(--_bg-hover);
    color: var(--_text);
  }
  .tree-toggle:focus-visible {
    outline: 2px solid var(--_focus);
  }
  .tree-toggle .chev {
    display: inline-block;
    transition: transform 0.12s;
  }
  .tree-toggle[aria-expanded='true'] .chev {
    transform: rotate(90deg);
  }
  .tree-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tr.parent-row td {
    font-weight: 600;
  }
  tr.ancestor-only td {
    color: var(--_muted);
  }
  td .rollup {
    font-weight: 600;
  }
  .tl-info {
    color: var(--_muted);
    font-size: 13px;
  }
  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid var(--_border);
    border-top-color: var(--_primary);
    border-radius: 50%;
    animation: tl-spin 0.7s linear infinite;
  }
  @keyframes tl-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

/**
 * `<bm-tree-list>` — tabela em árvore: expandir/recolher, ordenação por nível, filtro e
 * busca mantendo o caminho, seleção em cascata, total dos filhos, carregamento sob demanda
 * e exportação Excel (com tópicos) e CSV.
 *
 * @fires row-click         - detail: TreeRowEventDetail
 * @fires row-dblclick      - detail: TreeRowEventDetail
 * @fires selection-changed - detail: TreeSelectionChangedDetail
 * @fires expanded-changed  - detail: ExpandedChangedDetail
 * @fires content-ready     - detail: { visibleCount, totalCount }
 */
export class BmTreeList<T = any> extends LitElement {
  static styles = [unsafeCSS(GRID_CSS), treeStyles];

  // ---------------------------------------------------------------- props

  /** Lista plana (id + parentId) ou hierárquica (com itemsExpr). */
  @property({ attribute: false }) dataSource: T[] = [];

  @property({ attribute: false }) columns?: TreeColumnDef<T>[];

  @property({ attribute: 'key-expr' }) keyExpr = 'id';

  @property({ attribute: 'parent-id-expr' }) parentIdExpr = 'parentId';

  /** Dados hierárquicos: campo com os filhos (ex.: "items"). */
  @property({ attribute: 'items-expr' }) itemsExpr?: string;

  /** Valor do pai que indica raiz (padrão: null/undefined/""). */
  @property({ attribute: false }) rootValue?: any;

  /** Campo booleano: o item tem filhos que ainda não foram carregados (use com loadChildren). */
  @property({ attribute: 'has-items-expr' }) hasItemsExpr?: string;

  /** Carregamento sob demanda: chamado ao abrir um item sem filhos carregados (lista plana). */
  @property({ attribute: false }) loadChildren?: (parent: T) => Promise<T[]>;

  /** dataField da coluna que mostra a árvore (recuo e botão). Padrão: a primeira visível. */
  @property({ attribute: 'tree-column' }) treeColumn?: string;

  /** Começa com tudo aberto. Atributo: auto-expand-all (ou ="false"). */
  @property({
    attribute: 'auto-expand-all',
    converter: { fromAttribute: (v: string | null) => v !== 'false', toAttribute: (v: boolean) => String(v) },
  })
  autoExpandAll = false;

  /** Itens abertos no início (chaves). */
  @property({ attribute: false }) expandedRowKeys?: any[];

  @property({ attribute: 'selection-mode', reflect: true }) selectionMode: 'none' | 'single' | 'multiple' = 'none';

  /** Seleção em cascata (marcar o pai marca os filhos). Padrão: true. */
  @property({ attribute: false }) recursiveSelection = true;

  @property({ type: Boolean, attribute: 'show-filter-row', reflect: true }) showFilterRow = false;
  @property({ type: Boolean, attribute: 'show-search-panel', reflect: true }) showSearchPanel = false;
  @property({ type: Boolean, attribute: 'show-export-button', reflect: true }) showExportButton = false;
  @property({ type: Boolean, attribute: 'show-expand-buttons', reflect: true }) showExpandButtons = false;
  @property({ type: Boolean, attribute: 'show-row-lines', reflect: true }) showRowLines = true;
  @property({ type: Boolean, attribute: 'show-column-lines', reflect: true }) showColumnLines = false;
  @property({ type: Boolean, attribute: 'row-alternation-enabled', reflect: true }) rowAlternationEnabled = false;
  @property({ type: Boolean, attribute: 'hover-state-disabled', reflect: true }) hoverStateDisabled = false;

  /** Totais no rodapé (sobre os itens que passam no filtro). */
  @property({ attribute: false }) summary: SummaryItem[] = [];

  @property({ attribute: 'export-file-name' }) exportFileName = 'arvore';

  @property({
    attribute: 'export-formats',
    converter: { fromAttribute: (v: string | null) => (v || 'xlsx,csv').split(',').map((x) => x.trim()).filter((x) => x === 'xlsx' || x === 'csv') },
  })
  exportFormats: ('xlsx' | 'csv')[] = ['xlsx', 'csv'];

  /** Classe(s) da linha conforme os dados; o nome também vira um "part". */
  @property({ attribute: false }) rowClass?: (row: T, level: number) => string | null | undefined | false;

  @property() theme?: ThemeName;
  @property() appearance?: Appearance;
  @property() density?: Density;

  @property({ noAccessor: true })
  get locale(): string {
    return this._localeOverride || getConfig().locale || defaultLocale();
  }
  set locale(value: string) {
    const old = this.locale;
    this._localeOverride = value || undefined;
    this.requestUpdate('locale', old);
  }
  private _localeOverride?: string;

  @property({ attribute: false }) messages: Partial<TreeListMessages> = {};
  @property({ attribute: 'no-data-text' }) noDataText?: string;

  // ---------------------------------------------------------------- state

  @state() private _sorts: SortDescriptor[] = [];
  @state() private _filterTexts: Record<string, string> = {};
  @state() private _searchText = '';
  /** Com _allOpen=true guarda os recolhidos; senão, os abertos. */
  @state() private _expSet = new Set<any>();
  @state() private _allOpen = false;
  /** Itens recolhidos pelo usuário enquanto há filtro (o filtro abre o caminho sozinho). */
  @state() private _filterCollapsed = new Set<any>();
  @state() private _selected = new Set<any>();
  @state() private _loadingKeys = new Set<any>();
  @state() private _loaded: T[] = [];
  @state() private _exportOpen = false;

  private _columns: ResolvedColumn<T>[] = [];
  private _tree: Tree<T> = { roots: [], byKey: new Map(), all: [] };
  private _filter: TreeFilterResult<T> = { matched: new Set(), visible: null };
  private _rows: TreeRow<T>[] = [];
  private _rollups = new Map<string, Map<TreeNode<T>, number | null>>();
  private _filterTimer?: ReturnType<typeof setTimeout>;
  private _treeDirty = true;

  private _onConfig = () => {
    applyThemeAttributes(this);
    this.requestUpdate('locale', undefined);
  };

  private _onDocPointerDown = (e: PointerEvent) => {
    if (!this._exportOpen) return;
    const inside = e.composedPath().some((n) => n instanceof HTMLElement && (n.classList.contains('export-menu') || n.classList.contains('export-btn')));
    if (!inside) this._exportOpen = false;
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(CONFIG_EVENT, this._onConfig);
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(CONFIG_EVENT, this._onConfig);
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    clearTimeout(this._filterTimer);
  }

  private get _msg(): TreeListMessages {
    return { ...defaultTreeListMessages(this.locale), ...(this.messages || {}) };
  }

  // ---------------------------------------------------------------- processamento

  protected willUpdate(changed: PropertyValues<this>): void {
    applyThemeAttributes(this);
    // dados novos: descarta os filhos carregados sob demanda da lista anterior
    if (changed.has('dataSource') && !changed.has('_loaded' as keyof BmTreeList)) this._loaded = [];
    const data = (this.dataSource || []).concat(this._loaded);
    if (changed.has('columns') || changed.has('dataSource')) {
      this._columns = resolveColumns(this.columns, data);
      if (changed.has('columns')) {
        this._sorts = this._columns
          .filter((c) => c.sortOrder)
          .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
          .map((c) => ({ field: c.dataField, order: c.sortOrder! }));
        const texts: Record<string, string> = {};
        this._columns.forEach((c) => c.filterValue != null && c.filterValue !== '' && (texts[c.dataField] = String(c.filterValue)));
        this._filterTexts = texts;
      }
    }
    if (changed.has('autoExpandAll')) {
      this._allOpen = this.autoExpandAll;
      this._expSet = new Set();
    }
    if (changed.has('expandedRowKeys') && this.expandedRowKeys) {
      this._allOpen = false;
      this._expSet = new Set(this.expandedRowKeys);
    }
    const structural = ['dataSource', 'keyExpr', 'parentIdExpr', 'itemsExpr', 'rootValue', 'hasItemsExpr', 'columns', '_loaded'];
    if (this._treeDirty || structural.some((k) => changed.has(k as keyof BmTreeList))) {
      this._tree = buildTree(data, {
        keyExpr: this.keyExpr,
        parentIdExpr: this.parentIdExpr,
        itemsExpr: this.itemsExpr,
        rootValue: this.rootValue,
        hasItemsExpr: this.hasItemsExpr,
      });
      this._treeDirty = false;
      sortTree(this._tree, this._sorts, this._columns, this.locale);
    } else if (changed.has('_sorts' as keyof BmTreeList) || changed.has('locale')) {
      sortTree(this._tree, this._sorts, this._columns, this.locale);
    }
    this._filter = filterTree(this._tree, { filters: this._filters(), searchText: this._searchText }, this._columns, this.locale);
    this._rows = flattenTree(
      this._tree,
      (n) => (this._allOpen ? !this._expSet.has(n.key) : this._expSet.has(n.key)),
      this._filter.visible ? this._filter : undefined,
      (n) => this._filterCollapsed.has(n.key),
    );
    this._rollups = new Map();
    for (const c of this._columns as (ResolvedColumn<T> & TreeColumnDef<T>)[]) {
      if (c.aggregate) this._rollups.set(c.dataField, rollupValues(this._tree, c, c.aggregate, this._filter.visible));
    }
  }

  protected updated(): void {
    this.dispatchEvent(
      new CustomEvent('content-ready', {
        detail: { visibleCount: this._rows.length, totalCount: this._tree.all.length },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _filters(): FilterDescriptor[] {
    const out: FilterDescriptor[] = [];
    for (const col of this._columns) {
      const text = this._filterTexts[col.dataField];
      if (!text) continue;
      const parsed = parseFilterInput(text, col.dataType, col.selectedFilterOperation);
      if (parsed) out.push({ field: col.dataField, ...parsed });
    }
    return out;
  }

  private _emit<D>(name: string, detail: D) {
    this.dispatchEvent(new CustomEvent<D>(name, { detail, bubbles: true, composed: true }));
  }

  // ---------------------------------------------------------------- API pública

  /** Reprocessa (use depois de alterar o array "por dentro"). */
  refresh(): void {
    this._treeDirty = true;
    this._columns = resolveColumns(this.columns, (this.dataSource || []).concat(this._loaded));
    this.requestUpdate();
  }

  /** Nó da árvore pela chave (com data, level, parent e children). */
  getNode(key: any): TreeNode<T> | undefined {
    return this._tree.byKey.get(key);
  }

  isRowExpanded(key: any): boolean {
    const n = this._tree.byKey.get(key);
    if (!n) return false;
    if (this._filter.visible) return !this._filterCollapsed.has(key);
    return this._allOpen ? !this._expSet.has(key) : this._expSet.has(key);
  }

  /** Abre o item (e carrega os filhos, se for sob demanda). */
  async expandRow(key: any): Promise<void> {
    await this._setExpanded(key, true);
  }

  collapseRow(key: any): void {
    void this._setExpanded(key, false);
  }

  /** Abre todos os itens (só os já carregados, no carregamento sob demanda). */
  expandAll(): void {
    this._allOpen = true;
    this._expSet = new Set();
    this._filterCollapsed = new Set();
    this._emitExpanded();
  }

  collapseAll(): void {
    this._allOpen = false;
    this._expSet = new Set();
    if (this._filter.visible) this._filterCollapsed = new Set(this._tree.all.filter((n) => n.children.length).map((n) => n.key));
    this._emitExpanded();
  }

  /** Chaves dos itens abertos. */
  getExpandedRowKeys(): any[] {
    return this._tree.all.filter((n) => n.hasChildren && this.isRowExpanded(n.key)).map((n) => n.key);
  }

  /** Abre os ancestrais e rola até o item. */
  async navigateToRow(key: any): Promise<boolean> {
    const n = this._tree.byKey.get(key);
    if (!n) return false;
    for (let p = n.parent; p; p = p.parent) if (!this.isRowExpanded(p.key)) await this._setExpanded(p.key, true, false);
    this._emitExpanded();
    await this.updateComplete;
    const tr = this.renderRoot.querySelector<HTMLElement>(`tr[data-key="${CSS.escape(String(key))}"]`);
    if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: 'nearest' });
    return !!tr;
  }

  getSelectedRowKeys(): any[] {
    return Array.from(this._selected);
  }

  getSelectedRowsData(): T[] {
    return this._tree.all.filter((n) => this._selected.has(n.key)).map((n) => n.data);
  }

  /** Seleciona pelas chaves (com cascata, se recursiveSelection). */
  selectRows(keys: any[], preserve = false): void {
    let next = preserve ? new Set(this._selected) : new Set<any>();
    if (this.selectionMode === 'single') {
      next = new Set(keys.length ? [keys[keys.length - 1]] : []);
    } else {
      for (const k of keys) {
        const n = this._tree.byKey.get(k);
        if (!n) continue;
        next = this.recursiveSelection ? toggleRecursive(next, n, true) : (next.add(k), next);
      }
    }
    this._setSelection(next);
  }

  deselectRows(keys: any[]): void {
    let next = new Set(this._selected);
    for (const k of keys) {
      const n = this._tree.byKey.get(k);
      if (n && this.recursiveSelection) next = toggleRecursive(next, n, false);
      else next.delete(k);
    }
    this._setSelection(next);
  }

  selectAll(): void {
    if (this.selectionMode !== 'multiple') return;
    const pool = this._filter.visible ? Array.from(this._filter.visible) : this._tree.all;
    this._setSelection(new Set(pool.map((n) => n.key)));
  }

  clearSelection(): void {
    this._setSelection(new Set());
  }

  searchByText(text: string): void {
    this._searchText = text;
    this._filterCollapsed = new Set();
  }

  /** Filtro como na linha de filtro (ex.: ">100"). */
  filterColumn(dataField: string, text: string): void {
    this._filterTexts = { ...this._filterTexts, [dataField]: text };
    this._filterCollapsed = new Set();
  }

  clearFilter(): void {
    this._filterTexts = {};
    this._searchText = '';
    this._filterCollapsed = new Set();
  }

  sortBy(sorts: SortDescriptor[]): void {
    this._sorts = sorts.slice();
  }

  clearSorting(): void {
    this._sorts = [];
  }

  /** Dados das linhas exibidas, na ordem da tela. */
  getVisibleRows(): T[] {
    return this._rows.map((r) => r.node.data);
  }

  /** CSV com todos os itens que passam no filtro (abertos ou não); a coluna da árvore vem com recuo. */
  getCsv(separator = ';'): string {
    const cols = this._visibleColumns();
    const esc = (v: string) => (/["\r\n]/.test(v) || v.indexOf(separator) >= 0 ? '"' + v.replace(/"/g, '""') + '"' : v);
    const lines = [cols.map((c) => esc(c.caption)).join(separator)];
    const tc = this._treeColumnField(cols);
    for (const n of this._exportNodes()) {
      lines.push(
        cols
          .map((c) => {
            const txt = this._cellText(n, c);
            return esc(c.dataField === tc ? '  '.repeat(n.level) + txt : txt);
          })
          .join(separator),
      );
    }
    return lines.join('\r\n');
  }

  exportToCsv(fileName = this.exportFileName): void {
    this._exportOpen = false;
    this._download(new Blob(['﻿' + this.getCsv()], { type: 'text/csv;charset=utf-8' }), fileName.endsWith('.csv') ? fileName : fileName + '.csv');
  }

  /** Excel (.xlsx): níveis viram tópicos (botões +/− do Excel), números e datas de verdade, totais dos filhos. */
  getXlsx(sheetName = 'Dados'): Uint8Array {
    const cols = this._visibleColumns();
    const tc = this._treeColumnField(cols);
    const fmts = cols.map((c) =>
      typeof c.format === 'function' ? null : c.dataType === 'number' ? excelNumberFormat(c.format, this.locale) : c.dataType === 'date' ? 14 : null,
    );
    const rows: (XlsxCell | null)[][] = [cols.map((c) => ({ v: c.caption, bold: true, fill: 2, border: 1 } as XlsxCell))];
    const outline = [0];
    for (const n of this._exportNodes()) {
      const parent = n.children.length > 0;
      rows.push(
        cols.map((c, i) => {
          const roll = this._rollup(n, c);
          const raw = roll !== undefined ? roll : getCellValue(n.data, c);
          const bold = parent;
          if (raw == null || raw === '') return { v: null, bold };
          if (typeof c.format !== 'function' && c.dataType === 'number' && toNumber(raw) != null) return { v: toNumber(raw), numFmt: fmts[i], bold };
          if (typeof c.format !== 'function' && c.dataType === 'date' && toDate(raw)) return { v: excelDate(toDate(raw)!), numFmt: 14, bold };
          return { v: this._cellText(n, c), bold, indent: c.dataField === tc ? n.level : 0 };
        }),
      );
      outline.push(Math.min(7, n.level));
    }
    if (this.summary && this.summary.length) {
      const res = this._summaryResults();
      rows.push(
        cols.map((c) => {
          const items = res.filter((r) => (r.showInColumn || r.column) === c.dataField);
          if (items.length === 1 && items[0].value != null) {
            return { v: items[0].value, numFmt: items[0].summaryType === 'count' ? null : excelNumberFormat(c.format, this.locale), bold: true, border: 2 };
          }
          return { v: items.map((r) => r.text).join(' · '), bold: true, border: 2 };
        }),
      );
      outline.push(0);
    }
    return writeXlsx({ name: sheetName, rows, freezeRows: 1, outlineLevels: outline, autoFilterRows: undefined });
  }

  exportToExcel(fileName = this.exportFileName): void {
    this._exportOpen = false;
    this._download(new Blob([this.getXlsx()], { type: XLSX_MIME }), fileName.endsWith('.xlsx') ? fileName : fileName + '.xlsx');
  }

  // ---------------------------------------------------------------- internos

  private _download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Todos os nós que passam no filtro (ou todos), em profundidade, independentemente de estarem abertos. */
  private _exportNodes(): TreeNode<T>[] {
    const vis = this._filter.visible;
    return vis ? this._tree.all.filter((n) => vis.has(n)) : this._tree.all;
  }

  private _visibleColumns(): ResolvedColumn<T>[] {
    return this._columns.filter((c) => c.visible);
  }

  private _treeColumnField(cols: ResolvedColumn<T>[]): string | undefined {
    if (this.treeColumn && cols.some((c) => c.dataField === this.treeColumn)) return this.treeColumn;
    return cols.length ? cols[0].dataField : undefined;
  }

  /** Total dos filhos para a célula (undefined = usa o valor do próprio item). */
  private _rollup(n: TreeNode<T>, col: ResolvedColumn<T>): number | null | undefined {
    const map = this._rollups.get(col.dataField);
    if (!map || !map.has(n)) return undefined;
    const own = getCellValue(n.data, col);
    const always = (col as TreeColumnDef<T>).aggregateAlways;
    if (!always && own != null && own !== '') return undefined;
    return map.get(n)!;
  }

  private _cellText(n: TreeNode<T>, col: ResolvedColumn<T>): string {
    const msg = this._msg;
    const roll = this._rollup(n, col);
    if (roll !== undefined) return roll == null ? '' : formatValue(roll, 'number', col.format, this.locale, n.data, msg);
    return formatValue(getCellValue(n.data, col), col.dataType, col.format, this.locale, n.data, msg);
  }

  private _summaryResults() {
    const msg = this._msg;
    const captions: Record<string, string> = { sum: msg.sum, avg: msg.avg, min: msg.min, max: msg.max, count: msg.count };
    const rows = Array.from(this._filter.matched).map((n) => n.data);
    return (this.summary || []).map((item) => computeSummary(rows, item, this._columns, this.locale, captions));
  }

  private _emitExpanded() {
    this._emit<ExpandedChangedDetail>('expanded-changed', { expandedRowKeys: this.getExpandedRowKeys() });
  }

  private async _setExpanded(key: any, open: boolean, emit = true): Promise<void> {
    const n = this._tree.byKey.get(key);
    if (!n || !n.hasChildren) return;
    if (this._filter.visible) {
      const next = new Set(this._filterCollapsed);
      if (open) next.delete(key);
      else next.add(key);
      this._filterCollapsed = next;
    }
    const next = new Set(this._expSet);
    // _allOpen: o conjunto guarda os recolhidos
    if (open === this._allOpen) next.delete(key);
    else next.add(key);
    this._expSet = next;
    if (open && !n.children.length && this.loadChildren && !this._loadingKeys.has(key)) {
      this._loadingKeys = new Set(this._loadingKeys).add(key);
      try {
        const kids = await this.loadChildren(n.data);
        this._loaded = this._loaded.concat(kids || []);
      } catch (err) {
        console.error('[bm-tree-list] erro em loadChildren', err);
      } finally {
        const l = new Set(this._loadingKeys);
        l.delete(key);
        this._loadingKeys = l;
      }
    }
    if (emit) this._emitExpanded();
  }

  private _setSelection(next: Set<any>) {
    this._selected = next;
    this._emit<TreeSelectionChangedDetail<T>>('selection-changed', {
      selectedRowKeys: this.getSelectedRowKeys(),
      selectedRowsData: this.getSelectedRowsData(),
    });
  }

  private _onCheck(n: TreeNode<T>, checked: boolean) {
    if (this.recursiveSelection) this._setSelection(toggleRecursive(this._selected, n, checked));
    else {
      const next = new Set(this._selected);
      if (checked) next.add(n.key);
      else next.delete(n.key);
      this._setSelection(next);
    }
  }

  private _onRowClick(r: TreeRow<T>, e: MouseEvent) {
    const t = e.composedPath()[0] as HTMLElement;
    const fromControl = !!t && !!t.closest && !!t.closest('input, button');
    if (this.selectionMode === 'single' && !fromControl) this._setSelection(new Set([r.node.key]));
    this._emit<TreeRowEventDetail<T>>('row-click', { data: r.node.data, key: r.node.key, level: r.level, hasChildren: r.hasChildren, originalEvent: e });
  }

  private _onRowKey(r: TreeRow<T>, e: KeyboardEvent) {
    // setas no botão da árvore: → abre, ← fecha (ou vai para o pai)
    if (e.key === 'ArrowRight' && r.hasChildren && !r.expanded) {
      e.preventDefault();
      void this.expandRow(r.node.key);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (r.expanded) this.collapseRow(r.node.key);
      else if (r.node.parent) {
        const btn = this.renderRoot.querySelector<HTMLElement>(`tr[data-key="${CSS.escape(String(r.node.parent.key))}"] .tree-toggle`);
        if (btn) btn.focus();
      }
    }
  }

  private _onHeaderClick(col: ResolvedColumn<T>, e: MouseEvent) {
    if (!col.allowSorting) return;
    const cur = this._sorts.find((s) => s.field === col.dataField);
    const next = !cur ? 'asc' : cur.order === 'asc' ? 'desc' : null;
    if (e.shiftKey) {
      const others = this._sorts.filter((s) => s.field !== col.dataField);
      this._sorts = next ? (cur ? this._sorts.map((s) => (s.field === col.dataField ? { ...s, order: next } : s)) : [...others, { field: col.dataField, order: next }]) : others;
    } else {
      this._sorts = next ? [{ field: col.dataField, order: next }] : [];
    }
  }

  private _onFilterInput(col: ResolvedColumn<T>, value: string, immediate = false) {
    clearTimeout(this._filterTimer);
    const apply = () => this.filterColumn(col.dataField, value);
    if (immediate) apply();
    else this._filterTimer = setTimeout(apply, 250);
  }

  // ---------------------------------------------------------------- render

  private _alignClass(col: ResolvedColumn<T>) {
    return col.alignment === 'right' ? 'align-right' : col.alignment === 'center' ? 'align-center' : '';
  }

  private _renderToolbar(msg: TreeListMessages) {
    const hasFilters = !!this._searchText || Object.keys(this._filterTexts).some((k) => this._filterTexts[k]);
    if (!this.showSearchPanel && !this.showExportButton && !this.showExpandButtons) return nothing;
    const formats = this.exportFormats && this.exportFormats.length ? this.exportFormats : ['csv'];
    return html`<div class="toolbar" part="toolbar">
      <slot name="toolbar"></slot>
      <span class="tl-info" aria-live="polite">
        ${msg.info.replace('{0}', String(this._filter.matched.size)).replace('{1}', String(this._tree.all.length))}
      </span>
      <span class="spacer"></span>
      ${hasFilters ? html`<button class="btn" type="button" @click=${() => this.clearFilter()}>${msg.clearFilters}</button>` : nothing}
      ${this.showExpandButtons
        ? html`<button class="btn" type="button" @click=${() => this.expandAll()}>${msg.expandAll}</button>
            <button class="btn" type="button" @click=${() => this.collapseAll()}>${msg.collapseAll}</button>`
        : nothing}
      ${this.showExportButton
        ? formats.length === 1
          ? html`<button class="btn export-btn" type="button" part="export-button" @click=${() => (formats[0] === 'xlsx' ? this.exportToExcel() : this.exportToCsv())}>
              ${formats[0] === 'xlsx' ? msg.exportXlsx : msg.exportCsv}
            </button>`
          : html`<span class="export-anchor">
              <button
                class="btn export-btn ${this._exportOpen ? 'active' : ''}"
                type="button"
                part="export-button"
                aria-haspopup="menu"
                aria-expanded=${this._exportOpen ? 'true' : 'false'}
                @click=${() => (this._exportOpen = !this._exportOpen)}
              >
                ${msg.exportMenu} <span class="caret" aria-hidden="true">▾</span>
              </button>
              ${this._exportOpen
                ? html`<div class="export-menu" role="menu" part="export-menu">
                    <button type="button" role="menuitem" @click=${() => this.exportToExcel()}>${msg.exportXlsx}</button>
                    <button type="button" role="menuitem" @click=${() => this.exportToCsv()}>${msg.exportCsv}</button>
                  </div>`
                : nothing}
            </span>`
        : nothing}
      ${this.showSearchPanel
        ? html`<input
            class="input search"
            part="search"
            type="search"
            aria-label=${msg.searchPlaceholder}
            placeholder=${msg.searchPlaceholder}
            .value=${live(this._searchText)}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              clearTimeout(this._filterTimer);
              this._filterTimer = setTimeout(() => this.searchByText(v), 250);
            }}
          />`
        : nothing}
    </div>`;
  }

  private _renderHeader(cols: ResolvedColumn<T>[], msg: TreeListMessages) {
    const multi = this.selectionMode === 'multiple';
    const pool = this._filter.visible ? Array.from(this._filter.visible) : this._tree.all;
    const sel = pool.filter((n) => this._selected.has(n.key)).length;
    const allState = !pool.length || sel === 0 ? 'none' : sel === pool.length ? 'all' : 'some';
    return html`<thead>
      <tr class="headers" part="header-row">
        ${multi
          ? html`<th class="select-col" scope="col">
              <input
                type="checkbox"
                aria-label=${msg.selectAll}
                .checked=${live(allState === 'all')}
                .indeterminate=${allState === 'some'}
                @change=${(e: Event) => ((e.target as HTMLInputElement).checked ? this.selectAll() : this.clearSelection())}
              />
            </th>`
          : nothing}
        ${cols.map((col) => {
          const idx = this._sorts.findIndex((s) => s.field === col.dataField);
          const sort = idx >= 0 ? this._sorts[idx] : undefined;
          return html`<th
            scope="col"
            part="header-cell"
            data-field=${col.dataField}
            class="${this._alignClass(col)} ${col.allowSorting ? 'sortable' : ''}"
            aria-sort=${col.allowSorting ? (sort ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none') : nothing}
            tabindex=${col.allowSorting ? '0' : nothing}
            title=${col.caption}
            @click=${(e: MouseEvent) => this._onHeaderClick(col, e)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._onHeaderClick(col, e as unknown as MouseEvent);
              }
            }}
          >
            <span class="th-content">
              <span class="th-text">${col.caption}</span>
              ${sort ? html`<span class="sort-icon" aria-hidden="true">${sort.order === 'asc' ? '▲' : '▼'}</span>` : nothing}
              ${sort && this._sorts.length > 1 ? html`<span class="sort-index">${idx + 1}</span>` : nothing}
            </span>
          </th>`;
        })}
      </tr>
      ${this.showFilterRow
        ? html`<tr class="filters" part="filter-row">
            ${multi ? html`<th class="select-col"></th>` : nothing}
            ${cols.map((col) => {
              if (!col.allowFiltering) return html`<th></th>`;
              const value = this._filterTexts[col.dataField] || '';
              const label = msg.filterPlaceholder + ': ' + col.caption;
              if (col.dataType === 'boolean') {
                return html`<th>
                  <select class="input" aria-label=${label} @change=${(e: Event) => this._onFilterInput(col, (e.target as HTMLSelectElement).value, true)}>
                    <option value="" ?selected=${value === ''}>${msg.all}</option>
                    <option value="true" ?selected=${value === 'true'}>${msg.yes}</option>
                    <option value="false" ?selected=${value === 'false'}>${msg.no}</option>
                  </select>
                </th>`;
              }
              return html`<th>
                <input
                  class="input ${this._alignClass(col)}"
                  type=${col.dataType === 'date' ? 'date' : 'text'}
                  aria-label=${label}
                  placeholder=${col.dataType === 'number' ? '= > < …' : msg.filterPlaceholder}
                  .value=${live(value)}
                  @input=${(e: Event) => this._onFilterInput(col, (e.target as HTMLInputElement).value, col.dataType === 'date')}
                />
              </th>`;
            })}
          </tr>`
        : nothing}
    </thead>`;
  }

  private _renderRow(r: TreeRow<T>, i: number, cols: ResolvedColumn<T>[], tc: string | undefined, msg: TreeListMessages) {
    const n = r.node;
    const multi = this.selectionMode === 'multiple';
    const selected = this._selected.has(n.key);
    const check = multi ? (this.recursiveSelection ? checkState(this._selected, n) : selected ? 'all' : 'none') : 'none';
    let extra = '';
    if (this.rowClass) {
      try {
        extra = String(this.rowClass(n.data, n.level) || '').replace(/[^\w\s-]/g, '').trim();
      } catch (err) {
        console.error('[bm-tree-list] erro em rowClass', err);
      }
    }
    const loading = this._loadingKeys.has(n.key);
    return html`<tr
      class="data ${selected ? 'selected' : ''} ${i % 2 === 1 ? 'alt' : ''} ${r.hasChildren ? 'parent-row' : ''} ${r.matched ? '' : 'ancestor-only'} ${extra ? 'bm-custom ' + extra : ''}"
      part="row ${selected ? 'row-selected' : ''} ${extra}"
      data-key=${String(n.key)}
      aria-level=${n.level + 1}
      aria-expanded=${r.hasChildren ? String(r.expanded) : nothing}
      aria-selected=${this.selectionMode !== 'none' ? String(selected) : nothing}
      @click=${(e: MouseEvent) => this._onRowClick(r, e)}
      @dblclick=${(e: MouseEvent) =>
        this._emit<TreeRowEventDetail<T>>('row-dblclick', { data: n.data, key: n.key, level: n.level, hasChildren: r.hasChildren, originalEvent: e })}
    >
      ${multi
        ? html`<td class="select-col">
            <input
              type="checkbox"
              aria-label=${msg.selectRow}
              .checked=${live(check === 'all')}
              .indeterminate=${check === 'some'}
              @change=${(e: Event) => this._onCheck(n, (e.target as HTMLInputElement).checked)}
            />
          </td>`
        : nothing}
      ${cols.map((col) => {
        const roll = this._rollup(n, col);
        const content =
          roll !== undefined
            ? html`<span class="rollup">${roll == null ? '' : formatValue(roll, 'number', col.format, this.locale, n.data, msg)}</span>`
            : col.cellRender
              ? col.cellRender(getCellValue(n.data, col), n.data)
              : formatValue(getCellValue(n.data, col), col.dataType, col.format, this.locale, n.data, msg);
        if (col.dataField !== tc) {
          return html`<td part="cell" class="${this._alignClass(col)} ${typeof col.cssClass === 'string' ? col.cssClass : ''}">${content}</td>`;
        }
        return html`<td part="cell tree-cell" class="${typeof col.cssClass === 'string' ? col.cssClass : ''}">
          <span class="tree-cell" style="padding-left:${n.level * 20}px">
            ${r.hasChildren
              ? html`<button
                  class="tree-toggle"
                  type="button"
                  aria-expanded=${String(r.expanded)}
                  aria-label=${(r.expanded ? msg.collapseRow : msg.expandRow) + ': ' + this._cellText(n, col)}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    void this._setExpanded(n.key, !r.expanded);
                  }}
                  @keydown=${(e: KeyboardEvent) => this._onRowKey(r, e)}
                >
                  ${loading ? html`<span class="spinner" role="status" aria-label=${msg.loading}></span>` : html`<span class="chev" aria-hidden="true">▶</span>`}
                </button>`
              : html`<span class="tree-spacer"></span>`}
            <span class="tree-text">${content}</span>
          </span>
        </td>`;
      })}
    </tr>`;
  }

  private _renderFooter(cols: ResolvedColumn<T>[]) {
    if (!this.summary || !this.summary.length) return nothing;
    const res = this._summaryResults();
    return html`<tfoot>
      <tr part="summary-row">
        ${this.selectionMode === 'multiple' ? html`<td class="select-col"></td>` : nothing}
        ${(() => {
          // um total ocupa também as colunas vizinhas vazias (colspan), para não quebrar linha
          const items = cols.map((col) => res.filter((r) => (r.showInColumn || r.column) === col.dataField));
          const spans = footerSpans(
            cols.map((col, i) => ({
              filled: items[i].length > 0,
              align: col.alignment === 'right' ? 'right' : col.alignment === 'center' ? 'center' : 'left',
            })),
          );
          return spans.map((sp) => {
            const col = cols[sp.owner >= 0 ? sp.owner : sp.start];
            const list = sp.owner >= 0 ? items[sp.owner] : [];
            return html`<td class=${this._alignClass(col)} colspan=${sp.span > 1 ? sp.span : nothing} part="summary-cell">
              ${list.map((r) => html`<span class="summary-item" title=${r.text}>${r.text}</span>`)}
            </td>`;
          });
        })()}
      </tr>
    </tfoot>`;
  }

  protected render(): TemplateResult {
    const msg = this._msg;
    const cols = this._visibleColumns();
    const tc = this._treeColumnField(cols);
    const multi = this.selectionMode === 'multiple';
    return html`<div class="grid" part="grid">
      ${this._renderToolbar(msg)}
      <div class="scroller" part="scroller">
        <table role="treegrid" aria-multiselectable=${multi ? 'true' : nothing}>
          <colgroup>
            ${multi ? html`<col style="width:40px" />` : nothing}
            ${cols.map((c) => {
              const w = c.width != null ? (typeof c.width === 'number' ? c.width + 'px' : c.width) : '';
              return html`<col style=${(w ? `width:${w};` : '') + (c.minWidth != null ? `min-width:${c.minWidth}px;` : '')} />`;
            })}
          </colgroup>
          ${this._renderHeader(cols, msg)}
          <tbody>
            ${this._rows.length
              ? this._rows.map((r, i) => this._renderRow(r, i, cols, tc, msg))
              : html`<tr class="no-data">
                  <td colspan=${cols.length + (multi ? 1 : 0)} part="no-data">${this.noDataText || msg.noData}</td>
                </tr>`}
          </tbody>
          ${this._renderFooter(cols)}
        </table>
      </div>
    </div>`;
  }
}

/** Registra o elemento (idempotente). */
export function defineTreeList(tagName = 'bm-tree-list'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, class extends BmTreeList {});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bm-tree-list': BmTreeList;
  }
}
