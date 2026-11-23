export interface PivotGridMessages {
  total: string;
  grandTotal: string;
  blank: string;
  noData: string;
  filterArea: string;
  columnArea: string;
  rowArea: string;
  dataArea: string;
  availableFields: string;
  dropHere: string;
  selectAll: string;
  search: string;
  ok: string;
  cancel: string;
  expandAll: string;
  collapseAll: string;
  export: string;
  exportMenu: string;
  exportXlsx: string;
  exportCsv: string;
  showValuesAs: string;
  displayModes: Record<string, string>;
  sortAsc: string;
  sortDesc: string;
  sortByColumn: string;
  filter: string;
  sum: string;
  avg: string;
  min: string;
  max: string;
  count: string;
}

export const pivotMessagesEn: PivotGridMessages = {
  total: 'Total',
  grandTotal: 'Grand Total',
  blank: '(Blank)',
  noData: 'No data',
  filterArea: 'Filters',
  columnArea: 'Columns',
  rowArea: 'Rows',
  dataArea: 'Values',
  availableFields: 'Available fields',
  dropHere: 'Drop fields here',
  selectAll: '(Select all)',
  search: 'Search…',
  ok: 'OK',
  cancel: 'Cancel',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  export: 'Export CSV',
  exportMenu: 'Export',
  exportXlsx: 'Excel (.xlsx)',
  exportCsv: 'CSV (.csv)',
  showValuesAs: 'Show values as',
  displayModes: {
    absolute: 'Value',
    percentOfGrandTotal: '% of grand total',
    percentOfRowTotal: '% of row total',
    percentOfColumnTotal: '% of column total',
    percentOfParentRow: '% of parent row',
    percentOfParentColumn: '% of parent column',
    differenceFromPrevious: 'Difference from previous',
    percentDifferenceFromPrevious: '% difference from previous',
    runningTotal: 'Running total',
  },
  sortAsc: 'Sorted ascending — click to sort descending',
  sortDesc: 'Sorted descending — click to sort ascending',
  sortByColumn: 'Click to sort rows by this column',
  filter: 'Filter',
  sum: 'Sum',
  avg: 'Average',
  min: 'Min',
  max: 'Max',
  count: 'Count',
};

export const pivotMessagesPt: PivotGridMessages = {
  total: 'Total',
  grandTotal: 'Total Geral',
  blank: '(Vazio)',
  noData: 'Sem dados',
  filterArea: 'Filtros',
  columnArea: 'Colunas',
  rowArea: 'Linhas',
  dataArea: 'Valores',
  availableFields: 'Campos disponíveis',
  dropHere: 'Arraste campos aqui',
  selectAll: '(Selecionar todos)',
  search: 'Pesquisar…',
  ok: 'OK',
  cancel: 'Cancelar',
  expandAll: 'Expandir tudo',
  collapseAll: 'Recolher tudo',
  export: 'Exportar CSV',
  exportMenu: 'Exportar',
  exportXlsx: 'Excel (.xlsx)',
  exportCsv: 'CSV (.csv)',
  showValuesAs: 'Mostrar valores como',
  displayModes: {
    absolute: 'Valor',
    percentOfGrandTotal: '% do total geral',
    percentOfRowTotal: '% do total da linha',
    percentOfColumnTotal: '% do total da coluna',
    percentOfParentRow: '% do grupo (linha)',
    percentOfParentColumn: '% do grupo (coluna)',
    differenceFromPrevious: 'Diferença do anterior',
    percentDifferenceFromPrevious: '% de diferença do anterior',
    runningTotal: 'Total acumulado',
  },
  sortAsc: 'Ordem crescente — clique para decrescente',
  sortDesc: 'Ordem decrescente — clique para crescente',
  sortByColumn: 'Clique para ordenar as linhas por esta coluna',
  filter: 'Filtrar',
  sum: 'Soma',
  avg: 'Média',
  min: 'Mínimo',
  max: 'Máximo',
  count: 'Contagem',
};

export function defaultPivotMessages(locale: string): PivotGridMessages {
  return /^pt/i.test(locale) ? pivotMessagesPt : pivotMessagesEn;
}
