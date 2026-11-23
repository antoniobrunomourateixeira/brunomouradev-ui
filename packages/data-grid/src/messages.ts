export interface DataGridMessages {
  noData: string;
  searchPlaceholder: string;
  filterPlaceholder: string;
  /** {0} = página, {1} = total de páginas, {2} = total de itens */
  pageInfo: string;
  pageSize: string;
  all: string;
  firstPage: string;
  prevPage: string;
  nextPage: string;
  lastPage: string;
  /** Botão de exportar com um só formato (CSV). */
  export: string;
  /** Botão de exportar com menu. */
  exportMenu: string;
  exportXlsxOnly: string;
  exportXlsx: string;
  exportCsv: string;
  /** {0} = quantidade selecionada */
  exportSelected: string;
  clearFilters: string;
  columnChooser: string;
  resetColumns: string;
  dragToReorder: string;
  fixColumn: string;
  unfixColumn: string;
  resizeColumn: string;
  /** Texto do painel de agrupamento vazio. */
  groupPanelHint: string;
  ungroup: string;
  expandAll: string;
  collapseAll: string;
  expandGroup: string;
  collapseGroup: string;
  /** {0} = quantidade de linhas do grupo */
  groupItems: string;
  groupItem: string;
  groupContinued: string;
  groupEmpty: string;
  selectGroup: string;
  headerFilter: string;
  ok: string;
  cancel: string;
  noValues: string;
  loading: string;
  loadError: string;
  /** Rolagem virtual: {0} = total de itens */
  virtualInfo: string;
  selectAll: string;
  selectRow: string;
  /** {0} = quantidade */
  copiedRows: string;
  copiedCell: string;
  /** Nome de cada operador do filtro (menu e barra de filtros). */
  filterOps: Record<string, string>;
  filterOperation: string;
  filterFrom: string;
  filterTo: string;
  datePlaceholder: string;
  filterPanelTitle: string;
  clearAll: string;
  searchChip: string;
  /** {0} = quantidade de valores */
  valuesCount: string;
  yes: string;
  no: string;
  sum: string;
  avg: string;
  min: string;
  max: string;
  count: string;
}

export const messagesEn: DataGridMessages = {
  noData: 'No data',
  searchPlaceholder: 'Search…',
  filterPlaceholder: 'Filter',
  pageInfo: 'Page {0} of {1} ({2} items)',
  pageSize: 'Rows per page',
  all: 'All',
  firstPage: 'First page',
  prevPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  export: 'Export CSV',
  exportMenu: 'Export',
  exportXlsxOnly: 'Export Excel',
  exportXlsx: 'Excel (.xlsx)',
  exportCsv: 'CSV (.csv)',
  exportSelected: 'Excel, selected rows only ({0})',
  clearFilters: 'Clear filters',
  columnChooser: 'Columns',
  resetColumns: 'Reset to default',
  dragToReorder: 'Drag to reorder',
  fixColumn: 'Pin to the left',
  unfixColumn: 'Unpin column',
  resizeColumn: 'Drag to resize, double-click to fit',
  groupPanelHint: 'Drag a column header here to group by that column',
  ungroup: 'Ungroup',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  expandGroup: 'Expand group',
  collapseGroup: 'Collapse group',
  groupItems: '{0} items',
  groupItem: '1 item',
  groupContinued: 'continued',
  groupEmpty: '(blank)',
  selectGroup: 'Select group',
  headerFilter: 'Filter values',
  ok: 'OK',
  cancel: 'Cancel',
  noValues: 'No values',
  loading: 'Loading…',
  loadError: 'Could not load the data.',
  virtualInfo: '{0} items',
  selectAll: 'Select all',
  selectRow: 'Select row',
  copiedRows: '{0} row(s) copied',
  copiedCell: 'Cell copied',
  filterOps: {
    contains: 'Contains',
    notcontains: 'Does not contain',
    startswith: 'Starts with',
    endswith: 'Ends with',
    '=': 'Equals',
    '<>': 'Does not equal',
    '<': 'Less than',
    '>': 'Greater than',
    '<=': 'Less than or equal to',
    '>=': 'Greater than or equal to',
    between: 'Between',
  },
  filterOperation: 'Filter operation',
  filterFrom: 'from',
  filterTo: 'to',
  datePlaceholder: 'mm/dd/yyyy, mm/yyyy, yyyy',
  filterPanelTitle: 'Filters',
  clearAll: 'Clear all',
  searchChip: 'Search',
  valuesCount: '{0} values',
  yes: 'Yes',
  no: 'No',
  sum: 'Sum',
  avg: 'Avg',
  min: 'Min',
  max: 'Max',
  count: 'Count',
};

export const messagesPt: DataGridMessages = {
  noData: 'Sem dados',
  searchPlaceholder: 'Pesquisar…',
  filterPlaceholder: 'Filtrar',
  pageInfo: 'Página {0} de {1} ({2} itens)',
  pageSize: 'Itens por página',
  all: 'Todos',
  firstPage: 'Primeira página',
  prevPage: 'Página anterior',
  nextPage: 'Próxima página',
  lastPage: 'Última página',
  export: 'Exportar CSV',
  exportMenu: 'Exportar',
  exportXlsxOnly: 'Exportar Excel',
  exportXlsx: 'Excel (.xlsx)',
  exportCsv: 'CSV (.csv)',
  exportSelected: 'Excel, só as selecionadas ({0})',
  clearFilters: 'Limpar filtros',
  columnChooser: 'Colunas',
  resetColumns: 'Restaurar padrão',
  dragToReorder: 'Arraste para reordenar',
  fixColumn: 'Fixar à esquerda',
  unfixColumn: 'Soltar coluna',
  resizeColumn: 'Arraste para mudar a largura; duplo clique ajusta ao conteúdo',
  groupPanelHint: 'Arraste o cabeçalho de uma coluna para cá para agrupar',
  ungroup: 'Desagrupar',
  expandAll: 'Expandir tudo',
  collapseAll: 'Recolher tudo',
  expandGroup: 'Expandir grupo',
  collapseGroup: 'Recolher grupo',
  groupItems: '{0} itens',
  groupItem: '1 item',
  groupContinued: 'continuação',
  groupEmpty: '(vazio)',
  selectGroup: 'Selecionar grupo',
  headerFilter: 'Filtrar valores',
  ok: 'OK',
  cancel: 'Cancelar',
  noValues: 'Nenhum valor',
  loading: 'Carregando…',
  loadError: 'Não foi possível carregar os dados.',
  virtualInfo: '{0} itens',
  selectAll: 'Selecionar todos',
  selectRow: 'Selecionar linha',
  copiedRows: '{0} linha(s) copiada(s)',
  copiedCell: 'Célula copiada',
  filterOps: {
    contains: 'Contém',
    notcontains: 'Não contém',
    startswith: 'Começa com',
    endswith: 'Termina com',
    '=': 'Igual a',
    '<>': 'Diferente de',
    '<': 'Menor que',
    '>': 'Maior que',
    '<=': 'Menor ou igual a',
    '>=': 'Maior ou igual a',
    between: 'Entre',
  },
  filterOperation: 'Operação do filtro',
  filterFrom: 'de',
  filterTo: 'até',
  datePlaceholder: 'dd/mm/aaaa, mm/aaaa, aaaa',
  filterPanelTitle: 'Filtros',
  clearAll: 'Limpar tudo',
  searchChip: 'Busca',
  valuesCount: '{0} valores',
  yes: 'Sim',
  no: 'Não',
  sum: 'Soma',
  avg: 'Média',
  min: 'Mín',
  max: 'Máx',
  count: 'Qtd',
};

export function defaultMessages(locale: string): DataGridMessages {
  return /^pt/i.test(locale) ? messagesPt : messagesEn;
}
