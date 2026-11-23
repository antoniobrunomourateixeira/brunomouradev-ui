import { definePivotGrid } from './pivot-grid';

export type {
  PivotField,
  PivotArea,
  GroupInterval,
  FilterType,
  SummaryType,
  SortOrder,
  DataType,
  ValueFormat,
  SummaryDisplayMode,
  PivotConditionalFormat,
  PivotCellInfo,
  PivotTopN,
  PivotRowLayout,
} from './engine/types';
export { BmPivotGrid, definePivotGrid } from './pivot-grid';
export type { PivotCellEventDetail, FieldsChangedDetail } from './pivot-grid';
export { pivotMessagesEn, pivotMessagesPt } from './messages';
export type { PivotGridMessages } from './messages';
export { configure, getConfig, THEMES } from '@brunomouradev/data-grid/engine';
export type { BmConfig, ThemeName, Appearance, Density } from '@brunomouradev/data-grid/engine';
export { displayValue, formatDisplay, conditionalStats, conditionalStyle, pivotToXlsx } from './engine/display';
export { buildCube, buildView, resolveFields, drillDown, pivotToCsv } from './engine/index';

// Importar o pacote já registra <bm-pivot-grid>.
definePivotGrid();
