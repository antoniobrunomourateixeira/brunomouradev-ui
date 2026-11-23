import { defineDataGrid } from './data-grid';

export * from './engine/types';
export { BmDataGrid, defineDataGrid, DATA_GRID_OPTION_KEYS } from './data-grid';
export type { DataGridOptions, RowEventDetail, SelectionChangedDetail, ContentReadyDetail, StateChangedDetail, ColumnLayoutChangedDetail, GroupingChangedDetail, RowStyle, GridState, StateStoringOptions, RemoteLoadOptions, RemoteLoadResult, ExportFormat, ExportingDetail, ExportOptions } from './data-grid';
export { messagesEn, messagesPt } from './messages';
export type { DataGridMessages } from './messages';
export { configure, getConfig, THEMES, themePalette } from './engine/theme';
export type { BmConfig, ThemeName, Appearance, Density } from './engine/theme';

// Importar o pacote já registra <bm-data-grid>.
defineDataGrid();
