import { LitElement, html, nothing } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  applyColumnLayout,
  applyFilters,
  applyHeaderFilters,
  applySearch,
  headerFilterItems,
  headerFilterKey,
  computeSummary,
  defaultColumnLayout,
  mergeColumnLayout,
  moveColumnBefore,
  moveColumnToVisibleIndex,
  sameColumnLayout,
  setColumnVisibility,
  setColumnWidths,
  setColumnFixed,
  fixedFirst,
  footerSpans,
  getCellValue,
  getField,
  formatValue,
  parseFilterInput,
  query,
  resolveColumns,
  toCsv,
  toXlsx,
  XLSX_MIME,
} from './engine/index';
import type { ResolvedColumn } from './engine/index';
import type {
  ColumnDef,
  ColumnLayoutItem,
  FilterDescriptor,
  FilterOperation,
  GroupDescriptor,
  GroupExpansion,
  GridRowItem,
  GroupInfo,
  HeaderFilter,
  HeaderFilterItem,
  PagingOptions,
  QueryResult,
  SelectionMode,
  SortDescriptor,
  SummaryItem,
  CellTemplateRenderer,
} from './engine/types';
import { defaultMessages } from './messages';
import type { DataGridMessages } from './messages';
import { applyThemeAttributes, CONFIG_EVENT, getConfig } from './engine/theme';
import type { Appearance, Density, ThemeName } from './engine/theme';
import { gridStyles } from './styles';

export interface RowEventDetail<T = any> {
  data: T;
  key: any;
  rowIndex: number;
  originalEvent: MouseEvent;
}

export interface SelectionChangedDetail<T = any> {
  selectedRowKeys: any[];
  selectedRowsData: T[];
}

export interface ContentReadyDetail {
  totalCount: number;
  pageIndex: number;
  pageCount: number;
}

export interface ColumnLayoutChangedDetail {
  /** Ordem e visibilidade de todas as colunas. Salve e devolva em `columnLayout`. */
  layout: ColumnLayoutItem[];
}

export type ExportFormat = 'xlsx' | 'csv';

export interface ExportingDetail {
  format: ExportFormat;
  /** Pode ser alterado no listener. */
  fileName: string;
  selectedOnly: boolean;
}

export interface ExportOptions {
  /** Só as linhas selecionadas. */
  selectedOnly?: boolean;
  /** Nome da aba (Excel). */
  sheetName?: string;
}

/** Estilo de uma linha: `{ background: '#d1f4e0', color: '#116329' }` (também aceita "background-color"). */
/** Opções que podem ir no `options` (todas as propriedades, menos `dataSource`). */
export const DATA_GRID_OPTION_KEYS = ["remoteData","remoteHeaderFilter","columns","keyExpr","paging","selectionMode","showFilterRow","showSearchPanel","showExportButton","showRowLines","showColumnLines","columnAutoWidth","rowAlternationEnabled","hoverStateDisabled","summary","theme","appearance","density","locale","messages","noDataText","cellStyles","cellTemplateRenderer","stateStoring","columnChooserEnabled","allowColumnResizing","allowColumnReordering","columnLayout","virtualScrolling","rowClass","rowStyle","showFilterPanel","showHeaderFilter","showGroupPanel","grouping","groupSummary","autoExpandAll","exportFormats","exportSheetName","exportFileName"] as const;

/**
 * Configuração da grid num objeto só, como o `dtOptions` do DataTables:
 * `<bm-data-grid [options]="opcoes" [dataSource]="dados">`.
 */
export type DataGridOptions<T = any> = Partial<Pick<BmDataGrid<T>, (typeof DATA_GRID_OPTION_KEYS)[number]>>;

const OPTION_KEY_SET = new Set<string>(DATA_GRID_OPTION_KEYS);

export type RowStyle = Record<string, string | number | null | undefined>;

/** Tudo o que o usuário pode mudar na grid (para salvar e restaurar). */
export interface GridState {
  /** Ordem, visibilidade, largura e colunas fixas. */
  columns: ColumnLayoutItem[];
  sorts: SortDescriptor[];
  /** Texto digitado na linha de filtro, por coluna (ex.: { valor: '>100' }). */
  filterTexts: Record<string, string>;
  headerFilters: HeaderFilter[];
  /** Operador escolhido no menu de cada coluna (ex.: { valor: ">=" }). */
  filterOperations?: Record<string, FilterOperation>;
  searchText: string;
  groups: GroupDescriptor[];
  pageSize: number;
  pageIndex?: number;
  selectedRowKeys?: any[];
}

export interface StateStoringOptions {
  /** Padrão: true quando há storageKey ou customLoad. */
  enabled?: boolean;
  /** Chave no localStorage/sessionStorage. Use uma por tela: "faturas-grid". */
  storageKey?: string;
  /** Padrão: "localStorage". "custom" usa customSave/customLoad (ex.: salvar no servidor). */
  type?: 'localStorage' | 'sessionStorage' | 'custom';
  /** Espera (ms) antes de gravar depois de uma mudança. Padrão: 300. */
  savingTimeout?: number;
  /** Também salvar a página atual. Padrão: false. */
  savePageIndex?: boolean;
  /** Também salvar as linhas selecionadas. Padrão: false. */
  saveSelection?: boolean;
  customSave?: (state: GridState) => void | Promise<void>;
  customLoad?: () => GridState | null | undefined | Promise<GridState | null | undefined>;
}

/** O que a grid pede ao servidor (dados remotos). */
export interface RemoteLoadOptions {
  /** Registros a pular (página * tamanho). */
  skip: number;
  /** Quantos trazer. 0 = todos (usado na exportação). */
  take: number;
  sorts: SortDescriptor[];
  /** Filtros já interpretados (linha de filtro): { field, operation, value }. */
  filters: FilterDescriptor[];
  /** Filtros do funil: { field, type: 'include' | 'exclude', values } (valores normalizados). */
  headerFilters: HeaderFilter[];
  searchText: string;
  /** Colunas onde a busca deve procurar. */
  searchFields: string[];
  /** Cancela a requisição quando o usuário muda algo antes de ela terminar. */
  signal: AbortSignal;
}

export interface RemoteLoadResult<T = any> {
  /** Linhas da página pedida. */
  data: T[];
  /** Total de registros que passam nos filtros (para a paginação). */
  totalCount: number;
  /** Valores dos totais do rodapé, na ordem de `summary` (opcional; sem eles, os totais são da página). */
  summary?: (number | null)[];
}

export interface GroupingChangedDetail {
  /** Níveis de agrupamento, do primeiro ao último. Salve e devolva em `grouping`. */
  groups: GroupDescriptor[];
}

type DragOrigin = 'header' | 'chooser' | 'group';
type DropMark = { kind: 'header' | 'chooser' | 'group'; before: string | null };

export interface StateChangedDetail {
  sorts: SortDescriptor[];
  filters: FilterDescriptor[];
  /** Filtros do cabeçalho (lista de valores). Devolva com `setHeaderFilters`. */
  headerFilters: HeaderFilter[];
  searchText: string;
  pageIndex: number;
  pageSize: number;
}

interface HeaderFilterPopup {
  field: string;
  left: number;
  top: number;
  search: string;
  /** Chaves marcadas. */
  draft: Set<string>;
  items: HeaderFilterItem[];
}


// ---------------------------------------------------------------- operadores do filtro

const STRING_OPS: FilterOperation[] = ['contains', 'notcontains', 'startswith', 'endswith', '=', '<>'];
const RANGE_OPS: FilterOperation[] = ['=', '<>', '<', '>', '<=', '>=', 'between'];
const OP_SYMBOL: Record<string, string> = {
  notcontains: '∌',
  startswith: 'a…',
  endswith: '…a',
  '=': '=',
  '<>': '≠',
  '<': '<',
  '>': '>',
  '<=': '≤',
  '>=': '≥',
  between: '↔',
};
const searchIcon = html`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 1a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 6.5 1Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>`;

const DEFAULT_PAGING: Required<PagingOptions> = {
  enabled: true,
  pageSize: 20,
  pageIndex: 0,
  allowedPageSizes: [10, 20, 50, 100],
  showPageSizeSelector: true,
  showInfo: true,
};

/** Normaliza nomes de classe/part: aceita string com espaços ou array; remove caracteres inválidos. */
function cssNames(value: string | string[] | null | undefined | false): string {
  if (!value) return '';
  const list = Array.isArray(value) ? value : String(value).split(/\s+/);
  return list
    .map((x) => String(x || '').replace(/[^\w-]/g, ''))
    .filter(Boolean)
    .join(' ');
}

function defaultLocale(): string {
  if (typeof document !== 'undefined' && document.documentElement.lang) return document.documentElement.lang;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'pt-BR';
}

/**
 * `<bm-data-grid>` — DataGrid com ordenação, filtro por coluna, busca,
 * paginação, seleção, totais e exportação CSV.
 *
 * @fires row-click          - Clique em uma linha. detail: RowEventDetail
 * @fires row-dblclick       - Duplo clique em uma linha. detail: RowEventDetail
 * @fires selection-changed  - Seleção alterada. detail: SelectionChangedDetail
 * @fires state-changed      - Ordenação, filtro, busca ou página alterados. detail: StateChangedDetail
 * @fires content-ready      - Dados processados e renderizados. detail: ContentReadyDetail
 * @fires column-layout-changed - Colunas reordenadas, mostradas ou escondidas. detail: ColumnLayoutChangedDetail
 * @fires exporting         - Antes de exportar; cancelável (preventDefault). detail: ExportingDetail
 * @fires row-enter          - Enter numa linha (teclado). detail: { data, key, rowIndex }
 * @fires copy-rows          - Ctrl+C copiou. detail: { text, rowCount }
 * @fires load-error         - Erro em remoteData. detail: { error }
 * @fires grouping-changed   - Agrupamento alterado. detail: GroupingChangedDetail
 *
 * @cssprop --bm-color-primary, --bm-color-bg, --bm-color-border ... (veja @brunomouradev/themes)
 */
export class BmDataGrid<T = any> extends LitElement {
  static styles = gridStyles;

  // ---------------------------------------------------------------- props

  /**
   * Dados no servidor: a grid chama esta função com página, ordenação, filtros e busca, e mostra
   * o que voltar (`{ data, totalCount, summary? }`). Com ela, `dataSource` é ignorado.
   * Agrupamento e funil passam a valer só para a página carregada.
   */
  @property({ attribute: false }) remoteData?: (options: RemoteLoadOptions) => Promise<RemoteLoadResult<T>>;

  /** Valores distintos de uma coluna para o funil, no modo remoteData (opcional). */
  @property({ attribute: false }) remoteHeaderFilter?: (dataField: string, options: RemoteLoadOptions) => Promise<any[]>;

  /** Mostra o indicador de carregando (use quando você mesmo busca os dados). */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Array de dados. Se você alterar o array "por dentro", chame `refresh()`. */
  @property({ attribute: false }) dataSource: T[] = [];

  /**
   * Todas as opções num objeto só (`DataGridOptions`), como o `dtOptions` do DataTables.
   * Cada chave vale como se fosse a propriedade com o mesmo nome. Trocar o objeto aplica as
   * chaves dele de novo. Não repita a mesma opção no objeto e no HTML: vale a última aplicada.
   */
  @property({ attribute: false, noAccessor: true })
  get options(): DataGridOptions<T> | undefined {
    return this._options;
  }
  set options(value: DataGridOptions<T> | undefined) {
    const old = this._options;
    this._options = value;
    if (value) {
      for (const key of Object.keys(value)) {
        if (OPTION_KEY_SET.has(key)) (this as any)[key] = (value as any)[key];
      }
    }
    this.requestUpdate('options', old);
  }
  private _options?: DataGridOptions<T>;

  /** Definição das colunas. Sem colunas, elas são geradas a partir da primeira linha. */
  @property({ attribute: false }) columns?: ColumnDef<T>[];

  /** Campo que identifica a linha (ex.: "id"). Sem ele, o próprio objeto vira a chave. */
  @property({ attribute: 'key-expr' }) keyExpr?: string;

  @property({ attribute: false }) paging: PagingOptions = {};

  @property({ attribute: 'selection-mode', reflect: true }) selectionMode: SelectionMode = 'none';

  @property({ type: Boolean, attribute: 'show-filter-row', reflect: true }) showFilterRow = false;

  @property({ type: Boolean, attribute: 'show-search-panel', reflect: true }) showSearchPanel = false;

  @property({ type: Boolean, attribute: 'show-export-button', reflect: true }) showExportButton = false;

  @property({ type: Boolean, attribute: 'show-row-lines', reflect: true }) showRowLines = true;

  @property({ type: Boolean, attribute: 'show-column-lines', reflect: true }) showColumnLines = false;

  /**
   * Colunas do tamanho do conteúdo (como numa <table> comum), sem cortar o texto com "…".
   * Se não couber, aparece a rolagem lateral. Largura definida na coluna ou arrastada vira largura mínima.
   */
  @property({ type: Boolean, attribute: 'column-auto-width', reflect: true }) columnAutoWidth = false;

  @property({ type: Boolean, attribute: 'row-alternation-enabled', reflect: true }) rowAlternationEnabled = false;

  @property({ type: Boolean, attribute: 'hover-state-disabled', reflect: true }) hoverStateDisabled = false;

  /** Totais exibidos no rodapé. */
  @property({ attribute: false }) summary: SummaryItem[] = [];

  /**
   * Visual: "default", "bootstrap4", "bootstrap5", "tailwind" ou "material".
   * Sem o atributo, vale o `configure({ theme })` global.
   */
  @property() theme?: ThemeName;

  /** "light", "dark" ou "auto" (segue o sistema operacional). */
  @property() appearance?: Appearance;

  /** Altura das linhas: "compact", "standard" ou "comfortable". */
  @property() density?: Density;

  /** Locale para números, datas e textos. Padrão: configure({ locale }), <html lang> ou o idioma do navegador. */
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

  /** configure() foi chamado: reaplica tema e locale. */
  private _onConfig = () => {
    applyThemeAttributes(this);
    this.requestUpdate('locale', undefined);
  };

  /** Sobrescreve textos da interface. */
  @property({ attribute: false }) messages: Partial<DataGridMessages> = {};

  @property({ attribute: 'no-data-text' }) noDataText?: string;

  /**
   * CSS extra injetado dentro do Shadow DOM — use para estilizar o conteúdo de `cellRender`
   * (o CSS da página não atravessa o Shadow DOM). Ex.: ".badge { ... }"
   */
  @property({ attribute: false }) cellStyles = '';

  /**
   * Desenha as células das colunas com `cellTemplate`. Recebe um elemento fora do Shadow DOM
   * (o CSS da página vale nele) e devolve, se quiser, uma função de limpeza.
   * No Angular, a diretiva `bmCellTemplate` preenche isto sozinha.
   */
  @property({ attribute: false }) cellTemplateRenderer?: CellTemplateRenderer<T>;

  /** Células com template pedidas no último render: chave → dados. */
  private _tplWanted = new Map<string, { name: string; value: any; row: T; col: ResolvedColumn<T> }>();
  /** Células com template já desenhadas. */
  private _tplActive = new Map<string, { el: HTMLElement; name: string; value: any; row: T; dispose?: () => void }>();
  private _tplIds = new WeakMap<object, number>();
  private _tplSeq = 0;

  private _tplKey(row: T, col: ResolvedColumn<T>): string {
    let k: any = this._keyOf(row);
    if (k !== null && typeof k === 'object') {
      let id = this._tplIds.get(k);
      if (id === undefined) this._tplIds.set(k, (id = ++this._tplSeq));
      k = 'o' + id;
    } else k = 'k' + String(k);
    return k + '|' + col.dataField;
  }

  private _tplSlots = new Map<string, string>();
  private _tplSlot(key: string): string {
    let n = this._tplSlots.get(key);
    if (!n) this._tplSlots.set(key, (n = 'bm-cell-' + ++this._tplSeq));
    return n;
  }

  /** Cria, atualiza e remove os elementos das células com template (fora do Shadow DOM). */
  private _syncTemplates(): void {
    const renderer = this.cellTemplateRenderer;
    for (const [key, a] of this._tplActive) {
      const w = this._tplWanted.get(key);
      if (!w || !renderer || w.row !== a.row || w.value !== a.value || w.name !== a.name) {
        try { a.dispose?.(); } catch (e) { console.error(e); }
        a.el.remove();
        this._tplActive.delete(key);
        if (!w) this._tplSlots.delete(key);
      }
    }
    if (!renderer) return;
    for (const [key, w] of this._tplWanted) {
      if (this._tplActive.has(key)) continue;
      const el = document.createElement('div');
      el.slot = this._tplSlot(key);
      el.className = 'bm-cell-template';
      el.style.display = 'contents';
      this.appendChild(el);
      let dispose: void | (() => void) = undefined;
      try {
        dispose = renderer({ name: w.name, element: el, value: w.value, row: w.row, column: w.col });
      } catch (e) { console.error(e); }
      this._tplActive.set(key, { el, name: w.name, value: w.value, row: w.row, dispose: dispose || undefined });
    }
  }

  private _clearTemplates(): void {
    this._tplWanted.clear();
    this._syncTemplates();
  }

  /**
   * Salva e restaura sozinho o estado da grid (colunas, ordenação, filtros, busca,
   * agrupamento, tamanho da página). Ex.: `{ storageKey: 'faturas-grid' }`.
   */
  @property({ attribute: false }) stateStoring?: StateStoringOptions;

  /** Botão "Colunas" na barra: lista para marcar/desmarcar e arrastar colunas. */
  @property({ type: Boolean, attribute: 'column-chooser-enabled', reflect: true }) columnChooserEnabled = false;

  /** Permite mudar a largura das colunas arrastando a borda do cabeçalho (duplo clique ajusta ao conteúdo). */
  @property({ type: Boolean, attribute: 'allow-column-resizing', reflect: true }) allowColumnResizing = false;

  /** Permite arrastar o cabeçalho para mudar a ordem das colunas. */
  @property({ type: Boolean, attribute: 'allow-column-reordering', reflect: true }) allowColumnReordering = false;

  /**
   * Layout salvo (ordem e visibilidade), como recebido em `column-layout-changed`.
   * Sem ele, vale a definição de `columns` (as colunas padrão).
   */
  @property({ attribute: false }) columnLayout?: ColumnLayoutItem[];

  /**
   * Rolagem virtual: mostra todas as linhas numa rolagem só (sem páginas), mas só
   * desenha as que estão perto da área visível. Use com muitos dados (dezenas de milhares).
   * A grid precisa de altura definida (ex.: `height: 600px`).
   */
  @property({ type: Boolean, attribute: 'virtual-scrolling', reflect: true }) virtualScrolling = false;

  /**
   * Classe(s) da linha conforme os dados. O nome também vira um "part", então o CSS da
   * página alcança a linha: `bm-data-grid::part(titulo-33) { background: #d1f4e0; }`.
   * Ex.: `(t) => t.tipo_titulo === 33 ? 'titulo-33' : ''`
   */
  @property({ attribute: false }) rowClass?: (row: T, rowIndex: number) => string | string[] | null | undefined | false;

  /**
   * Estilo da linha conforme os dados, sem precisar de CSS.
   * Ex.: `(t) => t.tipo_titulo === 33 ? { background: '#d1f4e0', color: '#116329' } : null`
   */
  @property({ attribute: false }) rowStyle?: (row: T, rowIndex: number) => RowStyle | null | undefined | false;

  /** Barra com os filtros ativos (linha de filtro, funis e busca), cada um com × para remover. */
  @property({ type: Boolean, attribute: 'show-filter-panel', reflect: true }) showFilterPanel = false;

  /** Ícone de funil no cabeçalho: abre a lista de valores da coluna para marcar/desmarcar. */
  @property({ type: Boolean, attribute: 'show-header-filter', reflect: true }) showHeaderFilter = false;

  /** Painel acima da tabela: arraste um cabeçalho para lá para agrupar por aquela coluna. */
  @property({ type: Boolean, attribute: 'show-group-panel', reflect: true }) showGroupPanel = false;

  /**
   * Agrupamento atual (como recebido em `grouping-changed`). Sem ele, vale o
   * `groupIndex` das colunas.
   */
  @property({ attribute: false }) grouping?: GroupDescriptor[];

  /** Totais exibidos em cada linha de grupo. Use `alignByColumn` para mostrar na coluna. */
  @property({ attribute: false }) groupSummary: SummaryItem[] = [];

  /** Os grupos começam expandidos. Use `auto-expand-all="false"` para começar recolhido. */
  @property({
    attribute: 'auto-expand-all',
    converter: { fromAttribute: (v: string | null) => v !== 'false', toAttribute: (v: boolean) => String(v) },
  })
  autoExpandAll = true;

  /**
   * Formatos do botão de exportar. Com mais de um, o botão abre um menu.
   * Atributo: `export-formats="xlsx,csv"`.
   */
  @property({
    attribute: 'export-formats',
    converter: {
      fromAttribute: (v: string | null) =>
        (v || 'xlsx,csv').split(',').map((x) => x.trim()).filter((x) => x === 'xlsx' || x === 'csv'),
    },
  })
  exportFormats: ExportFormat[] = ['xlsx', 'csv'];

  /** Nome da aba no Excel. */
  @property({ attribute: 'export-sheet-name' }) exportSheetName = 'Dados';

  /** Nome do arquivo usado pelas exportações (sem extensão). */
  @property({ attribute: 'export-file-name' }) exportFileName = 'dados';

  // ---------------------------------------------------------------- state

  @state() private _sorts: SortDescriptor[] = [];
  @state() private _filterTexts: Record<string, string> = {};
  /** Operador escolhido no menu de cada coluna da linha de filtro. */
  @state() private _filterOps: Record<string, FilterOperation> = {};
  @state() private _opMenu: { field: string; left: number; top: number } | null = null;
  @state() private _searchText = '';
  @state() private _pageIndex = 0;
  @state() private _pageSize = DEFAULT_PAGING.pageSize;
  @state() private _selectedKeys = new Set<any>();
  @state() private _layout: ColumnLayoutItem[] = [];
  @state() private _chooserOpen = false;
  @state() private _exportOpen = false;
  @state() private _scrollTop = 0;
  @state() private _remoteRows: T[] = [];
  @state() private _remoteTotal = 0;
  @state() private _remoteLoading = false;
  @state() private _remoteError: unknown = null;
  private _remoteSummary: (number | null)[] | null = null;
  private _remoteKey = '';
  private _remoteAbort?: AbortController;
  /** Linhas já vistas no modo remoto (para getSelectedRowsData). */
  private _seenRows = new Map<any, T>();
  /** Célula com foco (teclado): índice na lista de linhas da página/rolagem e coluna. */
  @state() private _focusRi = 0;
  @state() private _focusCi = 0;
  @state() private _status = '';
  private _statusTimer?: ReturnType<typeof setTimeout>;
  private _focusAfterPage: 'first' | 'last' | null = null;
  /** Larguras durante o arrastar da borda (antes de gravar no layout). */
  @state() private _liveWidths: Record<string, number> | null = null;
  private _resize: { field: string; startX: number; startW: number; min: number; pointerId: number } | null = null;
  private _fxStyle?: HTMLStyleElement;
  private _fxCss = '';
  private _stateLoaded = false;
  private _stateSaved = '';
  private _stateTimer?: ReturnType<typeof setTimeout>;
  @state() private _viewH = 600;
  /** Altura medida de uma linha (rolagem virtual). */
  @state() private _rowH = 37;
  private _theadH = 0;
  private _scrollRaf = 0;
  private _resetScroll = false;
  private _resizeObs?: ResizeObserver;
  @state() private _ghost: { text: string; x: number; y: number } | null = null;
  @state() private _dropMark: DropMark | null = null;
  @state() private _headerFilters: HeaderFilter[] = [];
  @state() private _hf: HeaderFilterPopup | null = null;
  @state() private _groups: GroupDescriptor[] = [];
  @state() private _expansion: GroupExpansion = { all: true, overrides: {} };

  private _columns: ResolvedColumn<T>[] = [];
  /** Colunas na ordem do layout, com a visibilidade do layout. */
  private _ordered: ResolvedColumn<T>[] = [];
  private _drag: {
    field: string;
    text: string;
    origin: DragOrigin;
    x: number;
    y: number;
    pointerId: number;
    active: boolean;
  } | null = null;
  private _suppressClick = false;
  private _result: QueryResult<T> = { rows: [], pageRows: [], totalCount: 0, pageCount: 1, pageIndex: 0 };
  private _resultDirty = true;
  private _filterTimer?: ReturnType<typeof setTimeout>;
  private _lastClickedKey: any = undefined;

  // ---------------------------------------------------------------- lifecycle

  protected willUpdate(changed: PropertyValues<this>): void {
    applyThemeAttributes(this);
    if (changed.has('columns') || changed.has('dataSource')) {
      const prevFields = this._columns.map((c) => c.dataField).join('|');
      this._columns = resolveColumns(this.columns, this.dataSource || []);
      const fields = this._columns.map((c) => c.dataField).join('|');
      if (changed.has('columns') || fields !== prevFields) {
        this._initColumnState();
        this._layout = mergeColumnLayout(this._columns, this.columnLayout);
      }
    }
    if (changed.has('columnLayout') && !changed.has('columns')) {
      this._layout = mergeColumnLayout(this._columns, this.columnLayout);
    }
    if (changed.has('grouping') && this.grouping) {
      this._groups = this._cleanGroups(this.grouping);
    }
    if (changed.has('autoExpandAll')) {
      this._expansion = { all: this.autoExpandAll, overrides: {} };
    }
    this._ordered = applyColumnLayout(this._columns, this._layout);
    // Rolagem virtual: volta ao topo quando a ordem ou o filtro mudam
    if (
      this.virtualScrolling &&
      (['_sorts', '_filterTexts', '_searchText', '_headerFilters', '_groups'] as const).some((k) => changed.has(k as keyof BmDataGrid))
    ) {
      this._resetScroll = true;
    }
    if (changed.has('paging')) {
      const p = this._paging;
      this._pageSize = p.enabled ? p.pageSize : 0;
      this._pageIndex = p.pageIndex;
    }
    if (!this._stateLoaded && this._columns.length && this._storingOn) {
      this._stateLoaded = true;
      this._loadState();
      this._ordered = applyColumnLayout(this._columns, this._layout);
      this._resultDirty = true;
    }
    if (
      this._resultDirty ||
      changed.has('dataSource') ||
      changed.has('columns') ||
      changed.has('paging') ||
      changed.has('virtualScrolling') ||
      changed.has('locale') ||
      changed.has('_sorts' as keyof BmDataGrid) ||
      changed.has('_filterTexts' as keyof BmDataGrid) ||
      changed.has('_searchText' as keyof BmDataGrid) ||
      changed.has('_pageIndex' as keyof BmDataGrid) ||
      changed.has('_pageSize' as keyof BmDataGrid) ||
      changed.has('_layout' as keyof BmDataGrid) ||
      changed.has('_groups' as keyof BmDataGrid) ||
      changed.has('_headerFilters' as keyof BmDataGrid) ||
      changed.has('_expansion' as keyof BmDataGrid) ||
      changed.has('_remoteRows' as keyof BmDataGrid) ||
      changed.has('remoteData')
    ) {
      if (this.remoteData) {
        // a página já vem filtrada e ordenada do servidor; agrupamento só sobre ela
        const page = query(this._remoteRows, this._ordered, {
          filters: [],
          headerFilters: [],
          searchText: '',
          sorts: [],
          pageIndex: 0,
          pageSize: 0,
          groups: this._groups,
          groupExpansion: this._expansion,
        }, this.locale);
        const size = this._pageSize;
        this._result = {
          ...page,
          totalCount: this._remoteTotal,
          pageCount: size > 0 ? Math.max(1, Math.ceil(this._remoteTotal / size)) : 1,
          pageIndex: this._pageIndex,
        };
        this._resultDirty = false;
        this._contentChanged = true;
        return;
      }
      this._result = query(
        this.dataSource || [],
        this._ordered,
        {
          filters: this._filters(),
          headerFilters: this._headerFilters,
          searchText: this._searchText,
          sorts: this._sorts,
          pageIndex: this.virtualScrolling ? 0 : this._pageIndex,
          pageSize: this.virtualScrolling ? 0 : this._pageSize,
          groups: this._groups,
          groupExpansion: this._expansion,
        },
        this.locale,
      );
      this._pageIndex = this._result.pageIndex;
      this._resultDirty = false;
      this._contentChanged = true;
    }
  }

  private _contentChanged = false;

  private _extraStyle?: HTMLStyleElement;

  protected updated(changed: PropertyValues<this>): void {
    this._updateFixedCss();
    this._scheduleSave();
    if (this.remoteData) this._maybeLoadRemote();
    if (this._focusAfterPage) {
      const where = this._focusAfterPage;
      this._focusAfterPage = null;
      void this._moveFocus(where === 'first' ? 0 : this._navRows().length - 1, this._focusCi);
    }
    this._syncTemplates();
    if (changed.has('cellStyles')) {
      if (!this._extraStyle) {
        this._extraStyle = document.createElement('style');
        this.renderRoot.appendChild(this._extraStyle);
      }
      this._extraStyle.textContent = this.cellStyles || '';
    }
    const scroller = this.renderRoot.querySelector('.scroller') as HTMLElement | null;
    if (scroller && !this._resizeObs && typeof ResizeObserver !== 'undefined') {
      this._resizeObs = new ResizeObserver(() => {
        const h = scroller.clientHeight;
        if (h && Math.abs(h - this._viewH) > 1) this._viewH = h;
        this._updateFixedCss();
      });
      this._resizeObs.observe(scroller);
    }
    if (this.virtualScrolling && scroller) {
      if (this._resetScroll) {
        this._resetScroll = false;
        if (scroller.scrollTop) scroller.scrollTop = 0;
        this._scrollTop = 0;
      }
      const thead = this.renderRoot.querySelector('thead') as HTMLElement | null;
      this._theadH = thead ? thead.offsetHeight : 0;
      // Mede a altura real das linhas (tema, fonte, densidade)
      const rows = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('tbody tr.data, tbody tr.group-row')).slice(0, 20);
      if (rows.length) {
        const avg = rows.reduce((s, r) => s + r.offsetHeight, 0) / rows.length;
        if (avg > 0 && Math.abs(avg - this._rowH) > 0.5) this._rowH = avg;
      }
    }
    const headerRow = this.renderRoot.querySelector('thead tr.headers') as HTMLElement | null;
    if (headerRow) this.style.setProperty('--_header-h', headerRow.offsetHeight + 'px');
    if (this._contentChanged) {
      this._contentChanged = false;
      this._emit<ContentReadyDetail>('content-ready', {
        totalCount: this._result.totalCount,
        pageIndex: this._result.pageIndex,
        pageCount: this._result.pageCount,
      });
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(CONFIG_EVENT, this._onConfig);
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    document.addEventListener('keydown', this._onDocKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(CONFIG_EVENT, this._onConfig);
    clearTimeout(this._filterTimer);
    clearTimeout(this._stateTimer);
    cancelAnimationFrame(this._scrollRaf);
    if (this._resizeObs) this._resizeObs.disconnect();
    this._resizeObs = undefined;
    this._endDrag();
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    document.removeEventListener('keydown', this._onDocKeyDown);
    this._clearTemplates();
  }

  /** Fecha o seletor de colunas ao clicar fora dele. */
  private _onDocPointerDown = (e: PointerEvent) => {
    if (!this._chooserOpen && !this._hf && !this._exportOpen && !this._opMenu) return;
    const path = e.composedPath();
    const inside = (...cls: string[]) => path.some((n) => n instanceof HTMLElement && cls.some((c) => n.classList.contains(c)));
    if (this._chooserOpen && !inside('chooser', 'chooser-btn')) this._chooserOpen = false;
    if (this._hf && !inside('hf-popup', 'hf-btn')) this._hf = null;
    if (this._exportOpen && !inside('export-menu', 'export-btn')) this._exportOpen = false;
    if (this._opMenu && !inside('op-menu', 'op-btn')) this._opMenu = null;
  };

  private _onScroll = (e: Event) => {
    if (this._hf) this._closeHeaderFilter();
    if (!this.virtualScrolling) return;
    const el = e.currentTarget as HTMLElement;
    cancelAnimationFrame(this._scrollRaf);
    this._scrollRaf = requestAnimationFrame(() => (this._scrollTop = el.scrollTop));
  };

  private _onDocKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (this._chooserOpen) this._chooserOpen = false;
    if (this._exportOpen) this._exportOpen = false;
    if (this._opMenu) this._opMenu = null;
    if (this._hf) this._closeHeaderFilter(true);
  };

  private get _paging(): Required<PagingOptions> {
    return { ...DEFAULT_PAGING, ...(this.paging || {}) };
  }

  private get _msg(): DataGridMessages {
    return { ...defaultMessages(this.locale), ...(this.messages || {}) };
  }

  private _initColumnState() {
    this._sorts = this._columns
      .filter((c) => c.sortOrder)
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((c) => ({ field: c.dataField, order: c.sortOrder! }));
    const texts: Record<string, string> = {};
    for (const c of this._columns) {
      if (c.filterValue != null && c.filterValue !== '') texts[c.dataField] = String(c.filterValue);
    }
    this._filterTexts = texts;
    this._headerFilters = this._columns
      .filter((c) => c.filterValues && c.filterValues.length)
      .map((c) => ({
        field: c.dataField,
        type: c.filterType === 'exclude' ? 'exclude' : 'include',
        values: c.filterValues!.map((v) => headerFilterKey(v, c)),
      }));
    this._groups = this.grouping
      ? this._cleanGroups(this.grouping)
      : this._columns
          .filter((c) => c.groupIndex != null && c.groupIndex >= 0)
          .sort((a, b) => a.groupIndex! - b.groupIndex!)
          .map((c) => ({ field: c.dataField, order: c.sortOrder || 'asc' }));
  }

  /** Remove níveis repetidos ou de colunas que não existem. */
  private _cleanGroups(groups: GroupDescriptor[]): GroupDescriptor[] {
    const seen = new Set<string>();
    return groups.filter((g) => {
      if (seen.has(g.field) || !this._columns.some((c) => c.dataField === g.field)) return false;
      seen.add(g.field);
      return true;
    }).map((g) => ({ field: g.field, order: g.order === 'desc' ? 'desc' : 'asc' }));
  }

  private _filters(): FilterDescriptor[] {
    const out: FilterDescriptor[] = [];
    for (const col of this._columns) {
      const text = this._filterTexts[col.dataField];
      if (!text) continue;
      const parsed = parseFilterInput(text, col.dataType, this._filterOp(col), this.locale);
      if (parsed) out.push({ field: col.dataField, ...parsed });
    }
    return out;
  }

  /** Operador atual da coluna: o escolhido no menu, o da coluna ou o padrão do tipo. */
  private _filterOp(col: ResolvedColumn<T>): FilterOperation {
    return this._filterOps[col.dataField] || col.selectedFilterOperation || (col.dataType === 'string' ? 'contains' : '=');
  }

  private _emit<D>(name: string, detail: D) {
    this.dispatchEvent(new CustomEvent<D>(name, { detail, bubbles: true, composed: true }));
  }

  private _emitState() {
    this._emit<StateChangedDetail>('state-changed', {
      sorts: this._sorts.slice(),
      filters: this._filters(),
      headerFilters: this.getHeaderFilters(),
      searchText: this._searchText,
      pageIndex: this._pageIndex,
      pageSize: this._pageSize,
    });
  }

  private _keyOf(row: T): any {
    return this.keyExpr ? getField(row, this.keyExpr) : row;
  }

  // ---------------------------------------------------------------- API pública

  /** Reprocessa os dados (use depois de alterar o array `dataSource` "por dentro"). */
  refresh(): void {
    this._columns = resolveColumns(this.columns, this.dataSource || []);
    this._resultDirty = true;
    this.requestUpdate();
  }

  // ------------------------------------------------ colunas

  /** Ordem e visibilidade atuais de todas as colunas (para salvar). */
  getColumnLayout(): ColumnLayoutItem[] {
    return this._layout.map((x) => ({ ...x }));
  }

  /** Aplica um layout salvo. Colunas desconhecidas são ignoradas e as novas entram na posição padrão. */
  setColumnLayout(layout: ColumnLayoutItem[]): void {
    this._setLayout(mergeColumnLayout(this._columns, layout));
  }

  /** Volta às colunas padrão (definidas em `columns`). */
  /** Largura da coluna em px (`null` volta à largura padrão). */
  setColumnWidth(dataField: string, width: number | null): void {
    this._setLayout(setColumnWidths(this._layout, { [dataField]: width }));
  }

  /** Ajusta a largura da coluna ao conteúdo visível (cabeçalho e linhas desenhadas). */
  autoFitColumn(dataField: string): void {
    const need = this._contentWidth(dataField);
    if (!need) return;
    this._setLayout(setColumnWidths(this._layout, { [dataField]: need }));
  }

  /** Fixa a coluna à esquerda (ela continua visível ao rolar para o lado). */
  setColumnFixed(dataField: string, fixed: boolean): void {
    this._setLayout(setColumnFixed(this._layout, dataField, fixed));
  }

  resetColumnLayout(): void {
    this._setLayout(defaultColumnLayout(this._columns));
  }

  /** Mostra ou esconde uma coluna. A última coluna visível não pode ser escondida. */
  setColumnVisible(dataField: string, visible: boolean): void {
    this._setLayout(setColumnVisibility(this._layout, dataField, visible));
  }

  /** Move uma coluna para a posição `visibleIndex` entre as visíveis. */
  moveColumn(dataField: string, visibleIndex: number): void {
    this._setLayout(moveColumnToVisibleIndex(this._layout, dataField, visibleIndex));
  }

  showColumnChooser(): void {
    this._chooserOpen = true;
  }

  hideColumnChooser(): void {
    this._chooserOpen = false;
  }

  // ------------------------------------------------ estado (salvar/restaurar)

  /** Estado atual: colunas, ordenação, filtros, busca, agrupamento, página e seleção. */
  getState(): GridState {
    return {
      columns: this.getColumnLayout(),
      sorts: this._sorts.map((s) => ({ ...s })),
      filterTexts: Object.keys(this._filterTexts).reduce((o, k) => {
        if (this._filterTexts[k]) o[k] = this._filterTexts[k];
        return o;
      }, {} as Record<string, string>),
      headerFilters: this.getHeaderFilters(),
      filterOperations: { ...this._filterOps },
      searchText: this._searchText,
      groups: this.getGrouping(),
      pageSize: this._pageSize,
      pageIndex: this._pageIndex,
      selectedRowKeys: this.getSelectedRowKeys(),
    };
  }

  /** Aplica um estado (de getState ou salvo). Campos ausentes ficam como estão. */
  setState(state: Partial<GridState>): void {
    this._applyState(state);
    this._emitState();
  }

  /** Volta tudo ao padrão das colunas e apaga o estado salvo. */
  resetState(): void {
    const opt = this.stateStoring || {};
    try {
      if (opt.type === 'custom') {
        if (opt.customSave) void opt.customSave(this._defaultState());
      } else if (opt.storageKey) {
        this._storage()?.removeItem(opt.storageKey);
      }
    } catch {
      /* armazenamento indisponível */
    }
    this._applyState(this._defaultState());
    this._stateSaved = '';
    this._emitState();
  }

  private get _storingOn(): boolean {
    const o = this.stateStoring;
    return !!o && o.enabled !== false && (o.type === 'custom' ? !!o.customLoad || !!o.customSave : !!o.storageKey);
  }

  private _storage(): Storage | null {
    try {
      return (this.stateStoring && this.stateStoring.type === 'sessionStorage' ? sessionStorage : localStorage) || null;
    } catch {
      return null;
    }
  }

  private _defaultState(): GridState {
    const p = this._paging;
    return {
      columns: defaultColumnLayout(this._columns),
      sorts: this._columns
        .filter((c) => c.sortOrder)
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
        .map((c) => ({ field: c.dataField, order: c.sortOrder! })),
      filterTexts: {},
      headerFilters: [],
      filterOperations: {},
      searchText: '',
      groups: [],
      pageSize: p.enabled ? p.pageSize : 0,
      pageIndex: 0,
      selectedRowKeys: [],
    };
  }

  private _applyState(s: Partial<GridState>) {
    const known = (f: string) => this._columns.some((c) => c.dataField === f);
    if (s.columns) this._layout = mergeColumnLayout(this._columns, s.columns);
    if (s.sorts) this._sorts = s.sorts.filter((x) => known(x.field)).map((x) => ({ field: x.field, order: x.order === 'desc' ? 'desc' : 'asc' }));
    if (s.filterTexts) {
      const t: Record<string, string> = {};
      Object.keys(s.filterTexts).forEach((k) => known(k) && (t[k] = String(s.filterTexts![k])));
      this._filterTexts = t;
    }
    if (s.headerFilters) this._headerFilters = s.headerFilters.filter((f) => known(f.field)).map((f) => ({ ...f, values: f.values.slice() }));
    if (s.filterOperations) {
      const ops: Record<string, FilterOperation> = {};
      Object.keys(s.filterOperations).forEach((k) => known(k) && (ops[k] = s.filterOperations![k]));
      this._filterOps = ops;
    }
    if (s.searchText != null) this._searchText = s.searchText;
    if (s.groups) this._groups = this._cleanGroups(s.groups);
    if (s.pageSize != null && s.pageSize >= 0) this._pageSize = s.pageSize;
    if (s.pageIndex != null) this._pageIndex = Math.max(0, s.pageIndex);
    if (s.selectedRowKeys) this._selectedKeys = new Set(s.selectedRowKeys);
  }

  private _loadState() {
    const opt = this.stateStoring!;
    const apply = (s: GridState | null | undefined) => {
      if (!s || typeof s !== 'object') return;
      const copy: Partial<GridState> = { ...s };
      if (!opt.savePageIndex) delete copy.pageIndex;
      if (!opt.saveSelection) delete copy.selectedRowKeys;
      this._applyState(copy);
    };
    try {
      if (opt.type === 'custom') {
        const r = opt.customLoad ? opt.customLoad() : null;
        if (r && typeof (r as Promise<any>).then === 'function') {
          (r as Promise<GridState | null | undefined>).then((s) => {
            apply(s);
            this._stateSaved = JSON.stringify(this._stateToSave());
          });
        } else apply(r as GridState | null | undefined);
      } else {
        const raw = this._storage()?.getItem(opt.storageKey!);
        if (raw) apply(JSON.parse(raw));
      }
    } catch (err) {
      console.warn('[bm-data-grid] não foi possível ler o estado salvo', err);
    }
    this._stateSaved = JSON.stringify(this._stateToSave());
  }

  private _stateToSave(): GridState {
    const opt = this.stateStoring || {};
    const s = this.getState();
    if (!opt.savePageIndex) delete s.pageIndex;
    if (!opt.saveSelection) delete s.selectedRowKeys;
    return s;
  }

  private _scheduleSave() {
    if (!this._stateLoaded || !this._storingOn) return;
    const json = JSON.stringify(this._stateToSave());
    if (json === this._stateSaved) return;
    clearTimeout(this._stateTimer);
    const opt = this.stateStoring!;
    this._stateTimer = setTimeout(() => {
      this._stateSaved = json;
      try {
        if (opt.type === 'custom') {
          if (opt.customSave) void opt.customSave(JSON.parse(json));
        } else this._storage()?.setItem(opt.storageKey!, json);
      } catch (err) {
        console.warn('[bm-data-grid] não foi possível salvar o estado', err);
      }
    }, opt.savingTimeout != null ? opt.savingTimeout : 300);
  }

  // ------------------------------------------------ filtro do cabeçalho

  /** Filtros do cabeçalho atuais (chaves normalizadas, para salvar). */
  getHeaderFilters(): HeaderFilter[] {
    return this._headerFilters.map((f) => ({ ...f, values: f.values.slice() }));
  }

  /** Restaura filtros salvos (como recebidos em `state-changed`). */
  setHeaderFilters(filters: HeaderFilter[]): void {
    this._headerFilters = (filters || []).filter((f) => this._columns.some((c) => c.dataField === f.field));
    this._pageIndex = 0;
    this._emitState();
  }

  /**
   * Filtra a coluna por uma lista de valores (como marcar no funil do cabeçalho).
   * `null` ou lista vazia com "exclude" remove o filtro.
   */
  setHeaderFilter(dataField: string, values: any[] | null, type: 'include' | 'exclude' = 'include'): void {
    const col = this._columns.find((c) => c.dataField === dataField);
    if (!col) return;
    const rest = this._headerFilters.filter((f) => f.field !== dataField);
    if (values && (type === 'include' || values.length)) {
      rest.push({ field: dataField, type, values: values.map((v) => headerFilterKey(v, col)) });
    }
    this._headerFilters = rest;
    this._pageIndex = 0;
    this._emitState();
  }

  clearHeaderFilter(dataField?: string): void {
    if (dataField) this.setHeaderFilter(dataField, null);
    else this.setHeaderFilters([]);
  }

  /** Valores que aparecem na lista do funil: os das linhas que passam pelos outros filtros. */
  getHeaderFilterItems(dataField: string): HeaderFilterItem[] {
    const col = this._ordered.find((c) => c.dataField === dataField);
    if (!col) return [];
    const msg = this._msg;
    let rows = applyFilters(this.dataSource || [], this._filters(), this._ordered);
    rows = applyHeaderFilters(rows, this._headerFilters.filter((f) => f.field !== dataField), this._ordered);
    rows = applySearch(rows, this._searchText, this._ordered, this.locale);
    return headerFilterItems(rows, col, this.locale, { yes: msg.yes, no: msg.no, blank: msg.groupEmpty });
  }

  private async _openHeaderFilter(col: ResolvedColumn<T>, e: MouseEvent) {
    e.stopPropagation();
    if (this._hf && this._hf.field === col.dataField) {
      this._hf = null;
      return;
    }
    const btn = e.currentTarget as HTMLElement;
    const grid = this.renderRoot.querySelector('.grid') as HTMLElement;
    const b = btn.getBoundingClientRect();
    const g = grid.getBoundingClientRect();
    const width = 260;
    const left = Math.max(4, Math.min(b.right - g.left - width, g.width - width - 4));
    let items = this.getHeaderFilterItems(col.dataField);
    if (this.remoteData && this.remoteHeaderFilter) {
      try {
        const values = await this.remoteHeaderFilter(col.dataField, { ...this._remoteOptions(), signal: new AbortController().signal });
        const msg = this._msg;
        const fake = (values || []).map((v) => {
          const o: any = {};
          let cur = o;
          const parts = col.dataField.split('.');
          parts.forEach((p, i) => (cur = cur[p] = i === parts.length - 1 ? v : {}));
          return o;
        });
        items = headerFilterItems(fake, col, this.locale, { yes: msg.yes, no: msg.no, blank: msg.groupEmpty }).map((it) => ({ ...it, count: 0 }));
      } catch (err) {
        console.error('[bm-data-grid] erro em remoteHeaderFilter', err);
      }
    }
    const current = this._headerFilters.find((f) => f.field === col.dataField);
    const draft = new Set<string>();
    for (const it of items) {
      const has = !!current && current.values.indexOf(it.key) >= 0;
      if (!current || (current.type === 'include' ? has : !has)) draft.add(it.key);
    }
    this._chooserOpen = false;
    this._hf = { field: col.dataField, left, top: b.bottom - g.top + 4, search: '', draft, items };
    this.updateComplete.then(() => {
      const input = this.renderRoot.querySelector('.hf-search') as HTMLInputElement | null;
      if (input) input.focus();
    });
  }

  private _closeHeaderFilter(focusButton = false) {
    const field = this._hf && this._hf.field;
    this._hf = null;
    if (focusButton && field) {
      this.updateComplete.then(() => {
        const b = this.renderRoot.querySelector(`th[data-field="${CSS.escape(field)}"] .hf-btn`) as HTMLElement | null;
        if (b) b.focus();
      });
    }
  }

  private _hfVisibleItems(): HeaderFilterItem[] {
    const hf = this._hf;
    if (!hf) return [];
    const q = hf.search.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!q) return hf.items;
    return hf.items.filter((it) => it.text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').indexOf(q) >= 0);
  }

  private _hfToggle(keys: string[], checked: boolean) {
    if (!this._hf) return;
    const draft = new Set(this._hf.draft);
    keys.forEach((k) => (checked ? draft.add(k) : draft.delete(k)));
    this._hf = { ...this._hf, draft };
  }

  /** Aplica a lista marcada. Tudo marcado = sem filtro; poucos desmarcados viram "exclude". */
  private _hfApply() {
    const hf = this._hf;
    if (!hf) return;
    const checked = hf.items.filter((it) => hf.draft.has(it.key)).map((it) => it.key);
    const unchecked = hf.items.filter((it) => !hf.draft.has(it.key)).map((it) => it.key);
    const rest = this._headerFilters.filter((f) => f.field !== hf.field);
    if (unchecked.length) {
      // "exclude" quando há menos desmarcados: valores novos que chegarem continuam aparecendo
      rest.push(
        unchecked.length < checked.length
          ? { field: hf.field, type: 'exclude', values: unchecked }
          : { field: hf.field, type: 'include', values: checked },
      );
    }
    this._headerFilters = rest;
    this._pageIndex = 0;
    this._closeHeaderFilter(true);
    this._emitState();
  }

  // ------------------------------------------------ agrupamento

  /** Níveis de agrupamento atuais. */
  getGrouping(): GroupDescriptor[] {
    return this._groups.map((g) => ({ ...g }));
  }

  /** Agrupa pela coluna. `index` = nível (padrão: o último). Se já agrupada, muda de nível. */
  groupBy(dataField: string, index?: number, order?: 'asc' | 'desc'): void {
    const col = this._columns.find((c) => c.dataField === dataField);
    if (!col) return;
    const current = this._groups.find((g) => g.field === dataField);
    const rest = this._groups.filter((g) => g.field !== dataField);
    const at = index == null || index < 0 || index > rest.length ? rest.length : index;
    rest.splice(at, 0, { field: dataField, order: order || (current ? current.order : col.sortOrder || 'asc') });
    this._setGroups(rest);
  }

  ungroup(dataField: string): void {
    this._setGroups(this._groups.filter((g) => g.field !== dataField));
  }

  clearGrouping(): void {
    this._setGroups([]);
  }

  /** Expande todos os grupos. */
  expandAll(): void {
    this._expansion = { all: true, overrides: {} };
  }

  collapseAll(): void {
    this._expansion = { all: false, overrides: {} };
  }

  private _toggleGroup(g: GroupInfo<T>, expanded: boolean) {
    this._expansion = { ...this._expansion, overrides: { ...this._expansion.overrides, [g.path]: !expanded } };
  }

  private _setGroups(next: GroupDescriptor[]) {
    const same = next.length === this._groups.length && next.every((g, i) => g.field === this._groups[i].field && g.order === this._groups[i].order);
    if (same) return;
    this._groups = next;
    this._expansion = { all: this._expansion.all, overrides: {} };
    this._pageIndex = 0;
    this._emit<GroupingChangedDetail>('grouping-changed', { groups: this.getGrouping() });
  }

  private _setLayout(next: ColumnLayoutItem[]) {
    if (sameColumnLayout(next, this._layout)) return;
    this._layout = next;
    this._emit<ColumnLayoutChangedDetail>('column-layout-changed', { layout: this.getColumnLayout() });
  }

  getSelectedRowKeys(): any[] {
    return Array.from(this._selectedKeys);
  }

  getSelectedRowsData(): T[] {
    if (this.remoteData) return Array.from(this._selectedKeys).map((k) => this._seenRows.get(k)).filter((r): r is T => r !== undefined);
    return (this.dataSource || []).filter((r) => this._selectedKeys.has(this._keyOf(r)));
  }

  /** Seleciona as linhas pelas chaves. `preserve` mantém a seleção atual. */
  selectRows(keys: any[], preserve = false): void {
    const next = preserve ? new Set(this._selectedKeys) : new Set<any>();
    if (this.selectionMode === 'single') {
      next.clear();
      if (keys.length) next.add(keys[keys.length - 1]);
    } else {
      keys.forEach((k) => next.add(k));
    }
    this._setSelection(next);
  }

  deselectRows(keys: any[]): void {
    const next = new Set(this._selectedKeys);
    keys.forEach((k) => next.delete(k));
    this._setSelection(next);
  }

  /** Seleciona todas as linhas que passam pelo filtro atual. */
  selectAll(): void {
    if (this.selectionMode !== 'multiple') return;
    this._setSelection(new Set(this._result.rows.map((r) => this._keyOf(r))));
  }

  clearSelection(): void {
    this._setSelection(new Set());
  }

  /** Aplica um filtro de coluna como se fosse digitado no filter row (ex.: ">100"). */
  filterColumn(dataField: string, text: string, operation?: FilterOperation): void {
    if (operation) this._filterOps = { ...this._filterOps, [dataField]: operation };
    this._filterTexts = { ...this._filterTexts, [dataField]: text };
    this._pageIndex = 0;
    this._emitState();
  }

  clearFilter(): void {
    this._filterTexts = {};
    this._headerFilters = [];
    this._searchText = '';
    this._pageIndex = 0;
    this._emitState();
  }

  searchByText(text: string): void {
    this._searchText = text;
    this._pageIndex = 0;
    this._emitState();
  }

  sortBy(sorts: SortDescriptor[]): void {
    this._sorts = sorts.slice();
    this._emitState();
  }

  clearSorting(): void {
    this.sortBy([]);
  }

  goToPage(pageIndex: number): void {
    this._pageIndex = Math.max(0, Math.min(pageIndex, this._result.pageCount - 1));
    this._emitState();
  }

  pageIndex(): number {
    return this._result.pageIndex;
  }

  pageCount(): number {
    return this._result.pageCount;
  }

  totalCount(): number {
    return this._result.totalCount;
  }

  /** Linhas da página atual. */
  /**
   * Leva a linha (pela chave) para a área visível: muda de página ou rola até ela.
   * Retorna false se a linha não está entre as filtradas (ou está num grupo recolhido).
   */
  navigateToRow(key: any): boolean {
    const scroller = this.renderRoot.querySelector('.scroller') as HTMLElement | null;
    const items = this._result.items;
    if (this.virtualScrolling) {
      const idx = items
        ? items.findIndex((it) => it.type === 'data' && this._keyOf(it.row) === key)
        : this._result.rows.findIndex((r) => this._keyOf(r) === key);
      if (idx < 0 || !scroller) return false;
      const top = this._theadH + idx * this._rowH;
      const bottom = top + this._rowH;
      if (top < scroller.scrollTop + this._theadH) scroller.scrollTop = top - this._theadH;
      else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = bottom - scroller.clientHeight;
      return true;
    }
    if (items) {
      const onPage = items.some((it) => it.type === 'data' && this._keyOf(it.row) === key);
      return onPage;
    }
    const idx = this._result.rows.findIndex((r) => this._keyOf(r) === key);
    if (idx < 0) return false;
    if (this._pageSize > 0) this.goToPage(Math.floor(idx / this._pageSize));
    return true;
  }

  getVisibleRows(): T[] {
    return this._result.pageRows.slice();
  }

  /** Todas as linhas após filtro, busca e ordenação (todas as páginas). */
  getFilteredRows(): T[] {
    return this._result.rows.slice();
  }

  /** Conteúdo CSV das linhas filtradas (todas as páginas). */
  getCsv(separator = ';'): string {
    return toCsv(this._result.rows, this._ordered, this.locale, separator);
  }

  /** Baixa um CSV (UTF-8 com BOM, abre corretamente no Excel). */
  async exportToCsv(fileName = this.exportFileName, options: ExportOptions = {}): Promise<void> {
    const name = this._beforeExport('csv', fileName, options);
    if (name == null) return;
    const rows = await this._exportRowsAsync(options);
    const csv = toCsv(rows, this._ordered, this.locale, ';');
    this._download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), name.endsWith('.csv') ? name : name + '.csv');
  }

  /**
   * Arquivo Excel (.xlsx) em bytes: linhas filtradas e ordenadas, colunas visíveis na ordem da tela,
   * números e datas como valores, agrupamento com recolher/expandir e totais no fim.
   */
  getXlsx(options: ExportOptions = {}, rows?: T[]): Uint8Array {
    const msg = this._msg;
    return toXlsx(rows || this._exportRows(options), this._ordered, {
      locale: this.locale,
      sheetName: options.sheetName || this.exportSheetName,
      groups: this._groups,
      groupSummary: this.groupSummary,
      summary: this.summary,
      texts: {
        yes: msg.yes,
        no: msg.no,
        blank: msg.groupEmpty,
        items: msg.groupItems,
        item: msg.groupItem,
        sum: msg.sum,
        avg: msg.avg,
        min: msg.min,
        max: msg.max,
        count: msg.count,
      },
    });
  }

  /** Baixa um arquivo Excel (.xlsx). */
  async exportToExcel(fileName = this.exportFileName, options: ExportOptions = {}): Promise<void> {
    const name = this._beforeExport('xlsx', fileName, options);
    if (name == null) return;
    const rows = await this._exportRowsAsync(options);
    const bytes = this.getXlsx(options, rows);
    this._download(new Blob([bytes], { type: XLSX_MIME }), name.endsWith('.xlsx') ? name : name + '.xlsx');
  }

  /** Dispara `exporting` (cancelável). Retorna o nome do arquivo ou null se cancelado. */
  private _beforeExport(format: ExportFormat, fileName: string, options: ExportOptions): string | null {
    this._exportOpen = false;
    const detail: ExportingDetail = { format, fileName, selectedOnly: !!options.selectedOnly };
    const ev = new CustomEvent<ExportingDetail>('exporting', { detail, bubbles: true, composed: true, cancelable: true });
    this.dispatchEvent(ev);
    return ev.defaultPrevented ? null : detail.fileName || 'dados';
  }

  /** No modo remoto, busca todos os registros filtrados (take: 0) antes de exportar. */
  private async _exportRowsAsync(options: ExportOptions): Promise<T[]> {
    if (!this.remoteData || options.selectedOnly) return options.selectedOnly && this.remoteData ? this.getSelectedRowsData() : this._exportRows(options);
    this._remoteLoading = true;
    try {
      const res = await this.remoteData({ ...this._remoteOptions(), skip: 0, take: 0, signal: new AbortController().signal });
      return res.data || [];
    } finally {
      this._remoteLoading = false;
    }
  }

  // ------------------------------------------------ dados remotos

  /** Busca de novo no servidor (remoteData) com o estado atual. */
  reload(): void {
    this._remoteKey = '';
    if (this.remoteData) this._maybeLoadRemote();
    else this.refresh();
  }

  private _remoteOptions(): Omit<RemoteLoadOptions, 'signal'> {
    const size = this._pageSize;
    return {
      skip: size > 0 ? this._pageIndex * size : 0,
      take: size > 0 ? size : 0,
      sorts: this._sorts.map((s) => ({ ...s })),
      filters: this._filters(),
      headerFilters: this.getHeaderFilters(),
      searchText: this._searchText,
      searchFields: this._ordered.filter((c) => c.visible && c.allowSearch).map((c) => c.dataField),
    };
  }

  private _maybeLoadRemote() {
    const opts = this._remoteOptions();
    const key = JSON.stringify(opts);
    if (key === this._remoteKey) return;
    this._remoteKey = key;
    if (this._remoteAbort) this._remoteAbort.abort();
    const ctrl = new AbortController();
    this._remoteAbort = ctrl;
    this._remoteLoading = true;
    this._remoteError = null;
    Promise.resolve()
      .then(() => this.remoteData!({ ...opts, signal: ctrl.signal }))
      .then((res) => {
        if (ctrl.signal.aborted) return;
        const rows = (res && res.data) || [];
        rows.forEach((r) => this._seenRows.set(this._keyOf(r), r));
        this._remoteRows = rows;
        this._remoteTotal = res && typeof res.totalCount === 'number' ? res.totalCount : rows.length;
        this._remoteSummary = res && res.summary ? res.summary : null;
        this._remoteLoading = false;
      })
      .catch((error) => {
        if (ctrl.signal.aborted || (error && error.name === 'AbortError')) return;
        this._remoteError = error || new Error('erro');
        this._remoteLoading = false;
        this._remoteRows = [];
        this._remoteTotal = 0;
        this._emit('load-error', { error });
      });
  }

  private _exportRows(options: ExportOptions): T[] {
    const rows = this._result.rows;
    return options.selectedOnly ? rows.filter((r) => this._selectedKeys.has(this._keyOf(r))) : rows;
  }

  private _download(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------------------------------------------------------------- handlers

  private _setSelection(next: Set<any>) {
    this._selectedKeys = next;
    this._emit<SelectionChangedDetail<T>>('selection-changed', {
      selectedRowKeys: this.getSelectedRowKeys(),
      selectedRowsData: this.getSelectedRowsData(),
    });
  }

  private _onHeaderActivate(col: ResolvedColumn<T>, e: MouseEvent | KeyboardEvent) {
    if (!col.allowSorting || this._suppressClick) return;
    const current = this._sorts.find((s) => s.field === col.dataField);
    const nextOrder = !current ? 'asc' : current.order === 'asc' ? 'desc' : null;

    if (e.shiftKey) {
      // Shift: ordenação multi-coluna
      const others = this._sorts.filter((s) => s.field !== col.dataField);
      this._sorts = nextOrder
        ? current
          ? this._sorts.map((s) => (s.field === col.dataField ? { ...s, order: nextOrder } : s))
          : [...others, { field: col.dataField, order: nextOrder }]
        : others;
    } else {
      this._sorts = nextOrder ? [{ field: col.dataField, order: nextOrder }] : [];
    }
    this._emitState();
  }

  private _onHeaderKey(col: ResolvedColumn<T>, e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._onHeaderActivate(col, e);
    }
  }

  private _onFilterInput(col: ResolvedColumn<T>, value: string, immediate = false) {
    clearTimeout(this._filterTimer);
    const apply = () => {
      this._filterTexts = { ...this._filterTexts, [col.dataField]: value };
      this._pageIndex = 0;
      this._emitState();
    };
    if (immediate) apply();
    else this._filterTimer = setTimeout(apply, 250);
  }

  private _onSearchInput(value: string) {
    clearTimeout(this._filterTimer);
    this._filterTimer = setTimeout(() => this.searchByText(value), 250);
  }

  private _onRowClick(row: T, rowIndex: number, e: MouseEvent) {
    const key = this._keyOf(row);
    const target = e.composedPath()[0] as HTMLElement | undefined;
    const fromCheckbox = !!target && target.tagName === 'INPUT';

    if (this.selectionMode === 'single') {
      this._setSelection(new Set([key]));
    } else if (this.selectionMode === 'multiple' && !fromCheckbox) {
      if (e.shiftKey && this._lastClickedKey !== undefined) {
        // Shift: seleciona o intervalo dentro das linhas filtradas
        const keys = this._result.rows.map((r) => this._keyOf(r));
        const a = keys.indexOf(this._lastClickedKey);
        const b = keys.indexOf(key);
        if (a >= 0 && b >= 0) {
          const [from, to] = a < b ? [a, b] : [b, a];
          const next = new Set(this._selectedKeys);
          keys.slice(from, to + 1).forEach((k) => next.add(k));
          this._setSelection(next);
        }
      } else if (e.ctrlKey || e.metaKey) {
        this._toggleKey(key);
      } else {
        this._setSelection(new Set([key]));
      }
    }
    if (!e.shiftKey) this._lastClickedKey = key;
    this._emit<RowEventDetail<T>>('row-click', { data: row, key, rowIndex, originalEvent: e });
  }

  private _onRowDblClick(row: T, rowIndex: number, e: MouseEvent) {
    this._emit<RowEventDetail<T>>('row-dblclick', { data: row, key: this._keyOf(row), rowIndex, originalEvent: e });
  }

  private _toggleKey(key: any) {
    const next = new Set(this._selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this._setSelection(next);
  }

  private _onSelectAllChange(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) this.selectAll();
    else {
      const visibleKeys = new Set(this._result.rows.map((r) => this._keyOf(r)));
      this._setSelection(new Set(Array.from(this._selectedKeys).filter((k) => !visibleKeys.has(k))));
    }
  }

  // ---------------------------------------------------------------- arrastar colunas
  // Pointer Events (mouse, touch e caneta). Origem: cabeçalho ou item do seletor de colunas.
  // Destino: a linha de cabeçalhos (posição pelo X) ou a lista do seletor (posição pelo Y).

  private _canReorderHeader(col: ResolvedColumn<T>) {
    return this.allowColumnReordering && col.allowReordering !== false;
  }

  private _canGroup(col: ResolvedColumn<T>) {
    return this.showGroupPanel && col.allowGrouping !== false;
  }

  private _onColumnPointerDown(e: PointerEvent, col: ResolvedColumn<T>, origin: DragOrigin) {
    if (e.button !== 0) return;
    const allowed =
      origin === 'header' ? this._canReorderHeader(col) || this._canGroup(col)
      : origin === 'chooser' ? col.allowReordering !== false || this._canGroup(col)
      : true;
    if (!allowed) return;
    const target = e.composedPath()[0] as HTMLElement;
    if (target && target.closest && target.closest('input, select, button')) return;
    this._drag = { field: col.dataField, text: col.caption, origin, x: e.clientX, y: e.clientY, pointerId: e.pointerId, active: false };
    window.addEventListener('pointermove', this._onDragMove);
    window.addEventListener('pointerup', this._onDragUp);
    window.addEventListener('pointercancel', this._onDragCancel);
  }

  private _onDragMove = (e: PointerEvent) => {
    const d = this._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 6) return;
      d.active = true;
    }
    e.preventDefault();
    this._ghost = { text: d.text, x: e.clientX, y: e.clientY };
    this._dropMark = this._dropAt(e.clientX, e.clientY);
  };

  private _onDragUp = (e: PointerEvent) => {
    const d = this._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const mark = d.active ? this._dropAt(e.clientX, e.clientY) : null;
    if (d.active) {
      // O clique que vem depois do soltar não deve ordenar nem marcar a coluna
      this._suppressClick = true;
      setTimeout(() => (this._suppressClick = false), 0);
    }
    this._endDrag();
    if (!mark) return;
    if (mark.kind === 'group') {
      // Soltar no painel: agrupa (ou muda o nível, se veio de outro grupo)
      const rest = this._groups.filter((g) => g.field !== d.field);
      const idx = mark.before == null ? rest.length : rest.findIndex((g) => g.field === mark.before);
      this.groupBy(d.field, idx < 0 ? rest.length : idx);
    } else if (d.origin === 'group') {
      // Grupo arrastado de volta para o cabeçalho: desagrupa e põe a coluna onde caiu
      this.ungroup(d.field);
      if (this.allowColumnReordering) this._setLayout(moveColumnBefore(this._layout, d.field, mark.before));
    } else {
      this._setLayout(moveColumnBefore(this._layout, d.field, mark.before));
    }
  };

  private _onDragCancel = () => this._endDrag();

  private _endDrag() {
    this._drag = null;
    this._ghost = null;
    this._dropMark = null;
    window.removeEventListener('pointermove', this._onDragMove);
    window.removeEventListener('pointerup', this._onDragUp);
    window.removeEventListener('pointercancel', this._onDragCancel);
  }

  /** Onde a coluna seria solta: antes de qual coluna (null = no fim). */
  private _dropAt(x: number, y: number): DropMark | null {
    const root = this.renderRoot as ShadowRoot;
    const el = root.elementFromPoint ? (root.elementFromPoint(x, y) as HTMLElement | null) : null;
    const d = this._drag;
    if (!el || !d) return null;
    const col = this._columns.find((c) => c.dataField === d.field);
    if (!col) return null;

    const panel = el.closest('.group-panel');
    if (panel) {
      if (d.origin !== 'group' && !this._canGroup(col)) return null;
      const chips = Array.from(panel.querySelectorAll<HTMLElement>('.group-chip[data-field]'));
      const hit = chips.find((ch) => {
        const r = ch.getBoundingClientRect();
        return x < r.left + r.width / 2;
      });
      return { kind: 'group', before: hit ? hit.dataset.field! : null };
    }

    const list = el.closest('.chooser-list');
    if (list) {
      if (d.origin === 'group' || col.allowReordering === false) return null;
      const items = Array.from(list.querySelectorAll<HTMLElement>('[data-field]'));
      const hit = items.find((it) => {
        const r = it.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      return { kind: 'chooser', before: hit ? hit.dataset.field! : this._fieldAfter(items.length ? items[items.length - 1].dataset.field : undefined) };
    }
    const header = el.closest('tr.headers');
    if (header) {
      if (d.origin === 'header' && !this._canReorderHeader(col)) return null;
      if (d.origin === 'chooser' && col.allowReordering === false) return null;
      const ths = Array.from(header.querySelectorAll<HTMLElement>('th[data-field]'));
      const hit = ths.find((th) => {
        const r = th.getBoundingClientRect();
        return x < r.left + r.width / 2;
      });
      return { kind: 'header', before: hit ? hit.dataset.field! : this._fieldAfter(ths.length ? ths[ths.length - 1].dataset.field : undefined) };
    }
    return null;
  }

  /** Coluna do layout logo depois de `field` (soltar no fim da lista/cabeçalho), ou null. */
  private _fieldAfter(field: string | undefined): string | null {
    const i = this._layout.findIndex((x) => x.dataField === field);
    const next = i >= 0 ? this._layout[i + 1] : undefined;
    return next ? next.dataField : null;
  }

  // ---------------------------------------------------------------- render

  private _alignClass(col: ResolvedColumn<T>) {
    return col.alignment === 'right' ? 'align-right' : col.alignment === 'center' ? 'align-center' : '';
  }

  private _renderToolbar(msg: DataGridMessages) {
    const hasFilters =
      Object.keys(this._filterTexts).some((k) => this._filterTexts[k]) || !!this._searchText || this._headerFilters.length > 0;
    if (!this.showSearchPanel && !this.showExportButton && !this.columnChooserEnabled) return nothing;
    return html`
      <div class="toolbar" part="toolbar">
        <slot name="toolbar"></slot>
        <span class="spacer"></span>
        ${hasFilters
          ? html`<button class="btn" type="button" @click=${() => this.clearFilter()}>${msg.clearFilters}</button>`
          : nothing}
        ${this.columnChooserEnabled
          ? html`<span class="chooser-anchor">
              <button
                class="btn chooser-btn ${this._chooserOpen ? 'active' : ''}"
                type="button"
                part="column-chooser-button"
                aria-haspopup="true"
                aria-expanded=${this._chooserOpen ? 'true' : 'false'}
                @click=${() => (this._chooserOpen = !this._chooserOpen)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 2h4v12H1zM6 2h4v12H6zM11 2h4v12h-4z" /></svg>
                ${msg.columnChooser}
              </button>
              ${this._chooserOpen ? this._renderChooser(msg) : nothing}
            </span>`
          : nothing}
        ${this.showExportButton ? this._renderExport(msg) : nothing}
        ${this.showSearchPanel
          ? html`<input
              class="input search"
              part="search"
              type="search"
              aria-label=${msg.searchPlaceholder}
              placeholder=${msg.searchPlaceholder}
              .value=${live(this._searchText)}
              @input=${(e: Event) => this._onSearchInput((e.target as HTMLInputElement).value)}
            />`
          : nothing}
      </div>
    `;
  }

  private _renderExport(msg: DataGridMessages) {
    const formats = (this.exportFormats && this.exportFormats.length ? this.exportFormats : ['csv']) as ExportFormat[];
    const selected = this.selectionMode !== 'none' ? this._result.rows.filter((r) => this._selectedKeys.has(this._keyOf(r))).length : 0;
    const hasXlsx = formats.indexOf('xlsx') >= 0;
    const icon = html`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v8.6l2.8-2.8 1 1L8 12.4 4.2 7.8l1-1L7 9.6V1zM2 13h12v2H2z" /></svg>`;
    if (formats.length === 1 && !(hasXlsx && selected)) {
      const f = formats[0];
      return html`<button class="btn export-btn" type="button" part="export-button" @click=${() => (f === 'xlsx' ? this.exportToExcel() : this.exportToCsv())}>
        ${icon} ${f === 'xlsx' ? msg.exportXlsxOnly : msg.export}
      </button>`;
    }
    return html`<span class="export-anchor">
      <button
        class="btn export-btn ${this._exportOpen ? 'active' : ''}"
        type="button"
        part="export-button"
        aria-haspopup="menu"
        aria-expanded=${this._exportOpen ? 'true' : 'false'}
        @click=${() => {
          this._exportOpen = !this._exportOpen;
          if (this._exportOpen) {
            this._chooserOpen = false;
            this.updateComplete.then(() => {
              const first = this.renderRoot.querySelector('.export-menu [role="menuitem"]') as HTMLElement | null;
              if (first) first.focus();
            });
          }
        }}
      >
        ${icon} ${msg.exportMenu} <span class="caret" aria-hidden="true">▾</span>
      </button>
      ${this._exportOpen
        ? html`<div class="export-menu" part="export-menu" role="menu" @keydown=${this._onMenuKey}>
            ${hasXlsx ? html`<button type="button" role="menuitem" @click=${() => this.exportToExcel()}>${msg.exportXlsx}</button>` : nothing}
            ${formats.indexOf('csv') >= 0 ? html`<button type="button" role="menuitem" @click=${() => this.exportToCsv()}>${msg.exportCsv}</button>` : nothing}
            ${hasXlsx && selected
              ? html`<button type="button" role="menuitem" @click=${() => this.exportToExcel(this.exportFileName, { selectedOnly: true })}>
                  ${msg.exportSelected.replace('{0}', new Intl.NumberFormat(this.locale).format(selected))}
                </button>`
              : nothing}
          </div>`
        : nothing}
    </span>`;
  }

  /** Setas para cima/baixo no menu de exportar. */
  private _onMenuKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('.export-menu [role="menuitem"]'));
    const i = items.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLElement);
    const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
    if (next) next.focus();
  };

  private _renderChooser(msg: DataGridMessages) {
    const items = this._ordered.filter((c) => c.showInColumnChooser !== false);
    const visibleCount = this._ordered.filter((c) => c.visible).length;
    const mark = this._dropMark && this._dropMark.kind === 'chooser' ? this._dropMark : null;
    const dragging = this._ghost && this._drag ? this._drag.field : null;
    const endMark = !!mark && !items.some((c) => c.dataField === mark.before);
    return html`<div class="chooser" part="column-chooser" role="dialog" aria-label=${msg.columnChooser}>
      <ul class="chooser-list ${endMark ? 'drop-end' : ''}">
        ${items.map((c) => {
          const locked = c.allowHiding === false || (c.visible && visibleCount <= 1);
          const canDrag = c.allowReordering !== false || this._canGroup(c);
          return html`<li
            data-field=${c.dataField}
            class="${mark && mark.before === c.dataField ? 'drop-before' : ''} ${dragging === c.dataField ? 'dragging' : ''}"
            data-draggable=${canDrag ? 'true' : 'false'}
            @pointerdown=${(e: PointerEvent) => this._onColumnPointerDown(e, c, 'chooser')}
          >
            <span class="handle" aria-hidden="true" title=${msg.dragToReorder}>${canDrag ? '⣿' : ''}</span>
            <label>
              <input
                type="checkbox"
                .checked=${live(c.visible)}
                ?disabled=${locked}
                @click=${(e: Event) => {
                  if (this._suppressClick) e.preventDefault();
                }}
                @change=${(e: Event) => this.setColumnVisible(c.dataField, (e.target as HTMLInputElement).checked)}
              />
              <span class="chooser-text">${c.caption}</span>
            </label>
            <button
              class="pin ${c.fixed ? 'on' : ''}"
              type="button"
              title=${c.fixed ? msg.unfixColumn : msg.fixColumn}
              aria-label=${(c.fixed ? msg.unfixColumn : msg.fixColumn) + ': ' + c.caption}
              aria-pressed=${c.fixed ? 'true' : 'false'}
              @click=${() => this.setColumnFixed(c.dataField, !c.fixed)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 1.5 14.5 5.5 13 7l-1-.5-2.5 2.5.5 3-1.5 1.5L5.5 10.5 2 14l-.5-.5L5 10 2 7l1.5-1.5 3 .5L9 3.5 8.5 2.5z" /></svg>
            </button>
          </li>`;
        })}
      </ul>
      <div class="chooser-actions">
        <button class="btn" type="button" @click=${() => this.resetColumnLayout()}>${msg.resetColumns}</button>
      </div>
    </div>`;
  }

  private _renderHeader(cols: ResolvedColumn<T>[], msg: DataGridMessages) {
    const multi = this.selectionMode === 'multiple';
    const multiSort = this._sorts.length > 1;
    let allState: 'none' | 'some' | 'all' = 'none';
    if (multi && this._result.rows.length) {
      const selectedVisible = this._result.rows.filter((r) => this._selectedKeys.has(this._keyOf(r))).length;
      allState = selectedVisible === 0 ? 'none' : selectedVisible === this._result.rows.length ? 'all' : 'some';
    }

    return html`
      <thead>
        <tr class="headers" part="header-row">
          ${multi
            ? html`<th class="select-col" scope="col">
                <input
                  type="checkbox"
                  aria-label=${msg.selectAll}
                  .checked=${live(allState === 'all')}
                  .indeterminate=${allState === 'some'}
                  @change=${this._onSelectAllChange}
                />
              </th>`
            : nothing}
          ${this._indentCells('th')}
          ${cols.map((col) => {
            const sortIdx = this._sorts.findIndex((s) => s.field === col.dataField);
            const sort = sortIdx >= 0 ? this._sorts[sortIdx] : undefined;
            const ariaSort = sort ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none';
            const mark = this._dropMark && this._dropMark.kind === 'header' ? this._dropMark : null;
            const dropBefore = !!mark && mark.before === col.dataField;
            const dropAfter = !!mark && col === cols[cols.length - 1] && !cols.some((c) => c.dataField === mark.before);
            const draggable = this._canReorderHeader(col) || this._canGroup(col);
            const dragging = !!this._ghost && !!this._drag && this._drag.field === col.dataField;
            return html`<th
              scope="col"
              part="header-cell"
              data-field=${col.dataField}
              data-draggable=${draggable ? 'true' : 'false'}
              class="${this._alignClass(col)} ${col.allowSorting ? 'sortable' : ''} ${dropBefore ? 'drop-before' : ''} ${dropAfter ? 'drop-after' : ''} ${dragging ? 'dragging' : ''}"
              @pointerdown=${draggable ? (e: PointerEvent) => this._onColumnPointerDown(e, col, 'header') : nothing}
              aria-sort=${col.allowSorting ? ariaSort : nothing}
              tabindex=${col.allowSorting ? '0' : nothing}
              title=${col.caption}
              @click=${(e: MouseEvent) => this._onHeaderActivate(col, e)}
              @keydown=${(e: KeyboardEvent) => this._onHeaderKey(col, e)}
            >
              <span class="th-content">
                <span class="th-text">${col.caption}</span>
                ${sort
                  ? html`<span class="sort-icon" aria-hidden="true">${sort.order === 'asc' ? '▲' : '▼'}</span>${multiSort
                        ? html`<span class="sort-index">${sortIdx + 1}</span>`
                        : nothing}`
                  : nothing}
                ${this.showHeaderFilter && col.allowHeaderFiltering !== false ? this._renderFunnel(col, msg) : nothing}
              </span>
              ${this.allowColumnResizing && col.allowResizing !== false
                ? html`<span
                    class="resize-handle ${this._resize && this._resize.field === col.dataField ? 'active' : ''}"
                    title=${msg.resizeColumn}
                    aria-hidden="true"
                    @pointerdown=${(e: PointerEvent) => this._onResizeDown(e, col)}
                    @dblclick=${(e: MouseEvent) => {
                      e.stopPropagation();
                      this.autoFitColumn(col.dataField);
                    }}
                    @click=${(e: MouseEvent) => e.stopPropagation()}
                  ></span>`
                : nothing}
            </th>`;
          })}
        </tr>
        ${this.showFilterRow ? this._renderFilterRow(cols, msg) : nothing}
      </thead>
    `;
  }

  private _renderFunnel(col: ResolvedColumn<T>, msg: DataGridMessages) {
    const active = this._headerFilters.some((f) => f.field === col.dataField);
    const open = !!this._hf && this._hf.field === col.dataField;
    return html`<button
      class="hf-btn ${active ? 'active' : ''} ${open ? 'open' : ''}"
      type="button"
      part="header-filter-button"
      aria-label=${msg.headerFilter + ': ' + col.caption}
      aria-haspopup="dialog"
      aria-expanded=${open ? 'true' : 'false'}
      title=${msg.headerFilter}
      @click=${(e: MouseEvent) => this._openHeaderFilter(col, e)}
      @keydown=${(e: KeyboardEvent) => e.stopPropagation()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 2h13l-5 6.2V13l-3 1.5V8.2z" /></svg>
    </button>`;
  }

  private _renderHeaderFilterPopup(msg: DataGridMessages) {
    const hf = this._hf;
    if (!hf) return nothing;
    const col = this._columns.find((c) => c.dataField === hf.field);
    if (!col) return nothing;
    const visible = this._hfVisibleItems();
    const checkedVisible = visible.filter((it) => hf.draft.has(it.key)).length;
    const allState = checkedVisible === 0 ? 'none' : checkedVisible === visible.length ? 'all' : 'some';
    const nf = new Intl.NumberFormat(this.locale);
    return html`<div
      class="hf-popup"
      part="header-filter"
      role="dialog"
      aria-label=${msg.headerFilter + ': ' + col.caption}
      style="left:${hf.left}px;top:${hf.top}px"
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON' && hf.draft.size) {
          e.preventDefault();
          this._hfApply();
        }
      }}
    >
      <input
        class="input hf-search"
        type="search"
        placeholder=${msg.searchPlaceholder}
        aria-label=${msg.searchPlaceholder}
        .value=${live(hf.search)}
        @input=${(e: Event) => (this._hf = { ...hf, search: (e.target as HTMLInputElement).value })}
      />
      ${visible.length
        ? html`<label class="hf-all">
              <input
                type="checkbox"
                .checked=${live(allState === 'all')}
                .indeterminate=${allState === 'some'}
                @change=${(e: Event) => this._hfToggle(visible.map((it) => it.key), (e.target as HTMLInputElement).checked)}
              />
              <span>${msg.selectAll}</span>
            </label>
            <ul class="hf-list" role="listbox" aria-multiselectable="true">
              ${visible.map(
                (it) => html`<li role="option" aria-selected=${hf.draft.has(it.key) ? 'true' : 'false'}>
                  <label>
                    <input
                      type="checkbox"
                      .checked=${live(hf.draft.has(it.key))}
                      @change=${(e: Event) => this._hfToggle([it.key], (e.target as HTMLInputElement).checked)}
                    />
                    <span class="hf-text ${it.key === '' ? 'blank' : ''}">${it.text}</span>
                    ${it.count ? html`<span class="hf-count">${nf.format(it.count)}</span>` : nothing}
                  </label>
                </li>`,
              )}
            </ul>`
        : html`<div class="hf-empty">${msg.noValues}</div>`}
      <div class="hf-actions">
        <button class="btn btn-primary" type="button" ?disabled=${hf.draft.size === 0} @click=${() => this._hfApply()}>${msg.ok}</button>
        <button class="btn" type="button" @click=${() => this._closeHeaderFilter(true)}>${msg.cancel}</button>
      </div>
    </div>`;
  }

  private _renderFilterRow(cols: ResolvedColumn<T>[], msg: DataGridMessages) {
    return html`
      <tr class="filters" part="filter-row">
        ${this.selectionMode === 'multiple' ? html`<th class="select-col"></th>` : nothing}
        ${this._indentCells('th')}
        ${cols.map((col) => {
          if (!col.allowFiltering) return html`<th></th>`;
          const value = this._filterTexts[col.dataField] || '';
          const label = msg.filterPlaceholder + ': ' + col.caption;
          if (col.dataType === 'boolean') {
            return html`<th>
              <select
                class="input frow-input"
                aria-label=${label}
                @change=${(e: Event) => this._onFilterInput(col, (e.target as HTMLSelectElement).value, true)}
              >
                <option value="" ?selected=${value === ''}>${msg.all}</option>
                <option value="true" ?selected=${value === 'true'}>${msg.yes}</option>
                <option value="false" ?selected=${value === 'false'}>${msg.no}</option>
              </select>
            </th>`;
          }
          const op = this._filterOp(col);
          const invalid = !!value.trim() && !parseFilterInput(value, col.dataType, op, this.locale);
          const placeholder = col.dataType === 'date' ? msg.datePlaceholder : col.dataType === 'number' ? '' : msg.filterPlaceholder;
          const open = !!this._opMenu && this._opMenu.field === col.dataField;
          const opBtn = html`<button
            class="op-btn ${open ? 'open' : ''}"
            type="button"
            title=${msg.filterOperation + ': ' + (msg.filterOps[op] || op)}
            aria-label=${msg.filterOperation + ' (' + col.caption + '): ' + (msg.filterOps[op] || op)}
            aria-haspopup="menu"
            aria-expanded=${open ? 'true' : 'false'}
            @click=${(e: MouseEvent) => this._openOpMenu(col, e)}
          >
<span class="op-sym">${op === 'contains' ? searchIcon : OP_SYMBOL[op] || op}</span
            ><svg class="op-caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M0 0h10L5 6z" /></svg>
          </button>`;
          if (op === 'between') {
            const [a, b] = value.split('..');
            const set = (from: string, to: string) => this._onFilterInput(col, from || to ? `${from}..${to}` : '');
            return html`<th>
              <div class="frow ${invalid ? 'invalid' : ''}">
                ${opBtn}
                <input
                  class="frow-input ${this._alignClass(col)}"
                  type="text"
                  aria-label=${label + ' (' + msg.filterFrom + ')'}
                  placeholder=${msg.filterFrom}
                  .value=${live(a || '')}
                  @input=${(e: Event) => set((e.target as HTMLInputElement).value, (b || '').trim())}
                />
                <span class="frow-sep" aria-hidden="true">–</span>
                <input
                  class="frow-input ${this._alignClass(col)}"
                  type="text"
                  aria-label=${label + ' (' + msg.filterTo + ')'}
                  placeholder=${msg.filterTo}
                  .value=${live(b || '')}
                  @input=${(e: Event) => set((a || '').trim(), (e.target as HTMLInputElement).value)}
                />
              </div>
            </th>`;
          }
          return html`<th>
            <div class="frow ${invalid ? 'invalid' : ''} ${value ? 'has-value' : ''}">
              ${opBtn}
              <input
                class="frow-input ${this._alignClass(col)}"
                type="text"
                aria-label=${label}
                aria-invalid=${invalid ? 'true' : 'false'}
                placeholder=${placeholder}
                title=${col.dataType === 'number' ? 'Ex.: >100, <=50, 10..50' : col.dataType === 'date' ? 'Ex.: 05/2026, >2025, 01/05/2026..15/05/2026' : ''}
                .value=${live(value)}
                @input=${(e: Event) => this._onFilterInput(col, (e.target as HTMLInputElement).value)}
              />
              ${value
                ? html`<button class="frow-clear" type="button" aria-label=${msg.clearFilters + ': ' + col.caption} @click=${() => this._onFilterInput(col, '', true)}>×</button>`
                : nothing}
            </div>
          </th>`;
        })}
      </tr>
    `;
  }

  private _openOpMenu(col: ResolvedColumn<T>, e: MouseEvent) {
    e.stopPropagation();
    if (this._opMenu && this._opMenu.field === col.dataField) {
      this._opMenu = null;
      return;
    }
    const btn = e.currentTarget as HTMLElement;
    const grid = this.renderRoot.querySelector('.grid') as HTMLElement;
    const b = btn.getBoundingClientRect();
    const g = grid.getBoundingClientRect();
    this._opMenu = { field: col.dataField, left: Math.max(4, Math.min(b.left - g.left, g.width - 214)), top: b.bottom - g.top + 4 };
    this.updateComplete.then(() => {
      const cur = this.renderRoot.querySelector<HTMLElement>('.op-menu [aria-checked="true"]') || this.renderRoot.querySelector<HTMLElement>('.op-menu [role="menuitemradio"]');
      if (cur) cur.focus();
    });
  }

  /** Troca o operador; no "entre" o texto vira "de..até". */
  private _setFilterOp(col: ResolvedColumn<T>, op: FilterOperation) {
    const text = this._filterTexts[col.dataField] || '';
    let next = text;
    if (op === 'between' && text && text.indexOf('..') < 0) next = text.replace(/^(>=|<=|<>|!=|>|<|=)\s*/, '') + '..';
    if (op !== 'between' && text.indexOf('..') >= 0) next = text.split('..')[0];
    this._opMenu = null;
    this.filterColumn(col.dataField, next, op);
    this.updateComplete.then(() => {
      const th = this.renderRoot.querySelector('tr.filters')?.children;
      const idx = Array.prototype.indexOf.call(this.renderRoot.querySelector('tr.headers')?.children || [], this.renderRoot.querySelector(`tr.headers th[data-field="${CSS.escape(col.dataField)}"]`));
      const input = th && idx >= 0 ? (th[idx] as HTMLElement).querySelector<HTMLInputElement>('input.frow-input') : null;
      if (input) input.focus();
    });
  }

  private _renderOpMenu(msg: DataGridMessages) {
    const m = this._opMenu;
    if (!m) return nothing;
    const col = this._columns.find((c) => c.dataField === m.field);
    if (!col) return nothing;
    const ops = col.dataType === 'string' ? STRING_OPS : RANGE_OPS;
    const cur = this._filterOp(col);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('.op-menu [role="menuitemradio"]'));
      const i = items.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLElement);
      const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      if (n) n.focus();
    };
    return html`<div class="op-menu" role="menu" part="filter-operation-menu" aria-label=${msg.filterOperation} style="left:${m.left}px;top:${m.top}px" @keydown=${onKey}>
      ${ops.map(
        (op) => html`<button type="button" role="menuitemradio" aria-checked=${op === cur ? 'true' : 'false'} @click=${() => this._setFilterOp(col, op)}>
          <span class="op-sym" aria-hidden="true">${op === 'contains' ? searchIcon : OP_SYMBOL[op]}</span>
          ${msg.filterOps[op] || op}
        </button>`,
      )}
    </div>`;
  }

  /** Barra com os filtros ativos, cada um removível. */
  private _renderFilterPanel(msg: DataGridMessages) {
    if (!this.showFilterPanel) return nothing;
    const chips: { text: string; remove: () => void }[] = [];
    for (const col of this._ordered) {
      const text = this._filterTexts[col.dataField];
      if (!text) continue;
      const op = this._filterOp(col);
      let desc: string;
      if (col.dataType === 'boolean') desc = text === 'true' ? msg.yes : msg.no;
      else if (text.indexOf('..') >= 0) {
        const [a, b] = text.split('..');
        desc = a && b ? `${(msg.filterOps.between || 'between').toLowerCase()} ${a.trim()} – ${b.trim()}` : a ? `≥ ${a.trim()}` : `≤ ${(b || '').trim()}`;
      } else if (/^(>=|<=|<>|!=|>|<|=)/.test(text.trim())) desc = text.trim();
      else desc = (msg.filterOps[op] || op).toLowerCase() + ' ' + (col.dataType === 'string' ? '"' + text + '"' : text);
      chips.push({ text: col.caption + ' ' + desc, remove: () => this._onFilterInput(col, '', true) });
    }
    for (const f of this._headerFilters) {
      const col = this._columns.find((c) => c.dataField === f.field);
      if (!col) continue;
      const items = headerFilterItems(this.dataSource || [], col, this.locale, { yes: msg.yes, no: msg.no, blank: msg.groupEmpty });
      const names = items.filter((it) => f.values.indexOf(it.key) >= 0).map((it) => it.text);
      const shown = names.length > 3 ? msg.valuesCount.replace('{0}', String(names.length)) : names.join(', ');
      chips.push({ text: `${col.caption} ${f.type === 'exclude' ? '≠' : '='} ${shown}`, remove: () => this.setHeaderFilter(f.field, null) });
    }
    if (this._searchText) chips.push({ text: `${msg.searchChip}: "${this._searchText}"`, remove: () => this.searchByText('') });
    if (!chips.length) return nothing;
    return html`<div class="filter-panel" part="filter-panel" role="region" aria-label=${msg.filterPanelTitle}>
      <span class="fp-title">${msg.filterPanelTitle}:</span>
      ${chips.map(
        (c) => html`<span class="fp-chip" part="filter-chip"
          >${c.text}<button type="button" aria-label=${msg.clearFilters + ': ' + c.text} @click=${c.remove}>×</button></span
        >`,
      )}
      <button class="fp-clear" type="button" @click=${() => this.clearFilter()}>${msg.clearAll}</button>
    </div>`;
  }

  private _renderCell(row: T, col: ResolvedColumn<T>, msg: DataGridMessages): unknown {
    const value = getCellValue(row, col);
    if (col.cellTemplate) {
      const key = this._tplKey(row, col);
      this._tplWanted.set(key, { name: col.cellTemplate, value, row, col });
      return html`<slot name=${this._tplSlot(key)}></slot>`;
    }
    if (col.cellRender) return col.cellRender(value, row);
    return formatValue(value, col.dataType, col.format, this.locale, row, msg);
  }

  private _renderBody(cols: ResolvedColumn<T>[], msg: DataGridMessages) {
    const multi = this.selectionMode === 'multiple';
    const rows = this._result.pageRows;
    const offset = this._result.pageIndex * (this._pageSize || 0);
    const span = cols.length + (multi ? 1 : 0) + this._depth;

    if (this.virtualScrolling && (rows.length || (this._result.items && this._result.items.length))) {
      // Rolagem virtual: só as linhas perto da área visível; espaçadores no lugar do resto
      const items = this._result.items;
      const total = items ? items.length : rows.length;
      const w = this._virtualWindow(total);
      const spacer = (h: number) => (h > 0 ? html`<tr class="v-spacer" aria-hidden="true"><td colspan=${span} style="height:${h}px"></td></tr>` : nothing);
      let body: unknown;
      if (items) {
        let dataIndex = 0;
        for (let i = 0; i < w.start; i++) if (items[i].type === 'data') dataIndex++;
        body = this._renderGroupedItems(items.slice(w.start, w.end), dataIndex, cols, msg);
      } else {
        body = rows.slice(w.start, w.end).map((row, i) => this._renderDataRow(row, w.start + i, cols, msg));
      }
      return html`<tbody>
        ${spacer(w.start * this._rowH)} ${body} ${spacer((total - w.end) * this._rowH)}
      </tbody>`;
    }

    if (this._result.items && this._result.items.length) return this._renderGroupedBody(cols, msg);
    if (!rows.length) {
      return html`<tbody>
        <tr class="no-data">
          <td colspan=${cols.length + (multi ? 1 : 0) + this._depth} part="no-data">${this._remoteError ? msg.loadError : this._remoteLoading && !this._remoteRows.length ? msg.loading : this.noDataText || msg.noData}</td>
        </tr>
      </tbody>`;
    }

    return html`<tbody>
      ${rows.map((row, i) => this._renderDataRow(row, offset + i, cols, msg))}
    </tbody>`;
  }

  /** Número de níveis de agrupamento ativos (colunas de recuo à esquerda). */
  private get _depth(): number {
    return this._result.items ? this._groups.length : 0;
  }

  private _indentCells(tag: 'th' | 'td' | 'col', count = this._depth) {
    const out: TemplateResult[] = [];
    for (let i = 0; i < count; i++) {
      out.push(
        tag === 'col'
          ? html`<col class="group-indent" style="width:28px" />`
          : tag === 'th'
            ? html`<th class="group-indent" aria-hidden="true"></th>`
            : html`<td class="group-indent"></td>`,
      );
    }
    return out;
  }

  private _renderGroupPanel(msg: DataGridMessages) {
    if (!this.showGroupPanel) return nothing;
    const mark = this._dropMark && this._dropMark.kind === 'group' ? this._dropMark : null;
    const dragging = this._ghost && this._drag ? this._drag.field : null;
    const groups = this._groups;
    return html`<div class="group-panel ${mark ? 'drop-target' : ''} ${mark && mark.before == null && groups.length ? 'drop-end' : ''}" part="group-panel">
      ${groups.length
        ? groups.map((g, i) => {
            const col = this._columns.find((c) => c.dataField === g.field)!;
            return html`${i > 0 ? html`<span class="group-sep" aria-hidden="true">›</span>` : nothing}<span
                class="group-chip ${mark && mark.before === g.field ? 'drop-before' : ''} ${dragging === g.field ? 'dragging' : ''}"
                part="group-chip"
                data-field=${g.field}
                role="button"
                tabindex="0"
                title=${col.caption}
                aria-label=${col.caption + (g.order === 'asc' ? ' ▲' : ' ▼')}
                @pointerdown=${(e: PointerEvent) => this._onColumnPointerDown(e, col, 'group')}
                @click=${() => {
                  if (!this._suppressClick) this.groupBy(g.field, i, g.order === 'asc' ? 'desc' : 'asc');
                }}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.groupBy(g.field, i, g.order === 'asc' ? 'desc' : 'asc');
                  } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    this.ungroup(g.field);
                  }
                }}
              >
                <span class="chip-text">${col.caption}</span>
                <span class="sort-icon" aria-hidden="true">${g.order === 'asc' ? '▲' : '▼'}</span>
                <button
                  class="chip-remove"
                  type="button"
                  aria-label=${msg.ungroup + ': ' + col.caption}
                  title=${msg.ungroup}
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this.ungroup(g.field);
                  }}
                >
                  ×
                </button>
              </span>`;
          })
        : html`<span class="group-hint">${msg.groupPanelHint}</span>`}
      ${groups.length
        ? html`<span class="spacer"></span>
            <button class="btn btn-sm" type="button" @click=${() => this.expandAll()}>${msg.expandAll}</button>
            <button class="btn btn-sm" type="button" @click=${() => this.collapseAll()}>${msg.collapseAll}</button>`
        : nothing}
    </div>`;
  }

  private _groupSummaryText(g: GroupInfo<T>, items: SummaryItem[], msg: DataGridMessages): string {
    const captions: Record<string, string> = { sum: msg.sum, avg: msg.avg, min: msg.min, max: msg.max, count: msg.count };
    if (!items.length) return g.rows.length === 1 ? msg.groupItem : msg.groupItems.replace('{0}', String(g.rows.length));
    return items
      .map((it) => computeSummary(g.rows, it, this._ordered, this.locale, captions).text)
      .filter((t) => t)
      .join(', ');
  }

  /** Faixa de linhas a renderizar na rolagem virtual (com folga acima e abaixo). */
  private _virtualWindow(total: number): { start: number; end: number } {
    const rowH = this._rowH;
    const overscan = 8;
    const first = Math.floor(Math.max(0, this._scrollTop - this._theadH) / rowH);
    const count = Math.ceil(this._viewH / rowH) + 1;
    let start = Math.max(0, first - overscan);
    start -= start % 2; // mantém a alternância de cor estável ao rolar
    const end = Math.min(total, first + count + overscan);
    return { start: Math.min(start, end), end };
  }

  private _renderGroupedBody(cols: ResolvedColumn<T>[], msg: DataGridMessages) {
    return html`<tbody>
      ${this._renderGroupedItems(this._result.items || [], this._result.pageIndex * (this._pageSize || 0), cols, msg)}
    </tbody>`;
  }

  private _renderGroupedItems(items: GridRowItem<T>[], firstDataIndex: number, cols: ResolvedColumn<T>[], msg: DataGridMessages) {
    const multi = this.selectionMode === 'multiple';
    const depth = this._depth;
    const captions: Record<string, string> = { sum: msg.sum, avg: msg.avg, min: msg.min, max: msg.max, count: msg.count };
    const all = this.groupSummary || [];
    const aligned = all.filter((s) => s.alignByColumn && cols.some((c) => c.dataField === (s.showInColumn || s.column)));
    const inline = all.filter((s) => aligned.indexOf(s) < 0);
    const firstAligned = aligned.length
      ? Math.min(...aligned.map((s) => cols.findIndex((c) => c.dataField === (s.showInColumn || s.column))))
      : cols.length;
    // O título do grupo fica numa célula presa à esquerda (sticky), cobrindo o recuo e as
    // colunas fixas; assim ele continua visível ao rolar para o lado, mesmo depois de passar
    // pelas colunas com total. O resto, até a primeira coluna com total, é uma célula vazia.
    let fixedCount = 0;
    while (fixedCount < cols.length && cols[fixedCount].fixed) fixedCount++;
    const titleCols = Math.min(fixedCount, firstAligned);
    const restCols = firstAligned - titleCols;
    let dataIndex = firstDataIndex;

    return html`
      ${items.map((it) => {
        if (it.type === 'data') return this._renderDataRow(it.row, dataIndex++, cols, msg);
        const g = it.group;
        const col = this._columns.find((c) => c.dataField === g.field)!;
        const valueText = formatValue(g.value, col.dataType, col.format, this.locale, g.rows[0], msg) || msg.groupEmpty;
        const meta = this._groupSummaryText(g, inline, msg);
        const results = aligned.map((s) => computeSummary(g.rows, s, this._ordered, this.locale, captions));
        let selState: 'none' | 'some' | 'all' = 'none';
        if (multi) {
          const n = g.rows.filter((r) => this._selectedKeys.has(this._keyOf(r))).length;
          selState = n === 0 ? 'none' : n === g.rows.length ? 'all' : 'some';
        }
        return html`<tr
          class="group-row level-${g.level}"
          part="group-row"
          aria-expanded=${it.expanded ? 'true' : 'false'}
          data-group=${g.path}
          @click=${(e: MouseEvent) => {
            const t = e.composedPath()[0] as HTMLElement;
            if (t && t.tagName === 'INPUT') return;
            this._toggleGroup(g, it.expanded);
          }}
        >
          ${multi
            ? html`<td class="select-col">
                <input
                  type="checkbox"
                  aria-label=${msg.selectGroup + ': ' + valueText}
                  .checked=${live(selState === 'all')}
                  .indeterminate=${selState === 'some'}
                  @change=${(e: Event) => {
                    const keys = g.rows.map((r) => this._keyOf(r));
                    if ((e.target as HTMLInputElement).checked) this.selectRows(keys, true);
                    else this.deselectRows(keys);
                  }}
                />
              </td>`
            : nothing}
          ${this._indentCells('td', g.level)}
          <td
            class="group-cell group-title"
            colspan=${depth - g.level + titleCols}
            style="left:${(multi ? 40 : 0) + g.level * 28}px"
          >
            <span class="group-sticky">
              <button
                class="group-toggle"
                type="button"
                aria-label=${it.expanded ? msg.collapseGroup : msg.expandGroup}
              >
                <span class="chevron ${it.expanded ? 'open' : ''}" aria-hidden="true">▸</span>
              </button>
              <span class="group-text">${col.caption}: <strong>${valueText}</strong></span>
              ${meta ? html`<span class="group-meta">(${meta})</span>` : nothing}
              ${it.continued ? html`<span class="group-meta">· ${msg.groupContinued}</span>` : nothing}
            </span>
          </td>
          ${restCols > 0 ? html`<td class="group-cell" colspan=${restCols}></td>` : nothing}
          ${cols.slice(firstAligned).map((c) => {
            const rs = results.filter((r) => (r.showInColumn || r.column) === c.dataField);
            return html`<td class="group-cell ${this._alignClass(c)}">
              ${rs.map((r) => html`<span class="summary-item" title=${r.text}>${r.text}</span>`)}
            </td>`;
          })}
        </tr>`;
      })}
    `;
  }

  private _renderDataRow(row: T, rowIndex: number, cols: ResolvedColumn<T>[], msg: DataGridMessages) {
    const multi = this.selectionMode === 'multiple';
    const key = this._keyOf(row);
    const selected = this._selectedKeys.has(key);
    const extra = this._rowExtras(row, rowIndex);
    return html`<tr
      class="data ${selected ? 'selected' : ''} ${rowIndex % 2 === 1 ? 'alt' : ''} ${extra.custom ? 'bm-custom ' + extra.names : ''}"
      part="row ${selected ? 'row-selected' : ''} ${extra.names}"
      style=${styleMap(extra.style)}
      aria-selected=${this.selectionMode !== 'none' ? String(selected) : nothing}
      data-ri=${rowIndex - this._navOffset}
      @click=${(e: MouseEvent) => this._onRowClick(row, rowIndex, e)}
      @dblclick=${(e: MouseEvent) => this._onRowDblClick(row, rowIndex, e)}
    >
      ${multi
        ? html`<td class="select-col">
            <input type="checkbox" aria-label=${msg.selectRow} .checked=${live(selected)} @change=${() => this._toggleKey(key)} />
          </td>`
        : nothing}
      ${this._indentCells('td')}
      ${cols.map((col, ci) => {
        const cls = this._cellClass(row, col);
        const ri = rowIndex - this._navOffset;
        const focusable = ri === this._focusRiClamped && ci === Math.min(this._focusCi, cols.length - 1);
        return html`<td part="cell ${cls}" class="${this._alignClass(col)} ${cls}" data-ci=${ci} tabindex=${focusable ? '0' : '-1'}>${this._renderCell(row, col, msg)}</td>`;
      })}
    </tr>`;
  }

  /** Classes/estilo vindos de rowClass e rowStyle. Nomes inválidos para CSS são limpos. */
  private _rowExtras(row: T, rowIndex: number): { names: string; style: RowStyle; custom: boolean } {
    let names = '';
    let style: RowStyle = {};
    try {
      if (this.rowClass) names = cssNames(this.rowClass(row, rowIndex));
      if (this.rowStyle) {
        const s = this.rowStyle(row, rowIndex);
        if (s && typeof s === 'object') {
          const bg = s.background || s['background-color'] || s.backgroundColor;
          style = bg != null && s['--bm-row-bg'] == null ? { ...s, '--bm-row-bg': String(bg) } : s;
        }
      }
    } catch (err) {
      console.error('[bm-data-grid] erro em rowClass/rowStyle', err);
    }
    return { names, style, custom: !!names || Object.keys(style).length > 0 };
  }

  private _cellClass(row: T, col: ResolvedColumn<T>): string {
    const c = col.cssClass;
    if (!c) return '';
    if (typeof c === 'string') return cssNames(c);
    try {
      return cssNames(c(getCellValue(row, col), row));
    } catch (err) {
      console.error('[bm-data-grid] erro em cssClass da coluna ' + col.dataField, err);
      return '';
    }
  }

  private _renderFooter(cols: ResolvedColumn<T>[], msg: DataGridMessages) {
    if (!this.summary || !this.summary.length) return nothing;
    const captions: Record<string, string> = { sum: msg.sum, avg: msg.avg, min: msg.min, max: msg.max, count: msg.count };
    const results = this.summary.map((item, i) => {
      const r = computeSummary(this._result.rows, item, this._ordered, this.locale, captions);
      const rs = this.remoteData ? this._remoteSummary : null;
      if (!rs || rs[i] === undefined) return r;
      const v = rs[i];
      const col = this._columns.find((c) => c.dataField === item.column);
      const fmt = item.valueFormat || (item.summaryType === 'count' ? undefined : col && col.format);
      const label = captions[item.summaryType] || item.summaryType;
      const display = item.displayFormat != null ? item.displayFormat : label + ': {0}';
      return { ...r, value: v, text: v == null ? '' : display.replace('{0}', formatValue(v, 'number', fmt, this.locale)) };
    });
    return html`<tfoot>
      <tr part="summary-row">
        ${this.selectionMode === 'multiple' ? html`<td class="select-col"></td>` : nothing}
        ${this._indentCells('td')}
        ${this._footerCells(cols, results)}
      </tr>
    </tfoot>`;
  }

  /**
   * Células do rodapé: um total ocupa também as colunas vizinhas vazias (colspan),
   * para não quebrar linha em coluna estreita. Colunas fixas não se juntam com outras.
   */
  private _footerCells(cols: ResolvedColumn<T>[], results: { column: string; showInColumn?: string; text: string }[]) {
    const items = cols.map((col) => results.filter((r) => (r.showInColumn || r.column) === col.dataField));
    const spans = footerSpans(
      cols.map((col, i) => ({
        filled: items[i].length > 0,
        align: col.alignment === 'right' ? 'right' : col.alignment === 'center' ? 'center' : 'left',
        locked: !!col.fixed,
      })),
    );
    return spans.map((s) => {
      const col = s.owner >= 0 ? cols[s.owner] : cols[s.start];
      const list = s.owner >= 0 ? items[s.owner] : [];
      return html`<td class="${this._alignClass(col)} ${s.span > 1 ? 'merged' : ''}" colspan=${s.span > 1 ? s.span : nothing} part="summary-cell">
        ${list.map((r) => html`<span class="summary-item" title=${r.text}>${r.text}</span>`)}
      </td>`;
    });
  }

  private _renderPager(msg: DataGridMessages) {
    const p = this._paging;
    if (this.virtualScrolling) {
      if (!p.showInfo) return nothing;
      const n = new Intl.NumberFormat(this.locale).format(this._result.totalCount);
      return html`<div class="pager" part="pager"><span aria-live="polite">${msg.virtualInfo.replace('{0}', n)}</span></div>`;
    }
    if (!p.enabled) return nothing;
    const { pageIndex, pageCount, totalCount } = this._result;

    // Janela de até 5 páginas ao redor da atual
    const start = Math.max(0, Math.min(pageIndex - 2, pageCount - 5));
    const pages: number[] = [];
    for (let i = start; i < Math.min(pageCount, start + 5); i++) pages.push(i);

    const info = msg.pageInfo
      .replace('{0}', String(pageIndex + 1))
      .replace('{1}', String(pageCount))
      .replace('{2}', String(totalCount));

    return html`<div class="pager" part="pager">
      ${p.showPageSizeSelector
        ? html`<label>
            ${msg.pageSize}
            <select
              class="input"
              @change=${(e: Event) => {
                this._pageSize = Number((e.target as HTMLSelectElement).value);
                this._pageIndex = 0;
                this._emitState();
              }}
            >
              ${p.allowedPageSizes.map(
                (s) => html`<option value=${String(s)} ?selected=${s === this._pageSize}>${s}</option>`,
              )}
              ${p.allowedPageSizes.indexOf(this._pageSize) < 0 && this._pageSize > 0
                ? html`<option value=${String(this._pageSize)} selected>${this._pageSize}</option>`
                : nothing}
              <option value="0" ?selected=${this._pageSize === 0}>${msg.all}</option>
            </select>
          </label>`
        : nothing}
      ${p.showInfo ? html`<span aria-live="polite">${info}</span>` : nothing}
      <nav class="pages" aria-label="Pager">
        <button class="btn" type="button" aria-label=${msg.firstPage} ?disabled=${pageIndex === 0} @click=${() => this.goToPage(0)}>«</button>
        <button class="btn" type="button" aria-label=${msg.prevPage} ?disabled=${pageIndex === 0} @click=${() => this.goToPage(pageIndex - 1)}>‹</button>
        ${pages.map(
          (i) => html`<button
            class="btn"
            type="button"
            aria-current=${i === pageIndex ? 'page' : nothing}
            @click=${() => this.goToPage(i)}
          >
            ${i + 1}
          </button>`,
        )}
        <button class="btn" type="button" aria-label=${msg.nextPage} ?disabled=${pageIndex >= pageCount - 1} @click=${() => this.goToPage(pageIndex + 1)}>›</button>
        <button class="btn" type="button" aria-label=${msg.lastPage} ?disabled=${pageIndex >= pageCount - 1} @click=${() => this.goToPage(pageCount - 1)}>»</button>
      </nav>
    </div>`;
  }

  // ---------------------------------------------------------------- largura e colunas fixas

  private _colWidth(col: ResolvedColumn<T>): number | string | undefined {
    const live = this._liveWidths && this._liveWidths[col.dataField];
    return live != null ? live : col.width;
  }

  /**
   * Larguras do `<colgroup>` e da tabela.
   * - Colunas sem largura (ou com largura em %/rem) dividem o espaço que sobra, com no mínimo
   *   `minWidth` (padrão 100px) cada; se não couber, aparece a rolagem lateral.
   * - Se todas tiverem largura em px, a última coluna não fixa estica para ocupar a tela
   *   (sem buraco à direita); quando a soma passa da tela, ela fica com a própria largura.
   * Assim a grid continua acompanhando o tamanho da tela mesmo depois de redimensionar colunas.
   */
  private _colLayout(cols: ResolvedColumn<T>[]): { widths: string[]; table: string } {
    const raw = cols.map((c) => this._colWidth(c));
    if (this.columnAutoWidth) {
      return {
        widths: raw.map((w) => (typeof w === 'number' ? w + 'px' : w || '')),
        table: 'table-layout:auto;width:max-content;min-width:100%',
      };
    }
    let stretch = -1;
    if (raw.length && raw.every((w) => typeof w === 'number')) {
      stretch = raw.length - 1;
      for (let i = raw.length - 1; i >= 0; i--) {
        if (!cols[i].fixed) {
          stretch = i;
          break;
        }
      }
    }
    let total = (this.selectionMode === 'multiple' ? 40 : 0) + this._depth * 28;
    const widths = raw.map((w, i) => {
      const min = cols[i].minWidth || 100;
      if (i === stretch) {
        total += w as number;
        return '';
      }
      if (typeof w === 'number') {
        total += w;
        return w + 'px';
      }
      total += min;
      return w || '';
    });
    return { widths, table: cols.length ? `width:100%;width:max(100%, ${Math.round(total)}px)` : '' };
  }

  /** Larguras atuais (px) das colunas visíveis, medidas no cabeçalho. */
  private _measureWidths(): Record<string, number> {
    const out: Record<string, number> = {};
    this.renderRoot.querySelectorAll<HTMLElement>('tr.headers th[data-field]').forEach((th) => {
      out[th.dataset.field!] = Math.round(th.getBoundingClientRect().width);
    });
    return out;
  }

  /** Largura necessária para mostrar o conteúdo sem cortar (cabeçalho + linhas desenhadas). */
  private _contentWidth(dataField: string): number {
    const th = this.renderRoot.querySelector<HTMLElement>(`tr.headers th[data-field="${CSS.escape(dataField)}"]`);
    if (!th) return 0;
    const text = th.querySelector<HTMLElement>('.th-text');
    let need = text ? th.offsetWidth - text.clientWidth + text.scrollWidth : th.scrollWidth;
    const index = Array.prototype.indexOf.call(th.parentElement!.children, th);
    this.renderRoot.querySelectorAll<HTMLElement>('tbody tr.data').forEach((tr) => {
      const td = tr.children[index] as HTMLElement | undefined;
      if (td) need = Math.max(need, td.scrollWidth + 1);
    });
    const col = this._columns.find((c) => c.dataField === dataField);
    return Math.min(800, Math.max(col && col.minWidth ? col.minWidth : 40, Math.ceil(need) + 2));
  }

  private _onResizeDown(e: PointerEvent, col: ResolvedColumn<T>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // só a coluna arrastada ganha largura fixa; as outras continuam como estão
    const startW = this._measureWidths()[col.dataField] || 100;
    this._resize = {
      field: col.dataField,
      startX: e.clientX,
      startW,
      min: col.minWidth || 40,
      pointerId: e.pointerId,
    };
    this._liveWidths = { [col.dataField]: startW };
    window.addEventListener('pointermove', this._onResizeMove);
    window.addEventListener('pointerup', this._onResizeUp);
    window.addEventListener('pointercancel', this._onResizeUp);
  }

  private _onResizeMove = (e: PointerEvent) => {
    const r = this._resize;
    if (!r || e.pointerId !== r.pointerId) return;
    e.preventDefault();
    const w = Math.max(r.min, Math.round(r.startW + e.clientX - r.startX));
    this._liveWidths = { ...this._liveWidths, [r.field]: w };
  };

  private _onResizeUp = (e: PointerEvent) => {
    const r = this._resize;
    if (!r || e.pointerId !== r.pointerId) return;
    window.removeEventListener('pointermove', this._onResizeMove);
    window.removeEventListener('pointerup', this._onResizeUp);
    window.removeEventListener('pointercancel', this._onResizeUp);
    const widths = this._liveWidths;
    this._resize = null;
    this._liveWidths = null;
    // o clique que vem depois de soltar não deve ordenar
    this._suppressClick = true;
    setTimeout(() => (this._suppressClick = false), 0);
    if (widths) this._setLayout(setColumnWidths(this._layout, widths));
  };

  /**
   * Colunas fixas: gera CSS com position: sticky por posição (nth-child), a partir das
   * larguras medidas no cabeçalho. Seleção e recuo dos grupos ficam sempre presos à esquerda.
   */
  private _updateFixedCss() {
    const header = this.renderRoot.querySelector('tr.headers') as HTMLElement | null;
    let css = '';
    if (header) {
      const multi = this.selectionMode === 'multiple';
      const grouped = new Set(this._groups.map((g) => g.field));
      const fixedCount = this._ordered.filter((c) => c.visible && c.fixed && !grouped.has(c.dataField)).length;
      const lead = (multi ? 1 : 0) + this._depth + fixedCount;
      const cells = Array.from(header.children) as HTMLElement[];
      const rules: string[] = [];
      let left = 0;
      for (let k = 0; k < lead && k < cells.length; k++) {
        const n = k + 1;
        const at = `left:${Math.round(left)}px`;
        rules.push(
          `thead tr>:nth-child(${n}),tfoot tr>:nth-child(${n}),tbody tr.data>:nth-child(${n}){position:sticky;${at}}`,
          `thead tr>:nth-child(${n}){z-index:3}tfoot tr>:nth-child(${n}){z-index:2}`,
          `tbody tr.data>:nth-child(${n}){z-index:1;background:linear-gradient(var(--_fxt),var(--_fxt)),linear-gradient(var(--bm-row-bg,transparent),var(--bm-row-bg,transparent)),var(--_bg) !important}`,
          `tbody tr.group-row>td.select-col:nth-child(${n}),tbody tr.group-row>td.group-indent:nth-child(${n}){position:sticky;${at};z-index:1}`,
        );
        left += cells[k].getBoundingClientRect().width;
      }
      if (fixedCount > 0 && lead <= cells.length) {
        rules.push(`thead tr>:nth-child(${lead}),tfoot tr>:nth-child(${lead}),tbody tr.data>:nth-child(${lead}){box-shadow:inset -2px 0 0 var(--_border)}`);
      }
      css = rules.join('\n');
    }
    if (css === this._fxCss) return;
    this._fxCss = css;
    if (!this._fxStyle) {
      this._fxStyle = document.createElement('style');
      this.renderRoot.appendChild(this._fxStyle);
    }
    this._fxStyle.textContent = css;
  }

  // ---------------------------------------------------------------- teclado e copiar

  /** Índice inicial (na contagem rowIndex) da lista navegável atual. */
  private get _navOffset(): number {
    return this.virtualScrolling ? 0 : this._result.pageIndex * (this._pageSize || 0);
  }

  /** Linhas de dados navegáveis, na ordem da tela (página atual ou toda a rolagem virtual). */
  private _navRows(): T[] {
    const items = this._result.items;
    return items ? items.filter((it) => it.type === 'data').map((it) => (it as { row: T }).row) : this._result.pageRows;
  }

  private get _focusRiClamped(): number {
    const n = this._navRows().length;
    return Math.max(0, Math.min(this._focusRi, n - 1));
  }

  private _onTableFocus = (e: FocusEvent) => {
    const td = (e.composedPath()[0] as HTMLElement).closest ? (e.composedPath()[0] as HTMLElement).closest('td[data-ci]') : null;
    const tr = td && (td.parentElement as HTMLElement);
    if (!td || !tr || tr.dataset.ri == null) return;
    const ri = Number(tr.dataset.ri);
    const ci = Number((td as HTMLElement).dataset.ci);
    if (ri !== this._focusRi) this._focusRi = ri;
    if (ci !== this._focusCi) this._focusCi = ci;
  };

  /** Move o foco para a célula (ri, ci), mudando de página ou rolando se preciso. */
  private async _moveFocus(ri: number, ci: number) {
    const rows = this._navRows();
    const cols = this.renderRoot.querySelectorAll('tr.headers th[data-field]').length;
    this._focusRi = Math.max(0, Math.min(ri, rows.length - 1));
    this._focusCi = Math.max(0, Math.min(ci, cols - 1));
    if (this.virtualScrolling && rows[this._focusRi]) this.navigateToRow(this._keyOf(rows[this._focusRi]));
    await this.updateComplete;
    if (this.virtualScrolling) await new Promise((r) => requestAnimationFrame(() => r(null)));
    await this.updateComplete;
    const td = this.renderRoot.querySelector<HTMLElement>(`tr[data-ri="${this._focusRi}"] td[data-ci="${this._focusCi}"]`);
    if (td) {
      td.focus();
      if (td.scrollIntoView) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  private _onTableKey = (e: KeyboardEvent) => {
    const target = e.composedPath()[0] as HTMLElement;
    const td = target && target.closest ? (target.closest('td[data-ci]') as HTMLElement | null) : null;
    const tr = td && (td.parentElement as HTMLElement);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'c' || e.key === 'C') && !this._isTextTarget(target)) {
      if (this.copySelection(td ? Number(td.dataset.ci) : undefined, tr ? Number(tr.dataset.ri) : undefined)) e.preventDefault();
      return;
    }
    if (!td || !tr || tr.dataset.ri == null) return;
    const ri = Number(tr.dataset.ri);
    const ci = Number(td.dataset.ci);
    const rows = this._navRows();
    const last = rows.length - 1;
    const lastCol = this.renderRoot.querySelectorAll('tr.headers th[data-field]').length - 1;
    const paged = !this.virtualScrolling && this._pageSize > 0;
    const page = this._result.pageIndex;
    const pages = this._result.pageCount;
    const goPage = (p: number, where: 'first' | 'last') => {
      this._focusAfterPage = where;
      this._focusCi = ci;
      this.goToPage(p);
    };
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        if (ri < last) void this._moveFocus(ri + 1, ci);
        else if (paged && page < pages - 1) goPage(page + 1, 'first');
        break;
      case 'ArrowUp':
        if (ri > 0) void this._moveFocus(ri - 1, ci);
        else if (paged && page > 0) goPage(page - 1, 'last');
        break;
      case 'ArrowRight':
        void this._moveFocus(ri, Math.min(lastCol, ci + 1));
        break;
      case 'ArrowLeft':
        void this._moveFocus(ri, Math.max(0, ci - 1));
        break;
      case 'Home':
        void this._moveFocus(mod ? 0 : ri, 0);
        break;
      case 'End':
        void this._moveFocus(mod ? last : ri, lastCol);
        break;
      case 'PageDown':
        if (paged) {
          if (page < pages - 1) goPage(page + 1, 'first');
          else void this._moveFocus(last, ci);
        } else void this._moveFocus(ri + Math.max(1, Math.floor(this._viewH / this._rowH) - 1), ci);
        break;
      case 'PageUp':
        if (paged) {
          if (page > 0) goPage(page - 1, 'first');
          else void this._moveFocus(0, ci);
        } else void this._moveFocus(ri - Math.max(1, Math.floor(this._viewH / this._rowH) - 1), ci);
        break;
      case ' ': {
        const row = rows[ri];
        if (!row || this.selectionMode === 'none') {
          handled = false;
          break;
        }
        const key = this._keyOf(row);
        if (this.selectionMode === 'single') this._setSelection(new Set([key]));
        else this._toggleKey(key);
        this._lastClickedKey = key;
        break;
      }
      case 'Enter': {
        const row = rows[ri];
        if (row) this._emit('row-enter', { data: row, key: this._keyOf(row), rowIndex: ri + this._navOffset });
        break;
      }
      case 'a':
      case 'A':
        if (mod && this.selectionMode === 'multiple') this.selectAll();
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };

  private _isTextTarget(el: HTMLElement | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const t = (el as HTMLInputElement).type;
      return t !== 'checkbox' && t !== 'radio';
    }
    return !!el.isContentEditable;
  }

  /**
   * Copia para a área de transferência, em formato que cola no Excel (colunas separadas por TAB):
   * as linhas selecionadas (com cabeçalho) ou, sem seleção, a célula com foco.
   * Retorna o texto copiado (ou '' se não havia o que copiar).
   */
  copySelection(cellIndex?: number, rowIndex?: number): string {
    const msg = this._msg;
    const grouped = new Set(this._groups.map((g) => g.field));
    const cols = fixedFirst(this._ordered.filter((c) => c.visible && !grouped.has(c.dataField)));
    const clean = (t: string) => t.replace(/[\t\r\n]+/g, ' ');
    const text = (row: T, c: ResolvedColumn<T>) => clean(formatValue(getCellValue(row, c), c.dataType, c.format, this.locale, row, msg));
    let out = '';
    let count = 0;
    const selected = this.selectionMode !== 'none' ? this._result.rows.filter((r) => this._selectedKeys.has(this._keyOf(r))) : [];
    if (selected.length) {
      out = [cols.map((c) => clean(c.caption)).join('\t'), ...selected.map((r) => cols.map((c) => text(r, c)).join('\t'))].join('\r\n');
      count = selected.length;
      this._showStatus(msg.copiedRows.replace('{0}', String(count)));
    } else {
      const rows = this._navRows();
      const row = rows[rowIndex != null ? rowIndex : this._focusRiClamped];
      const col = cols[cellIndex != null ? cellIndex : Math.min(this._focusCi, cols.length - 1)];
      if (!row || !col) return '';
      out = text(row, col);
      this._showStatus(msg.copiedCell);
    }
    this._writeClipboard(out);
    this._emit('copy-rows', { text: out, rowCount: count });
    return out;
  }

  private _writeClipboard(text: string) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => this._legacyCopy(text));
        return;
      }
    } catch {
      /* cai no método antigo */
    }
    this._legacyCopy(text);
  }

  private _legacyCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* sem permissão: nada a fazer */
    }
    ta.remove();
  }

  private _showStatus(text: string) {
    this._status = text;
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => (this._status = ''), 2000);
  }

  protected render(): TemplateResult {
    const msg = this._msg;
    const grouped = new Set(this._groups.map((g) => g.field));
    const cols = fixedFirst(this._ordered.filter((c) => c.visible && !grouped.has(c.dataField)));
    const multi = this.selectionMode === 'multiple';
    const lay = this._colLayout(cols);
    this._tplWanted.clear();

    return html`
      <div class="grid" part="grid">
        ${this._renderToolbar(msg)} ${this._renderGroupPanel(msg)}
        <div class="scroller" part="scroller" @scroll=${this._onScroll}>
          <table
            role="grid"
            aria-rowcount=${this._result.totalCount}
            aria-multiselectable=${multi ? 'true' : nothing}
            style=${lay.table}
            @keydown=${this._onTableKey}
            @focusin=${this._onTableFocus}
          >
            <colgroup>
              ${multi ? html`<col style="width:40px" />` : nothing}
              ${this._indentCells('col')}
              ${cols.map((col, i) => {
                const w = lay.widths[i];
                const min = col.minWidth != null ? `min-width:${col.minWidth}px;` : '';
                return html`<col style=${(w ? `width:${w};` : '') + min} />`;
              })}
            </colgroup>
            ${this._renderHeader(cols, msg)} ${this._renderBody(cols, msg)} ${this._renderFooter(cols, msg)}
          </table>
        </div>
        ${this._renderFilterPanel(msg)} ${this._renderPager(msg)}
        ${this.loading || this._remoteLoading
          ? html`<div class="loading-overlay" part="loading" role="status"><span class="spinner" aria-hidden="true"></span>${this._msg.loading}</div>`
          : nothing}
        <span class="sr-only" role="status" aria-live="polite">${this._status}</span>
        ${this._status ? html`<div class="toast" aria-hidden="true">${this._status}</div>` : nothing}
        ${this._renderHeaderFilterPopup(msg)} ${this._renderOpMenu(msg)}
        ${this._ghost
          ? html`<div class="ghost" aria-hidden="true" style="left:${this._ghost.x + 8}px;top:${this._ghost.y + 8}px">${this._ghost.text}</div>`
          : nothing}
      </div>
    `;
  }
}

/** Registra o elemento (idempotente — seguro se o pacote for carregado duas vezes). */
export function defineDataGrid(tagName = 'bm-data-grid'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, class extends BmDataGrid {});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bm-data-grid': BmDataGrid;
  }
}
