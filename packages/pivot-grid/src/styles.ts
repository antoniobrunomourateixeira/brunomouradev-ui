import { css, unsafeCSS } from 'lit';
import { themeCss } from '@brunomouradev/data-grid/engine';

export const pivotStyles = css`
  ${unsafeCSS(themeCss())}
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
  button,
  input,
  select {
    font: inherit;
    color: inherit;
  }

  .pivot {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--_bg);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    overflow: hidden;
  }

  /* ---------- toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--_border);
  }
  .toolbar .info {
    margin-right: auto;
    color: var(--_muted);
    font-size: 13px;
  }
  .btn {
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--_border);
    border-radius: calc(var(--_radius) - 2px);
    background: var(--_bg);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover {
    background: var(--_bg-hover);
  }
  .btn.primary {
    background: var(--_primary);
    border-color: var(--_primary);
    color: var(--_primary-text);
  }
  .btn:focus-visible,
  .icon-btn:focus-visible,
  .toggle:focus-visible,
  .input:focus {
    outline: 2px solid var(--_focus);
    outline-offset: 1px;
  }

  /* ---------- painel de campos */
  .field-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--_border);
    background: var(--_bg-alt);
  }
  .zone {
    min-height: 64px;
    padding: 6px;
    border: 1px dashed var(--_border);
    border-radius: calc(var(--_radius) - 2px);
    background: var(--_bg);
    transition: border-color 0.12s, background 0.12s;
  }
  .zone.drop-target {
    border-color: var(--_primary);
    background: var(--_bg-hover);
  }
  .zone-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--_muted);
    margin: 0 0 6px 2px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 28px;
    align-items: flex-start;
  }
  .empty-hint {
    font-size: 12px;
    color: var(--_muted);
    padding: 5px 2px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 28px;
    max-width: 100%;
    padding: 0 4px 0 8px;
    border: 1px solid var(--_border);
    border-radius: 999px;
    background: var(--_bg-header);
    font-size: 13px;
    user-select: none;
  }
  .chip[data-draggable='true'] {
    cursor: grab;
    touch-action: none;
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
  .chip.dragging {
    opacity: 0.4;
  }
  .chip.insert-before {
    box-shadow: -3px 0 0 var(--_primary);
  }
  .chip-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 2px;
  }
  .chip select {
    height: 22px;
    border: none;
    background: transparent;
    font-size: 12px;
    color: var(--_muted);
    cursor: pointer;
    padding: 0;
  }
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--_muted);
    cursor: pointer;
    font-size: 11px;
    padding: 0;
  }
  .icon-btn:hover {
    background: var(--_bg-hover);
    color: var(--_text);
  }
  .icon-btn.active {
    color: var(--_primary);
  }
  .icon-btn svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }

  /* ---------- tabela */
  .scroller {
    flex: 1 1 auto;
    overflow: auto;
  }
  table {
    border-collapse: separate;
    border-spacing: 0;
    min-width: 100%;
  }
  th,
  td {
    padding: var(--_cell-py) var(--_cell-px);
    white-space: nowrap;
    border-right: 1px solid var(--_border);
    border-bottom: 1px solid var(--_border);
  }
  thead {
    position: sticky;
    top: 0;
    z-index: 2;
  }
  thead th {
    background: var(--_bg-header);
    font-weight: var(--_header-weight);
    color: var(--_header-text);
    text-align: center;
  }
  thead th.total,
  thead th.grand {
    font-weight: 700;
  }
  thead th.sortable {
    cursor: pointer;
  }
  thead th.sortable:hover {
    background: var(--_bg-hover);
  }
  thead th.sorted {
    color: var(--_primary);
  }
  .sort-ind {
    margin-left: 4px;
    font-size: 10px;
  }
  thead th.data-caption {
    font-weight: 500;
    color: var(--_muted);
    font-size: 12px;
  }
  th.corner {
    position: sticky;
    left: 0;
    z-index: 3;
    text-align: left;
    vertical-align: bottom;
    color: var(--_muted);
    font-weight: 500;
    font-size: 12px;
  }
  tbody th.row-header {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--_bg);
    text-align: left;
    font-weight: normal;
    min-width: var(--_row-header-w, 220px);
    max-width: var(--_row-header-w, 220px);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tbody tr.level-0 th.row-header {
    font-weight: 600;
  }
  /* layout tabular */
  tbody th.row-header.tabular {
    font-weight: normal;
  }
  tbody th.row-header.tabular.group {
    vertical-align: top;
    font-weight: 600;
  }
  tbody tr.total-row td,
  tbody tr.total-row th.row-header {
    background: var(--_bg-alt);
    font-weight: 600;
  }
  td {
    text-align: right;
    font-variant-numeric: tabular-nums;
    min-width: 90px;
    cursor: default;
  }
  td.total,
  td.grand {
    font-weight: 600;
    background: var(--_bg-alt);
  }
  tbody tr.expanded td,
  tbody tr.expanded th.row-header {
    background: var(--_bg-alt);
  }
  tbody tr.grand td,
  tbody tr.grand th.row-header {
    background: var(--_bg-header);
    font-weight: 700;
  }
  tbody tr:hover td,
  tbody tr:hover th.row-header {
    background: var(--_bg-hover);
  }
  td:hover {
    outline: 1px solid var(--_primary);
    outline-offset: -1px;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-right: 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--_muted);
    cursor: pointer;
    padding: 0;
    font-size: 10px;
    vertical-align: middle;
    transition: transform 0.12s;
  }
  .toggle:hover {
    background: var(--_bg-hover);
    color: var(--_text);
  }
  .toggle.expanded {
    transform: rotate(90deg);
  }
  .toggle-spacer {
    display: inline-block;
    width: 22px;
  }
  .no-data {
    padding: 32px;
    text-align: center;
    color: var(--_muted);
  }

  /* ---------- popup de filtro */
  .popup {
    position: absolute;
    z-index: 10;
    width: 260px;
    max-width: calc(100% - 16px);
    padding: 8px;
    background: var(--_bg);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: var(--_shadow);
  }
  .input {
    width: 100%;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--_border);
    border-radius: calc(var(--_radius) - 2px);
    background: var(--_bg);
  }
  .value-list {
    max-height: 240px;
    overflow: auto;
    margin: 6px 0;
  }
  .value-list label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 4px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .value-list label:hover {
    background: var(--_bg-hover);
  }
  .value-list label.all {
    font-weight: 600;
    border-bottom: 1px solid var(--_border);
    border-radius: 0;
    margin-bottom: 2px;
  }
  input[type='checkbox'] {
    accent-color: var(--_primary);
    margin: 0;
  }
  .popup-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  /* ---------- exportar (menu) e mostrar como */
  .export-anchor {
    position: relative;
    display: inline-flex;
  }
  .export-btn.active {
    border-color: var(--_primary);
    color: var(--_primary);
  }
  .export-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 10;
    min-width: 180px;
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
  .chip select.display-mode {
    max-width: 130px;
  }
`;
