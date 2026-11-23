export interface TreeListMessages {
  noData: string;
  searchPlaceholder: string;
  filterPlaceholder: string;
  expandAll: string;
  collapseAll: string;
  expandRow: string;
  collapseRow: string;
  loading: string;
  clearFilters: string;
  exportMenu: string;
  exportXlsx: string;
  exportCsv: string;
  selectAll: string;
  selectRow: string;
  /** {0} = quantidade exibida, {1} = total */
  info: string;
  yes: string;
  no: string;
  all: string;
  sum: string;
  avg: string;
  min: string;
  max: string;
  count: string;
}

export const treeListMessagesEn: TreeListMessages = {
  noData: 'No data',
  searchPlaceholder: 'Search…',
  filterPlaceholder: 'Filter',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  expandRow: 'Expand',
  collapseRow: 'Collapse',
  loading: 'Loading…',
  clearFilters: 'Clear filters',
  exportMenu: 'Export',
  exportXlsx: 'Excel (.xlsx)',
  exportCsv: 'CSV (.csv)',
  selectAll: 'Select all',
  selectRow: 'Select row',
  info: '{0} of {1} items',
  yes: 'Yes',
  no: 'No',
  all: 'All',
  sum: 'Sum',
  avg: 'Avg',
  min: 'Min',
  max: 'Max',
  count: 'Count',
};

export const treeListMessagesPt: TreeListMessages = {
  noData: 'Sem dados',
  searchPlaceholder: 'Pesquisar…',
  filterPlaceholder: 'Filtrar',
  expandAll: 'Expandir tudo',
  collapseAll: 'Recolher tudo',
  expandRow: 'Expandir',
  collapseRow: 'Recolher',
  loading: 'Carregando…',
  clearFilters: 'Limpar filtros',
  exportMenu: 'Exportar',
  exportXlsx: 'Excel (.xlsx)',
  exportCsv: 'CSV (.csv)',
  selectAll: 'Selecionar todos',
  selectRow: 'Selecionar linha',
  info: '{0} de {1} itens',
  yes: 'Sim',
  no: 'Não',
  all: 'Todos',
  sum: 'Soma',
  avg: 'Média',
  min: 'Mín',
  max: 'Máx',
  count: 'Qtd',
};

export function defaultTreeListMessages(locale: string): TreeListMessages {
  return /^pt/i.test(locale) ? treeListMessagesPt : treeListMessagesEn;
}
