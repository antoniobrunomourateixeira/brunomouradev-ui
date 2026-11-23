import { themeCss } from './theme';

/**
 * CSS da tabela (DataGrid e TreeList) como texto, sem Lit: os componentes aplicam com unsafeCSS.
 * Inclui os temas (themeCss). Fica no motor para ser reaproveitado por outros componentes.
 */
export const GRID_CSS: string = `
  ${themeCss()}
  :host {
    display: block;
    box-sizing: border-box;
  }
  :host([hidden]) {
    display: none;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--_bg);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    overflow: hidden;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--_border);
  }
  .toolbar .spacer {
    flex: 1;
  }
  input,
  select,
  button {
    font: inherit;
    color: inherit;
  }
  .input {
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--_border);
    border-radius: calc(var(--_radius) - 2px);
    background: var(--_bg);
    min-width: 0;
  }
  .input:focus,
  .btn:focus-visible,
  th:focus-visible,
  input[type='checkbox']:focus-visible {
    outline: 2px solid var(--_focus);
    outline-offset: 1px;
  }
  .search {
    width: 240px;
    max-width: 100%;
  }
  .btn {
    height: 32px;
    min-width: 32px;
    padding: 0 10px;
    border: 1px solid var(--_border);
    border-radius: calc(var(--_radius) - 2px);
    background: var(--_bg);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) {
    background: var(--_bg-hover);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .btn[aria-current='page'] {
    background: var(--_primary);
    border-color: var(--_primary);
    color: var(--_primary-text);
  }

  /* Tabela */
  .scroller {
    flex: 1 1 auto;
    overflow: auto;
    position: relative;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
  }
  th,
  td {
    padding: var(--_cell-py) var(--_cell-px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    vertical-align: middle;
  }
  thead th {
    position: sticky;
    z-index: 2;
    background: var(--_bg-header);
    font-weight: var(--_header-weight);
    color: var(--_header-text);
    border-bottom: 1px solid var(--_border);
    user-select: none;
  }
  thead tr.headers th {
    top: 0;
  }
  thead tr.filters th {
    top: var(--_header-h, 37px);
    padding-top: 4px;
    padding-bottom: 4px;
    font-weight: normal;
  }
  thead tr.filters .input {
    width: 100%;
    height: 28px;
  }
  /* linha de filtro: campos sem borda, ocupando a célula */
  /* a célula do filtro é uma caixa de texto com o operador como "addon" à esquerda,
     para ficar claro que dá para clicar no operador e digitar no resto */
  .frow {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 28px;
    box-sizing: border-box;
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    background: var(--_bg);
    overflow: hidden;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  thead tr.filters th:hover .frow {
    border-color: var(--_muted);
  }
  .frow:focus-within,
  .frow.has-value {
    border-color: var(--_primary);
  }
  .frow:focus-within {
    box-shadow: 0 0 0 1px var(--_primary);
  }
  .frow.invalid,
  .frow.invalid:focus-within {
    border-color: #d1242f;
    box-shadow: none;
  }
  .frow-input {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 26px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    font-weight: normal;
    outline: none;
  }
  .frow-input::placeholder {
    color: var(--_muted);
    opacity: 0.7;
  }
  select.frow-input {
    cursor: pointer;
    height: 28px;
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    background-color: var(--_bg);
  }
  select.frow-input:focus {
    border-color: var(--_primary);
    box-shadow: 0 0 0 1px var(--_primary);
  }
  .frow-sep {
    color: var(--_muted);
  }
  .op-btn,
  .frow-clear {
    flex: none;
    min-width: 22px;
    height: 22px;
    padding: 0 3px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--_muted);
    cursor: pointer;
    font-size: 12px;
    line-height: 22px;
  }
  /* botão do operador: "addon" à esquerda da caixa, com setinha, para ficar claro que é clicável */
  .op-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    align-self: stretch;
    height: auto;
    min-width: 32px;
    padding: 0 5px;
    border: 0;
    border-right: 1px solid var(--_border);
    border-radius: 0;
    background: var(--_bg-header);
    color: var(--_text);
  }
  .op-btn .op-sym {
    display: inline-flex;
    align-items: center;
    font-weight: 600;
  }
  .op-btn .op-sym svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }
  .op-btn .op-caret {
    width: 7px;
    height: 5px;
    fill: var(--_muted);
  }
  .op-btn:hover,
  .op-btn.open {
    background: var(--_bg-hover);
    color: var(--_primary);
  }
  .op-btn:focus-visible {
    outline-offset: -2px;
  }
  .op-btn:hover .op-caret,
  .op-btn.open .op-caret {
    fill: var(--_primary);
  }
  .frow-clear:hover {
    background: var(--_bg-hover);
    color: var(--_primary);
  }
  .op-btn:focus-visible,
  .frow-clear:focus-visible {
    outline: 2px solid var(--_focus);
  }
  .op-menu {
    position: absolute;
    z-index: 15;
    width: 210px;
    padding: 4px;
    background: var(--_bg);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: var(--_shadow);
    font-weight: normal;
  }
  .op-menu [role='menuitemradio'] {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  .op-menu [role='menuitemradio']:hover,
  .op-menu [role='menuitemradio']:focus-visible {
    background: var(--_bg-hover);
    outline: none;
  }
  .op-menu [aria-checked='true'] {
    color: var(--_primary);
    font-weight: 600;
  }
  .op-sym {
    display: inline-flex;
    justify-content: center;
    width: 20px;
    color: var(--_muted);
  }
  .op-sym svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }
  /* barra de filtros ativos */
  .filter-panel {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 8px;
    border-top: 1px solid var(--_border);
    background: var(--_bg-alt);
    font-size: 13px;
  }
  .fp-title {
    color: var(--_muted);
  }
  .fp-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 320px;
    padding: 2px 2px 2px 10px;
    border: 1px solid var(--_border);
    border-radius: 999px;
    background: var(--_bg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fp-chip button {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--_muted);
    cursor: pointer;
  }
  .fp-chip button:hover {
    background: var(--_bg-hover);
    color: var(--_text);
  }
  .fp-clear {
    margin-left: auto;
    padding: 2px 6px;
    border: 0;
    background: transparent;
    color: var(--_primary);
    cursor: pointer;
    text-decoration: underline;
  }
  th.sortable {
    cursor: pointer;
  }
  th.sortable:hover {
    color: var(--_primary);
  }
  .th-content {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
  }
  .th-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sort-icon {
    font-size: 10px;
    color: var(--_primary);
    flex: none;
  }
  .sort-index {
    font-size: 10px;
    color: var(--_muted);
  }

  tbody td {
    border-bottom: 1px solid var(--_border);
  }
  :host(:not([show-row-lines])) tbody td {
    border-bottom-color: transparent;
  }
  :host([show-column-lines]) th:not(:last-child),
  :host([show-column-lines]) td:not(:last-child) {
    border-right: 1px solid var(--_border);
  }
  /* Bootstrap: linha mais grossa embaixo do cabeçalho, como no .table */
  :host([data-bm-theme='bootstrap4']) thead tr.headers th {
    border-bottom-width: 2px;
  }
  /* column-auto-width: colunas do tamanho do conteúdo, sem "…" */
  :host([column-auto-width]) th,
  :host([column-auto-width]) td {
    text-overflow: clip;
  }
  :host([column-auto-width]) .th-content {
    max-width: none;
  }
  :host([column-auto-width]) .th-text {
    overflow: visible;
    flex: none;
  }
  :host([row-alternation-enabled]) tbody tr.data.alt td {
    background: var(--_bg-alt);
  }
  :host(:not([hover-state-disabled])) tbody tr.data:hover td {
    background: var(--_bg-hover);
  }
  tbody tr.selected td,
  :host([row-alternation-enabled]) tbody tr.selected.alt td {
    background: var(--_bg-selected);
  }
  tbody tr.data {
    cursor: default;
  }
  :host([selection-mode='single']) tbody tr.data,
  :host([selection-mode='multiple']) tbody tr.data {
    cursor: pointer;
  }
  .align-right {
    text-align: right;
  }
  .align-center {
    text-align: center;
  }
  .align-right .th-content {
    flex-direction: row-reverse;
  }
  th.select-col,
  td.select-col {
    width: 40px;
    text-align: center;
    padding-left: 0;
    padding-right: 0;
  }
  input[type='checkbox'] {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--_primary);
    cursor: pointer;
    vertical-align: middle;
  }
  .no-data td {
    text-align: center;
    color: var(--_muted);
    padding: 32px 12px;
    border-bottom: none;
  }

  tfoot td {
    position: sticky;
    bottom: 0;
    z-index: 1;
    background: var(--_bg-header);
    border-top: 1px solid var(--_border);
    font-weight: 600;
  }
  tfoot td {
    vertical-align: top;
  }
  /* cada total numa linha, sem quebrar; se não couber, corta com "…" (o texto completo fica no title) */
  .summary-item {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Pager */
  .pager {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 8px;
    border-top: 1px solid var(--_border);
    color: var(--_muted);
  }
  .pager label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .pager .input {
    height: 30px;
    padding: 0 6px;
  }
  .pages {
    display: inline-flex;
    gap: 4px;
    margin-left: auto;
  }
  .pages .btn {
    height: 30px;
    min-width: 30px;
    padding: 0 6px;
    color: var(--_text);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .search {
      width: 100%;
    }
    .pages {
      margin-left: 0;
    }
  }

  /* ---------- seletor de colunas e arrastar */
  .grid {
    position: relative;
  }
  .chooser-anchor {
    position: relative;
    display: inline-flex;
  }
  .chooser-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .chooser-btn svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
    opacity: 0.7;
  }
  .chooser-btn.active {
    border-color: var(--_primary);
    color: var(--_primary);
  }
  .chooser {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 10;
    width: 240px;
    padding: 6px;
    background: var(--_bg);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: var(--_shadow);
    font-weight: normal;
  }
  .chooser-list {
    list-style: none;
    margin: 0;
    padding: 0 0 2px;
    max-height: 320px;
    overflow: auto;
  }
  .chooser-list li {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    border-radius: 4px;
    user-select: none;
  }
  .chooser-list li:hover {
    background: var(--_bg-hover);
  }
  .chooser-list li[data-draggable='true'] {
    cursor: grab;
    touch-action: none;
  }
  .chooser-list li.drop-before {
    box-shadow: inset 0 3px 0 var(--_primary);
  }
  .chooser-list.drop-end li:last-child {
    box-shadow: inset 0 -3px 0 var(--_primary);
  }
  .chooser-list li.dragging,
  thead th.dragging {
    opacity: 0.4;
  }
  .chooser-list label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    padding: 4px 0;
    cursor: pointer;
  }
  .chooser-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .handle {
    width: 14px;
    color: var(--_muted);
    font-size: 12px;
    text-align: center;
  }
  .chooser-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 6px;
    border-top: 1px solid var(--_border);
  }
  thead th[data-draggable='true'] {
    touch-action: none;
  }
  thead th.drop-before {
    box-shadow: inset 3px 0 0 var(--_primary);
  }
  thead th.drop-after {
    box-shadow: inset -3px 0 0 var(--_primary);
  }
  .ghost {
    position: fixed;
    z-index: 20;
    pointer-events: none;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--_primary);
    color: var(--_primary-text);
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    white-space: nowrap;
  }

  /* ---------- agrupamento */
  .group-panel {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 44px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--_border);
    background: var(--_bg-alt);
  }
  .group-panel.drop-target {
    background: var(--_bg-hover);
    box-shadow: inset 0 0 0 2px var(--_primary);
  }
  .group-panel .spacer {
    flex: 1;
  }
  .group-hint {
    color: var(--_muted);
    font-size: 13px;
  }
  .group-sep {
    color: var(--_muted);
  }
  .group-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 4px 0 10px;
    border: 1px solid var(--_border);
    border-radius: 999px;
    background: var(--_bg);
    cursor: grab;
    user-select: none;
    touch-action: none;
    font-size: 13px;
  }
  .group-chip:hover {
    border-color: var(--_primary);
  }
  .group-chip:focus-visible {
    outline: 2px solid var(--_focus);
    outline-offset: 1px;
  }
  .group-chip.drop-before {
    box-shadow: -5px 0 0 -2px var(--_primary);
  }
  .group-panel.drop-end .group-chip:last-of-type {
    box-shadow: 5px 0 0 -2px var(--_primary);
  }
  .group-chip.dragging {
    opacity: 0.4;
  }
  .chip-remove {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--_muted);
    cursor: pointer;
    line-height: 1;
  }
  .chip-remove:hover {
    background: var(--_bg-hover);
    color: var(--_text);
  }
  .btn-sm {
    height: 28px;
    font-size: 12px;
  }
  tbody tr.group-row td {
    background: var(--_bg-header);
    cursor: pointer;
  }
  tbody tr.group-row td.group-indent {
    background: var(--_bg);
  }
  td.group-indent,
  th.group-indent {
    padding: 0;
  }
  tbody td.group-indent {
    border-bottom-color: transparent;
  }
  .group-toggle {
    width: 20px;
    height: 20px;
    margin: 0 4px 0 -6px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    vertical-align: middle;
  }
  .group-toggle:focus-visible {
    outline: 2px solid var(--_focus);
    border-radius: 4px;
  }
  .chevron {
    display: inline-block;
    transition: transform 0.12s;
    color: var(--_muted);
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .group-meta {
    margin-left: 6px;
    color: var(--_muted);
  }
  .group-row .summary-item {
    font-weight: 600;
  }

  /* ---------- filtro do cabeçalho */
  .hf-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 20px;
    height: 20px;
    margin-left: 2px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--_muted);
    cursor: pointer;
    opacity: 0.55;
  }
  th:hover .hf-btn,
  .hf-btn:focus-visible,
  .hf-btn.open,
  .hf-btn.active {
    opacity: 1;
  }
  .hf-btn:hover,
  .hf-btn.open {
    background: var(--_bg-hover);
  }
  .hf-btn.active {
    color: var(--_primary);
  }
  .hf-btn:focus-visible {
    outline: 2px solid var(--_focus);
  }
  .hf-btn svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
  }
  .hf-btn.active svg {
    fill: currentColor;
  }
  .align-right .hf-btn {
    margin-left: 0;
    margin-right: 2px;
  }
  .hf-popup {
    position: absolute;
    z-index: 15;
    width: 260px;
    max-width: calc(100% - 8px);
    padding: 8px;
    background: var(--_bg);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: var(--_shadow);
    font-weight: normal;
  }
  .hf-search {
    width: 100%;
    margin-bottom: 6px;
  }
  .hf-all,
  .hf-list label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
  }
  .hf-all {
    border-bottom: 1px solid var(--_border);
    border-radius: 0;
    font-weight: 600;
  }
  .hf-list {
    list-style: none;
    margin: 0;
    padding: 2px 0;
    max-height: 260px;
    overflow: auto;
  }
  .hf-list label:hover,
  .hf-all:hover {
    background: var(--_bg-hover);
  }
  .hf-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hf-text.blank {
    color: var(--_muted);
    font-style: italic;
  }
  .hf-count {
    color: var(--_muted);
    font-size: 12px;
  }
  .hf-empty {
    padding: 16px 6px;
    color: var(--_muted);
    text-align: center;
  }
  .hf-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--_border);
  }
  .export-anchor {
    position: relative;
    display: inline-flex;
  }
  .export-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .export-btn svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
    opacity: 0.7;
  }
  .export-btn.active {
    border-color: var(--_primary);
    color: var(--_primary);
  }
  .caret {
    font-size: 10px;
    opacity: 0.7;
  }
  .export-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 10;
    min-width: 200px;
    padding: 4px;
    background: var(--_bg);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: var(--_shadow);
  }
  .export-menu [role='menuitem'] {
    display: block;
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }
  .export-menu [role='menuitem']:hover,
  .export-menu [role='menuitem']:focus-visible {
    background: var(--_bg-hover);
    outline: none;
  }
  tr.v-spacer td {
    padding: 0;
    border: 0;
  }
  :host([virtual-scrolling]) .scroller {
    overflow-anchor: none;
  }
  /* ---------- rowClass / rowStyle: a cor da linha aparece (seleção e mouse por cima continuam vencendo) */
  :host([row-alternation-enabled]) tbody tr.data.alt.bm-custom {
    background-color: var(--_bg-alt);
  }
  tbody tr.data.bm-custom:not(.selected):not(:hover) td,
  :host([row-alternation-enabled]) tbody tr.data.alt.bm-custom:not(.selected):not(:hover) td,
  :host([hover-state-disabled]) tbody tr.data.bm-custom:not(.selected) td,
  :host([hover-state-disabled][row-alternation-enabled]) tbody tr.data.alt.bm-custom:not(.selected) td {
    background-color: transparent;
  }
  /* ---------- redimensionar e colunas fixas */
  thead tr.headers th {
    position: sticky;
  }
  .resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 7px;
    cursor: col-resize;
    touch-action: none;
    z-index: 1;
  }
  .resize-handle::after {
    content: '';
    position: absolute;
    top: 25%;
    bottom: 25%;
    right: 2px;
    width: 2px;
    border-radius: 1px;
    background: transparent;
  }
  th:hover .resize-handle::after {
    background: var(--_border);
  }
  .resize-handle:hover::after,
  .resize-handle.active::after {
    top: 0;
    bottom: 0;
    background: var(--_primary);
  }
  tbody tr.data {
    --_fxt: transparent;
  }
  :host([row-alternation-enabled]) tbody tr.data.alt {
    --_fxt: var(--_bg-alt);
  }
  :host(:not([hover-state-disabled])) tbody tr.data:hover {
    --_fxt: var(--_bg-hover);
  }
  tbody tr.data.selected {
    --_fxt: var(--_bg-selected);
  }
  tbody tr.data.bm-custom:not(.selected):not(:hover) {
    --_fxt: transparent;
  }
  tbody tr.data.bm-custom {
    background-color: var(--bm-row-bg, transparent);
  }
  :host([row-alternation-enabled]) tbody tr.data.alt.bm-custom {
    background-color: var(--bm-row-bg, var(--_bg-alt));
  }
  .group-sticky {
    position: sticky;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
  }
  /* overflow: hidden faria da célula o contêiner do sticky (o título do grupo sumiria ao rolar
     para o lado); clip corta igual sem isso. Navegadores antigos ficam com o hidden. */
  tbody tr.group-row td.group-cell {
    overflow: clip;
  }
  /* título do grupo: célula presa à esquerda; o texto pode passar por cima das células
     vizinhas (com fundo próprio), para continuar legível ao rolar para o lado */
  tbody tr.group-row td.group-title {
    position: sticky;
    z-index: 1;
    overflow: visible;
  }
  tbody tr.group-row td.group-title .group-sticky {
    position: relative;
    max-width: none;
    padding-right: 12px;
    background: var(--_bg-header);
    white-space: nowrap;
  }
  .chooser-list .pin {
    flex: none;
    width: 24px;
    height: 24px;
    padding: 4px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--_muted);
    cursor: pointer;
    opacity: 0.35;
  }
  .chooser-list li:hover .pin,
  .chooser-list .pin:focus-visible,
  .chooser-list .pin.on {
    opacity: 1;
  }
  .chooser-list .pin.on {
    color: var(--_primary);
  }
  .chooser-list .pin svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
  .btn-primary {
    background: var(--_primary);
    border-color: var(--_primary);
    color: var(--_primary-text);
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--_primary);
    filter: brightness(1.08);
  }

  /* ---------- foco do teclado e aviso de cópia */
  tbody td[data-ci]:focus {
    outline: none;
  }
  tbody td[data-ci]:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: -2px;
  }
  .toast {
    position: absolute;
    left: 50%;
    bottom: 56px;
    transform: translateX(-50%);
    z-index: 20;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--_text);
    color: var(--_bg);
    font-size: 13px;
    box-shadow: var(--_shadow);
    pointer-events: none;
  }

  /* ---------- carregando */
  .loading-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 12;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    background: var(--_bg);
    box-shadow: var(--_shadow);
    color: var(--_text);
  }
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--_border);
    border-top-color: var(--_primary);
    border-radius: 50%;
    animation: bm-spin 0.7s linear infinite;
  }
  @keyframes bm-spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* regras separadas: um navegador sem :has() descartaria a regra inteira */
  :host([loading]) tbody {
    opacity: 0.55;
  }
  .grid:has(.loading-overlay) tbody {
    opacity: 0.55;
  }
`;
