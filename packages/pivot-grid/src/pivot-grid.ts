import { LitElement, html, nothing, svg } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { applyThemeAttributes, CONFIG_EVENT, getConfig, XLSX_MIME } from '@brunomouradev/data-grid/engine';
import { conditionalStats, conditionalStyle, displayValue, formatDisplay, pivotToXlsx } from './engine/display';
import type { ConditionalStats } from './engine/display';
import type { Appearance, Density, ThemeName } from '@brunomouradev/data-grid/engine';
import {
  buildCube,
  buildView,
  distinctValues,
  drillDown,
  fieldText,
  pivotToCsv,
  resolveFields,
  valueKey,
} from './engine/index';
import type {
  ExpansionState,
  PivotArea,
  PivotColumnItem,
  PivotCube,
  PivotField,
  PivotHeaderCell,
  PivotRowHeaderCell,
  PivotRowItem,
  PivotRowLayout,
  PivotView,
  ResolvedPivotField,
  SortOrder,
  SummaryType,
  SummaryDisplayMode,
} from './engine/types';
import { defaultPivotMessages } from './messages';
import type { PivotGridMessages } from './messages';
import { pivotStyles } from './styles';

export interface PivotCellEventDetail<T = any> {
  rowPath: any[];
  columnPath: any[];
  rowFields: string[];
  columnFields: string[];
  dataField: string;
  value: number | null;
  rowType: 'value' | 'total' | 'grand';
  columnType: 'value' | 'total' | 'grand';
  /** Só em `cell-dblclick`: registros que compõem a célula. */
  records?: T[];
  originalEvent: MouseEvent;
}

export interface FieldsChangedDetail {
  fields: PivotField[];
}

type ZoneArea = PivotArea | 'available';

interface FilterPopupState {
  name: string;
  values: any[];
  selected: Set<string>;
  search: string;
  top: number;
  left: number;
}

const SUMMARY_TYPES: SummaryType[] = ['sum', 'avg', 'count', 'min', 'max'];
const DISPLAY_MODES: SummaryDisplayMode[] = [
  'absolute',
  'percentOfGrandTotal',
  'percentOfRowTotal',
  'percentOfColumnTotal',
  'percentOfParentRow',
  'percentOfParentColumn',
  'differenceFromPrevious',
  'percentDifferenceFromPrevious',
  'runningTotal',
];

function defaultLocale(): string {
  if (typeof document !== 'undefined' && document.documentElement.lang) return document.documentElement.lang;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'pt-BR';
}

const filterIcon = svg`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 2h14l-5.5 6.5V14l-3-1.5V8.5z"/></svg>`;

/**
 * `<bm-pivot-grid>` — tabela dinâmica (pivot) com hierarquias de linhas e colunas,
 * subtotais, total geral, filtros por valores, painel de campos com arrastar e soltar
 * e exportação CSV.
 *
 * @fires cell-click     - Clique numa célula de valor. detail: PivotCellEventDetail
 * @fires cell-dblclick  - Duplo clique (inclui `records`, o drill down). detail: PivotCellEventDetail
 * @fires fields-changed - Layout alterado pelo usuário (área, ordem, filtro, ordenação, agregação). detail: FieldsChangedDetail
 * @fires content-ready  - Pivot recalculada.
 */
export class BmPivotGrid<T = any> extends LitElement {
  static styles = pivotStyles;

  // ---------------------------------------------------------------- props

  @property({ attribute: false }) dataSource: T[] = [];

  /** Campos e suas áreas (row, column, data, filter). Campos sem área ficam disponíveis no painel. */
  @property({ attribute: false }) fields: PivotField<T>[] = [];

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

  @property({ attribute: false }) messages: Partial<PivotGridMessages> = {};

  /** Mostra o painel de campos (arrastar entre Filtros / Colunas / Linhas / Valores). */
  @property({ type: Boolean, attribute: 'show-field-panel', reflect: true }) showFieldPanel = false;

  @property({ type: Boolean, attribute: 'show-export-button', reflect: true }) showExportButton = false;

  /** Botões "Expandir tudo" / "Recolher tudo". */
  @property({ type: Boolean, attribute: 'show-expand-buttons', reflect: true }) showExpandButtons = false;

  @property({ attribute: false }) showRowGrandTotals = true;
  @property({ attribute: false }) showColumnGrandTotals = true;
  /** Colunas de subtotal ao lado de cada grupo de colunas expandido. */
  @property({ attribute: false }) showColumnTotals = true;

  @property({ attribute: false }) allowFieldDragging = true;
  @property({ attribute: false }) allowSorting = true;
  @property({ attribute: false }) allowFiltering = true;

  /**
   * "tree" (padrão): uma coluna de cabeçalho com recuo e subtotal na linha do grupo.
   * "tabular": uma coluna por campo de linha e subtotal numa linha "X Total" abaixo do grupo.
   */
  @property({ attribute: 'row-layout', reflect: true }) rowLayout: PivotRowLayout = 'tree';

  /** Layout tabular: linha de subtotal abaixo de cada grupo expandido. */
  @property({ attribute: false }) showRowTotals = true;

  /** Largura da coluna de cabeçalho das linhas (px). No layout tabular, é a largura de cada coluna. */
  @property({ type: Number, attribute: 'row-header-width' }) rowHeaderWidth = 220;

  @property({ attribute: 'export-file-name' }) exportFileName = 'pivot';

  /** Formatos do botão de exportar. Com mais de um, o botão abre um menu. Atributo: export-formats="xlsx,csv". */
  @property({
    attribute: 'export-formats',
    converter: { fromAttribute: (v: string | null) => (v || 'xlsx,csv').split(',').map((x) => x.trim()).filter((x) => x === 'xlsx' || x === 'csv') },
  })
  exportFormats: ('xlsx' | 'csv')[] = ['xlsx', 'csv'];

  @state() private _exportOpen = false;

  // ---------------------------------------------------------------- state

  @state() private _fields: ResolvedPivotField<T>[] = [];
  @state() private _rowExp: ExpansionState = { overrides: {} };
  @state() private _colExp: ExpansionState = { overrides: {} };
  @state() private _popup: FilterPopupState | null = null;
  @state() private _dragName: string | null = null;
  @state() private _dropZone: ZoneArea | null = null;
  @state() private _dropIndex = -1;

  private _cube?: PivotCube;
  private _view?: PivotView;

  // ---------------------------------------------------------------- lifecycle

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(CONFIG_EVENT, this._onConfig);
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    document.addEventListener('keydown', this._onDocKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(CONFIG_EVENT, this._onConfig);
    this._endDrag();
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    document.removeEventListener('keydown', this._onDocKeyDown);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    applyThemeAttributes(this);
    if (changed.has('fields') || changed.has('locale') || (changed.has('dataSource') && !this._fields.length)) {
      this._fields = resolveFields(this.fields || [], this.dataSource || [], this.locale);
      this._rowExp = { overrides: {} };
      this._colExp = { overrides: {} };
    }
    if (
      !this._cube ||
      changed.has('dataSource') ||
      changed.has('locale') ||
      changed.has('_fields' as keyof BmPivotGrid)
    ) {
      this._cube = buildCube(this.dataSource || [], this._fields, this.locale, this._msg.blank);
      this._contentChanged = true;
    }
    this._view = buildView(this._cube, {
      rowExpansion: this._rowExp,
      columnExpansion: this._colExp,
      showRowGrandTotals: this.showRowGrandTotals,
      showColumnGrandTotals: this.showColumnGrandTotals,
      showColumnTotals: this.showColumnTotals,
      texts: { total: this._msg.total, grandTotal: this._msg.grandTotal },
      rowLayout: this.rowLayout,
      showRowTotals: this.showRowTotals,
    });
  }

  private _contentChanged = false;

  protected updated(): void {
    this.style.setProperty('--_row-header-w', (this.rowLayout === 'tabular' ? Math.min(this.rowHeaderWidth, 160) : this.rowHeaderWidth) + 'px');
    if (this._contentChanged) {
      this._contentChanged = false;
      this.dispatchEvent(new CustomEvent('content-ready', { bubbles: true, composed: true }));
    }
  }

  private get _msg(): PivotGridMessages {
    return { ...defaultPivotMessages(this.locale), ...(this.messages || {}) };
  }

  // ---------------------------------------------------------------- API pública

  /** Recalcula (use depois de alterar o array `dataSource` "por dentro"). */
  refresh(): void {
    this._cube = undefined;
    this.requestUpdate();
  }

  /** Layout atual dos campos (para salvar e restaurar depois via `fields`). */
  getFields(): PivotField<T>[] {
    return this._fields.map((f) => ({ ...f }));
  }

  expandAll(area: 'row' | 'column' | 'both' = 'both'): void {
    if (area !== 'column') this._rowExp = { overrides: {}, all: true };
    if (area !== 'row') this._colExp = { overrides: {}, all: true };
  }

  collapseAll(area: 'row' | 'column' | 'both' = 'both'): void {
    if (area !== 'column') this._rowExp = { overrides: {}, all: false };
    if (area !== 'row') this._colExp = { overrides: {}, all: false };
  }

  /** Registros por trás de uma célula. Caminhos com os valores dos campos (ex.: ['Sul', 'PR'], [2026]). */
  drillDown(rowPath: any[], columnPath: any[]): T[] {
    return drillDown(this.dataSource || [], this._fields, this._cube!, rowPath, columnPath);
  }

  getCsv(separator = ';'): string {
    return pivotToCsv(this._cube!, this._view!, this.locale, separator);
  }

  exportToCsv(fileName = this.exportFileName): void {
    this._exportOpen = false;
    this._download(new Blob(['\uFEFF' + this.getCsv()], { type: 'text/csv;charset=utf-8' }), fileName.endsWith('.csv') ? fileName : fileName + '.csv');
  }

  /** Arquivo Excel (.xlsx) do que está visível: cabeçalhos mesclados, números de verdade e totais em negrito. */
  getXlsx(sheetName = 'Pivot'): Uint8Array {
    return pivotToXlsx(this._cube!, this._view!, { locale: this.locale, sheetName });
  }

  /** Baixa o Excel (.xlsx) da pivot. */
  exportToExcel(fileName = this.exportFileName): void {
    this._exportOpen = false;
    this._download(new Blob([this.getXlsx()], { type: XLSX_MIME }), fileName.endsWith('.xlsx') ? fileName : fileName + '.xlsx');
  }

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

  // ---------------------------------------------------------------- campos

  /**
   * Altera um campo pelo name (ou dataField): área, ordenação, filtro, summaryType,
   * summaryDisplayMode, conditionalFormat, topN... Ex.: updateField('uf', { topN: { count: 5 } }).
   */
  updateField(name: string, patch: Partial<PivotField<T>>): void {
    const f = this._fields.find((x) => x.name === name) || this._fields.find((x) => x.dataField === name);
    if (f) this._updateField(f.name, patch);
  }

  private _updateField(name: string, patch: Partial<PivotField<T>>) {
    this._fields = this._fields.map((f) => (f.name === name ? { ...f, ...patch } : f));
    this._emitFieldsChanged();
  }

  private _emitFieldsChanged() {
    this.dispatchEvent(
      new CustomEvent<FieldsChangedDetail>('fields-changed', {
        detail: { fields: this.getFields() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _fieldsIn(area: ZoneArea): ResolvedPivotField<T>[] {
    return this._fields
      .map((f, i) => ({ f, i }))
      .filter((x) => (area === 'available' ? !x.f.area : x.f.area === area))
      .sort((a, b) => (a.f.areaIndex ?? a.i) - (b.f.areaIndex ?? b.i) || a.i - b.i)
      .map((x) => x.f);
  }

  /** Move um campo para outra área/posição e renumera os areaIndex. */
  moveField(name: string, area: PivotArea | undefined, index = -1): void {
    const field = this._fields.find((f) => f.name === name);
    if (!field) return;
    const target: ZoneArea = area || 'available';
    const ordered = this._fieldsIn(target).filter((f) => f.name !== name);
    const at = index < 0 || index > ordered.length ? ordered.length : index;
    ordered.splice(at, 0, field);

    const patch = new Map<string, Partial<ResolvedPivotField<T>>>();
    ordered.forEach((f, i) => patch.set(f.name, { area, areaIndex: i }));
    if (field.area && field.area !== area) {
      this._fieldsIn(field.area)
        .filter((f) => f.name !== name)
        .forEach((f, i) => patch.set(f.name, { areaIndex: i }));
    }
    this._fields = this._fields.map((f) => (patch.has(f.name) ? { ...f, ...patch.get(f.name) } : f));
    this._rowExp = { overrides: {}, all: this._rowExp.all };
    this._colExp = { overrides: {}, all: this._colExp.all };
    this._emitFieldsChanged();
  }

  /**
   * Ordena as linhas (todos os níveis) pelo total de um campo de dados numa coluna.
   * `columnPath` vazio = coluna de total geral. `dataField` null desliga a ordenação por total.
   */
  sortBySummary(dataField: string | null, columnPath: any[] = [], order: SortOrder = 'desc'): void {
    const patch: Partial<PivotField<T>> = dataField
      ? { sortBySummaryField: dataField, sortBySummaryPath: columnPath, sortOrder: order }
      : { sortBySummaryField: undefined, sortBySummaryPath: undefined, sortOrder: 'asc' };
    this._fields = this._fields.map((f) => (f.area === 'row' ? { ...f, ...patch } : f));
    this._emitFieldsChanged();
  }

  /** Clique no cabeçalho-folha: decrescente → crescente → sem ordenação por total. */
  private _onHeaderSort(c: PivotHeaderCell) {
    if (!this.allowSorting || c.dataIndex === undefined) return;
    const field = this._cube!.dataFields[c.dataIndex];
    if (c.sortOrder === 'asc') this.sortBySummary(null);
    else this.sortBySummary(field.name, c.path || [], c.sortOrder === 'desc' ? 'asc' : 'desc');
  }

  private _toggleSort(f: ResolvedPivotField<T>) {
    this._updateField(f.name, { sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc' });
  }

  // ---------------------------------------------------------------- arrastar campos
  // Pointer Events (e não o Drag and Drop nativo do HTML5) para funcionar também em touch.

  @state() private _ghost: { text: string; x: number; y: number } | null = null;
  private _pending: { name: string; text: string; x: number; y: number; pointerId: number } | null = null;

  private _onChipPointerDown(e: PointerEvent, f: ResolvedPivotField<T>) {
    if (!this.allowFieldDragging || f.allowDragging === false || e.button !== 0) return;
    const target = e.composedPath()[0] as HTMLElement;
    if (target.closest && target.closest('button, select')) return;
    this._pending = { name: f.name, text: f.caption, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerCancel);
  }

  private _onPointerMove = (e: PointerEvent) => {
    const p = this._pending;
    if (!p || e.pointerId !== p.pointerId) return;
    if (!this._dragName) {
      if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) < 5) return;
      this._dragName = p.name;
      this._popup = null;
    }
    e.preventDefault();
    this._ghost = { text: p.text, x: e.clientX, y: e.clientY };

    const root = this.renderRoot as ShadowRoot;
    const el = root.elementFromPoint ? root.elementFromPoint(e.clientX, e.clientY) : null;
    const zone = el ? (el.closest('.zone') as HTMLElement | null) : null;
    if (!zone) {
      this._dropZone = null;
      this._dropIndex = -1;
      return;
    }
    this._dropZone = zone.dataset.area as ZoneArea;
    this._dropIndex = this._dropIndexAt(zone, e.clientX, e.clientY);
  };

  private _onPointerUp = (e: PointerEvent) => {
    if (!this._pending || e.pointerId !== this._pending.pointerId) return;
    const name = this._dragName;
    const zone = this._dropZone;
    const index = this._dropIndex;
    this._endDrag();
    if (name && zone) this.moveField(name, zone === 'available' ? undefined : zone, index);
  };

  private _onPointerCancel = () => this._endDrag();

  private _endDrag() {
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerCancel);
    this._pending = null;
    this._dragName = null;
    this._dropZone = null;
    this._dropIndex = -1;
    this._ghost = null;
  }

  /** Posição de inserção: antes do primeiro chip à direita/abaixo do ponteiro. */
  private _dropIndexAt(zone: HTMLElement, x: number, y: number): number {
    const chips = Array.from(zone.querySelectorAll<HTMLElement>('.chip')).filter(
      (c) => c.dataset.name !== this._dragName,
    );
    for (let i = 0; i < chips.length; i++) {
      const r = chips[i].getBoundingClientRect();
      const sameLine = y >= r.top && y <= r.bottom;
      if ((sameLine && x < r.left + r.width / 2) || y < r.top) return i;
    }
    return chips.length;
  }

  // ---------------------------------------------------------------- filtro

  private _openFilter(e: MouseEvent, f: ResolvedPivotField<T>) {
    e.stopPropagation();
    if (this._popup && this._popup.name === f.name) {
      this._popup = null;
      return;
    }
    const values = distinctValues(this.dataSource || [], f, this.locale);
    const allKeys = values.map(valueKey);
    let selected: Set<string>;
    if (!Array.isArray(f.filterValues)) selected = new Set(allKeys);
    else {
      const keys = new Set(f.filterValues.map(valueKey));
      selected = new Set(f.filterType === 'exclude' ? allKeys.filter((k) => !keys.has(k)) : allKeys.filter((k) => keys.has(k)));
    }
    const host = this.renderRoot.querySelector('.pivot') as HTMLElement;
    const hostRect = host.getBoundingClientRect();
    const btnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.max(8, Math.min(btnRect.left - hostRect.left - 8, hostRect.width - 268));
    this._popup = { name: f.name, values, selected, search: '', top: btnRect.bottom - hostRect.top + 4, left };
  }

  private _applyFilter() {
    const p = this._popup;
    if (!p) return;
    const f = this._fields.find((x) => x.name === p.name)!;
    const all = p.values.length;
    const sel = p.values.filter((v) => p.selected.has(valueKey(v)));
    let patch: Partial<PivotField<T>>;
    if (sel.length === all) patch = { filterValues: undefined, filterType: undefined };
    else if (sel.length <= all / 2) patch = { filterValues: sel, filterType: 'include' };
    else patch = { filterValues: p.values.filter((v) => !p.selected.has(valueKey(v))), filterType: 'exclude' };
    this._popup = null;
    this._updateField(f.name, patch);
  }

  private _onDocPointerDown = (e: PointerEvent) => {
    const path = e.composedPath();
    if (this._exportOpen && !path.some((n) => n instanceof HTMLElement && (n.classList.contains('export-menu') || n.classList.contains('export-btn')))) {
      this._exportOpen = false;
    }
    if (!this._popup) return;
    const popup = this.renderRoot.querySelector('.popup');
    if (popup && path.indexOf(popup) < 0) {
      const opener = path.find((n) => n instanceof HTMLElement && n.dataset && n.dataset.filterFor === this._popup!.name);
      if (!opener) this._popup = null;
    }
  };

  private _onDocKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._popup) this._popup = null;
    if (e.key === 'Escape' && this._exportOpen) this._exportOpen = false;
  };

  // ---------------------------------------------------------------- expandir / células

  private _toggleRow(item: { pathKey: string; expanded: boolean }) {
    this._rowExp = { ...this._rowExp, overrides: { ...this._rowExp.overrides, [item.pathKey]: !item.expanded } };
  }

  private _toggleColumn(cell: PivotHeaderCell) {
    this._colExp = { ...this._colExp, overrides: { ...this._colExp.overrides, [cell.pathKey!]: !cell.expanded } };
  }

  private _cellDetail(row: PivotRowItem, col: PivotColumnItem, value: number | null, e: MouseEvent): PivotCellEventDetail<T> {
    const cube = this._cube!;
    return {
      rowPath: row.path,
      columnPath: col.path,
      rowFields: cube.rowFields.slice(0, row.path.length).map((f) => f.name),
      columnFields: cube.columnFields.slice(0, col.path.length).map((f) => f.name),
      dataField: cube.dataFields[col.dataIndex].name,
      value,
      rowType: row.isGrandTotal ? 'grand' : row.isTotal ? 'total' : 'value',
      columnType: col.type,
      originalEvent: e,
    };
  }

  private _onCellClick(row: PivotRowItem, col: PivotColumnItem, value: number | null, e: MouseEvent) {
    this.dispatchEvent(new CustomEvent('cell-click', { detail: this._cellDetail(row, col, value, e), bubbles: true, composed: true }));
  }

  private _onCellDblClick(row: PivotRowItem, col: PivotColumnItem, value: number | null, e: MouseEvent) {
    const detail = this._cellDetail(row, col, value, e);
    detail.records = this.drillDown(row.path, col.path);
    this.dispatchEvent(new CustomEvent('cell-dblclick', { detail, bubbles: true, composed: true }));
  }

  private _formatCell(value: number | null, dataIndex: number): string {
    return formatDisplay(value, this._cube!.dataFields[dataIndex], this.locale);
  }

  // ---------------------------------------------------------------- render

  private _renderChip(f: ResolvedPivotField<T>, area: ZoneArea, msg: PivotGridMessages) {
    const draggable = this.allowFieldDragging && f.allowDragging !== false;
    const canSort = this.allowSorting && f.allowSorting !== false && (area === 'row' || area === 'column');
    const canFilter = this.allowFiltering && f.allowFiltering !== false && area !== 'data';
    const filtered = Array.isArray(f.filterValues);
    // índice "visual" ignora o chip que está sendo arrastado
    const others = this._fieldsIn(area).filter((x) => x.name !== this._dragName);
    const insertBefore =
      !!this._dragName && this._dropZone === area && this._dragName !== f.name && others[this._dropIndex] === f;
    const summaryLabel: Record<SummaryType, string> = { sum: msg.sum, avg: msg.avg, count: msg.count, min: msg.min, max: msg.max };

    return html`<span
      class="chip ${this._dragName === f.name ? 'dragging' : ''} ${insertBefore ? 'insert-before' : ''}"
      part="field-chip"
      data-name=${f.name}
      data-draggable=${draggable ? 'true' : 'false'}
      @pointerdown=${(e: PointerEvent) => this._onChipPointerDown(e, f)}
      title=${f.caption}
    >
      <span class="chip-text">${f.caption}</span>
      ${area === 'data'
        ? html`<select
            aria-label=${f.caption}
            @change=${(e: Event) => this._updateField(f.name, { summaryType: (e.target as HTMLSelectElement).value as SummaryType })}
          >
            ${SUMMARY_TYPES.map((t) => html`<option value=${t} ?selected=${t === f.summaryType}>${summaryLabel[t]}</option>`)}
          </select>
          <select
            class="display-mode"
            aria-label=${msg.showValuesAs + ': ' + f.caption}
            title=${msg.showValuesAs}
            @change=${(e: Event) => this._updateField(f.name, { summaryDisplayMode: (e.target as HTMLSelectElement).value as SummaryDisplayMode })}
          >
            ${DISPLAY_MODES.map((m) => html`<option value=${m} ?selected=${m === (f.summaryDisplayMode || 'absolute')}>${msg.displayModes[m] || m}</option>`)}
          </select>`
        : nothing}
      ${canSort
        ? html`<button
            class="icon-btn"
            type="button"
            title=${f.sortOrder === 'asc' ? msg.sortAsc : msg.sortDesc}
            aria-label=${f.sortOrder === 'asc' ? msg.sortAsc : msg.sortDesc}
            @click=${() => this._toggleSort(f)}
          >
            ${f.sortOrder === 'asc' ? '▲' : '▼'}
          </button>`
        : nothing}
      ${canFilter
        ? html`<button
            class="icon-btn ${filtered ? 'active' : ''}"
            type="button"
            data-filter-for=${f.name}
            title=${msg.filter}
            aria-label=${msg.filter + ': ' + f.caption}
            aria-haspopup="dialog"
            aria-expanded=${this._popup && this._popup.name === f.name ? 'true' : 'false'}
            @click=${(e: MouseEvent) => this._openFilter(e, f)}
          >
            ${filterIcon}
          </button>`
        : nothing}
    </span>`;
  }

  private _renderZone(area: ZoneArea, title: string, msg: PivotGridMessages) {
    const fields = this._fieldsIn(area);
    return html`<div
      class="zone ${this._dropZone === area ? 'drop-target' : ''}"
      part="field-zone"
      data-area=${area}
    >
      <div class="zone-title">${title}</div>
      <div class="chips">
        ${fields.length
          ? fields.map((f) => this._renderChip(f, area, msg))
          : html`<span class="empty-hint">${msg.dropHere}</span>`}
      </div>
    </div>`;
  }

  private _renderFieldPanel(msg: PivotGridMessages) {
    if (!this.showFieldPanel) return nothing;
    return html`<div class="field-panel" part="field-panel">
      ${this._renderZone('available', msg.availableFields, msg)} ${this._renderZone('filter', msg.filterArea, msg)}
      ${this._renderZone('column', msg.columnArea, msg)} ${this._renderZone('row', msg.rowArea, msg)}
      ${this._renderZone('data', msg.dataArea, msg)}
    </div>`;
  }

  private _renderToolbar(msg: PivotGridMessages) {
    if (!this.showExportButton && !this.showExpandButtons) return nothing;
    return html`<div class="toolbar" part="toolbar">
      <slot name="toolbar"><span class="info"></span></slot>
      ${this.showExpandButtons
        ? html`<button class="btn" type="button" @click=${() => this.expandAll()}>${msg.expandAll}</button>
            <button class="btn" type="button" @click=${() => this.collapseAll()}>${msg.collapseAll}</button>`
        : nothing}
      ${this.showExportButton ? this._renderExport(msg) : nothing}
    </div>`;
  }

  private _renderExport(msg: PivotGridMessages) {
    const formats = this.exportFormats && this.exportFormats.length ? this.exportFormats : ['csv'];
    if (formats.length === 1) {
      const xlsx = formats[0] === 'xlsx';
      return html`<button class="btn export-btn" type="button" part="export-button" @click=${() => (xlsx ? this.exportToExcel() : this.exportToCsv())}>
        ${xlsx ? msg.exportXlsx : msg.export}
      </button>`;
    }
    return html`<span class="export-anchor">
      <button
        class="btn export-btn ${this._exportOpen ? 'active' : ''}"
        type="button"
        part="export-button"
        aria-haspopup="menu"
        aria-expanded=${this._exportOpen ? 'true' : 'false'}
        @click=${() => (this._exportOpen = !this._exportOpen)}
      >
        ${msg.exportMenu} <span aria-hidden="true">▾</span>
      </button>
      ${this._exportOpen
        ? html`<div class="export-menu" role="menu" part="export-menu">
            ${formats.indexOf('xlsx') >= 0 ? html`<button type="button" role="menuitem" @click=${() => this.exportToExcel()}>${msg.exportXlsx}</button>` : nothing}
            ${formats.indexOf('csv') >= 0 ? html`<button type="button" role="menuitem" @click=${() => this.exportToCsv()}>${msg.exportCsv}</button>` : nothing}
          </div>`
        : nothing}
    </span>`;
  }

  private _renderPopup(msg: PivotGridMessages) {
    const p = this._popup;
    if (!p) return nothing;
    const f = this._fields.find((x) => x.name === p.name)!;
    const needle = p.search.trim().toLowerCase();
    const visible = p.values.filter(
      (v) => !needle || fieldText(v, f, this.locale, msg.blank).toLowerCase().indexOf(needle) >= 0,
    );
    const allSelected = visible.length > 0 && visible.every((v) => p.selected.has(valueKey(v)));
    const someSelected = visible.some((v) => p.selected.has(valueKey(v)));
    const update = (mutate: (s: Set<string>) => void) => {
      const next = new Set(p.selected);
      mutate(next);
      this._popup = { ...p, selected: next };
    };

    return html`<div class="popup" role="dialog" aria-label=${msg.filter + ': ' + f.caption} style="top:${p.top}px;left:${p.left}px">
      <input
        class="input"
        type="search"
        placeholder=${msg.search}
        aria-label=${msg.search}
        .value=${p.search}
        @input=${(e: Event) => (this._popup = { ...p, search: (e.target as HTMLInputElement).value })}
      />
      <div class="value-list">
        <label class="all">
          <input
            type="checkbox"
            .checked=${allSelected}
            .indeterminate=${!allSelected && someSelected}
            @change=${(e: Event) => {
              const on = (e.target as HTMLInputElement).checked;
              update((s) => visible.forEach((v) => (on ? s.add(valueKey(v)) : s.delete(valueKey(v)))));
            }}
          />
          ${msg.selectAll}
        </label>
        ${visible.map((v) => {
          const k = valueKey(v);
          return html`<label>
            <input
              type="checkbox"
              .checked=${p.selected.has(k)}
              @change=${(e: Event) => {
                const on = (e.target as HTMLInputElement).checked;
                update((s) => (on ? s.add(k) : s.delete(k)));
              }}
            />
            ${fieldText(v, f, this.locale, msg.blank)}
          </label>`;
        })}
      </div>
      <div class="popup-actions">
        <button class="btn" type="button" @click=${() => (this._popup = null)}>${msg.cancel}</button>
        <button class="btn primary" type="button" @click=${this._applyFilter}>${msg.ok}</button>
      </div>
    </div>`;
  }

  private _renderTable(msg: PivotGridMessages) {
    const view = this._view!;
    const cube = this._cube!;
    if (!cube.recordCount) return html`<div class="no-data" part="no-data">${msg.noData}</div>`;
    const tabular = this.rowLayout === 'tabular';
    const H = view.rowHeaderColumns;
    const corner = tabular
      ? Array.from(
          { length: H },
          (_, i) => html`<th class="corner" rowspan=${view.headerRows.length} style=${this._stickyStyle(i, 1)}>
            ${cube.rowFields[i] ? cube.rowFields[i].caption : ''}
          </th>`,
        )
      : html`<th class="corner" rowspan=${view.headerRows.length}>${cube.rowFields.map((f) => f.caption).join(' / ')}</th>`;

    const stats: (ConditionalStats | null)[] = conditionalStats(cube, view);
    const hasCf = cube.dataFields.some((f) => !!f.conditionalFormat);
    return html`<table role="grid">
      <thead>
        ${view.headerRows.map(
          (cells, r) => html`<tr>
            ${r === 0 ? corner : nothing}
            ${cells.map(
              (c) => {
                const sortable = this.allowSorting && c.dataIndex !== undefined;
                return html`<th
                class="${c.type === 'data' ? 'data-caption' : c.type} ${sortable ? 'sortable' : ''} ${c.sortOrder ? 'sorted' : ''}"
                colspan=${c.colspan}
                rowspan=${c.rowspan}
                part="column-header"
                title=${sortable ? (c.sortOrder === 'desc' ? msg.sortDesc : c.sortOrder === 'asc' ? msg.sortAsc : msg.sortByColumn) : nothing}
                aria-sort=${c.sortOrder === 'desc' ? 'descending' : c.sortOrder === 'asc' ? 'ascending' : nothing}
                @click=${sortable ? (e: MouseEvent) => {
                  if ((e.composedPath()[0] as HTMLElement).closest?.('.toggle')) return;
                  this._onHeaderSort(c);
                } : nothing}
              >
                ${c.expandable
                  ? html`<button
                      class="toggle ${c.expanded ? 'expanded' : ''}"
                      type="button"
                      aria-expanded=${c.expanded ? 'true' : 'false'}
                      aria-label=${c.text}
                      @click=${() => this._toggleColumn(c)}
                    >
                      ▶
                    </button>`
                  : nothing}${c.text}${c.sortOrder ? html`<span class="sort-ind">${c.sortOrder === 'desc' ? '▼' : '▲'}</span>` : nothing}
              </th>`;
              },
            )}
          </tr>`,
        )}
      </thead>
      <tbody>
        ${view.rows.map((row) => {
          return html`<tr class="level-${row.level} ${row.expanded ? 'expanded' : ''} ${row.isGrandTotal ? 'grand' : ''} ${row.isTotal ? 'total-row' : ''}" part="row">
            ${tabular ? (row.headers || []).map((h) => this._renderRowHeaderCell(h)) : html`<th class="row-header" scope="row" style="padding-left:${10 + row.level * 18}px" title=${row.text} part="row-header">
              ${row.expandable
                ? html`<button
                    class="toggle ${row.expanded ? 'expanded' : ''}"
                    type="button"
                    aria-expanded=${row.expanded ? 'true' : 'false'}
                    aria-label=${row.text}
                    @click=${() => this._toggleRow(row)}
                  >
                    ▶
                  </button>`
                : row.isGrandTotal || !cube.rowFields.length
                ? nothing
                : html`<span class="toggle-spacer"></span>`}${row.text}
            </th>`}
            ${view.columns.map((col) => {
              const value = cube.getValue(row.pathKey, col.pathKey, col.dataIndex);
              const shown = displayValue(cube, row.pathKey, col.pathKey, col.dataIndex);
              const f = cube.dataFields[col.dataIndex];
              const cs = hasCf
                ? conditionalStyle(f, shown, stats[col.dataIndex], {
                    rowPath: row.path,
                    columnPath: col.path,
                    isTotal: row.isGrandTotal || row.isTotal || row.expanded || col.type !== 'value',
                    dataField: f.name,
                  })
                : null;
              return html`<td
                class=${col.type === 'value' ? '' : col.type}
                part="cell"
                style=${styleMap(cs || {})}
                @click=${(e: MouseEvent) => this._onCellClick(row, col, value, e)}
                @dblclick=${(e: MouseEvent) => this._onCellDblClick(row, col, value, e)}
              >
                ${this._formatCell(shown, col.dataIndex)}
              </td>`;
            })}
          </tr>`;
        })}
      </tbody>
    </table>`;
  }

  /** Coluna de cabeçalho fixa à esquerda no layout tabular. */
  private _stickyStyle(column: number, colspan: number): string {
    return `left:calc(var(--_row-header-w) * ${column});min-width:calc(var(--_row-header-w) * ${colspan});max-width:calc(var(--_row-header-w) * ${colspan})`;
  }

  private _renderRowHeaderCell(h: PivotRowHeaderCell) {
    return html`<th
      class="row-header tabular ${h.type} ${h.rowspan > 1 ? 'group' : ''}"
      scope="row"
      rowspan=${h.rowspan}
      colspan=${h.colspan}
      style=${this._stickyStyle(h.column, h.colspan)}
      title=${h.text}
      part="row-header"
    >
      ${h.expandable
        ? html`<button
            class="toggle ${h.expanded ? 'expanded' : ''}"
            type="button"
            aria-expanded=${h.expanded ? 'true' : 'false'}
            aria-label=${h.text}
            @click=${() => this._toggleRow(h)}
          >
            ▶
          </button>`
        : nothing}${h.text}
    </th>`;
  }

  protected render(): TemplateResult {
    const msg = this._msg;
    return html`<div class="pivot" part="pivot">
      ${this._renderToolbar(msg)} ${this._renderFieldPanel(msg)}
      <div class="scroller" part="scroller">${this._renderTable(msg)}</div>
      ${this._renderPopup(msg)}
      ${this._ghost
        ? html`<div class="ghost" aria-hidden="true" style="left:${this._ghost.x + 8}px;top:${this._ghost.y + 8}px">
            ${this._ghost.text}
          </div>`
        : nothing}
    </div>`;
  }
}

/** Registra o elemento (idempotente). */
export function definePivotGrid(tagName = 'bm-pivot-grid'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, class extends BmPivotGrid {});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bm-pivot-grid': BmPivotGrid;
  }
}

