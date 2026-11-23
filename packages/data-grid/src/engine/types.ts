/**
 * Tipos públicos do DataGrid. Arquivo sem dependências (nem Lit, nem DOM),
 * para poder ser usado em qualquer projeto — inclusive TypeScript antigo (Angular 11).
 */

export type DataType = 'string' | 'number' | 'date' | 'boolean';
export type SortOrder = 'asc' | 'desc';
export type Alignment = 'left' | 'center' | 'right';
export type SelectionMode = 'none' | 'single' | 'multiple';
export type SummaryType = 'sum' | 'avg' | 'min' | 'max' | 'count';

export type FilterOperation =
  | 'contains'
  | 'notcontains'
  | 'startswith'
  | 'endswith'
  | '='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>='
  /** Entre dois valores (inclusive). value = [de, até]; um dos lados pode ser null. */
  | 'between'
  /** Fora do intervalo [de, até]. */
  | 'notbetween';

/** Formatação: opções do Intl ou uma função própria. */
/**
 * Atalhos de formato:
 * - `'currency'`: moeda (BRL no pt-BR, USD no en-US ou a de `configure({ currency })`);
 * - `'number'`: número com separador de milhar; `'integer'`: inteiro sem separador (IDs, dias);
 * - `'percent'`: valor que já está em porcentagem (12.5 → "12,5%");
 * - `'date'`, `'datetime'`, `'time'`.
 * Todos definem o `dataType` da coluna; os numéricos alinham à direita.
 */
export type FormatShortcut = 'currency' | 'number' | 'integer' | 'percent' | 'date' | 'datetime' | 'time';

export type ValueFormat =
  | FormatShortcut
  | Intl.NumberFormatOptions
  | Intl.DateTimeFormatOptions
  | ((value: any, row: any) => string);

export interface ColumnDef<T = any> {
  /** Campo do objeto de dados. Aceita caminho aninhado: "cliente.nome". */
  dataField: string;
  /** Título do cabeçalho. Padrão: dataField formatado. */
  caption?: string;
  /** Tipo do dado. Padrão: inferido a partir das primeiras linhas. */
  dataType?: DataType;
  width?: number | string;
  minWidth?: number;
  alignment?: Alignment;
  visible?: boolean;
  /** Posição inicial entre as colunas. Padrão: a ordem do array. */
  visibleIndex?: number;
  /** false impede esconder a coluna pelo seletor de colunas. */
  allowHiding?: boolean;
  /** false impede arrastar esta coluna para outra posição. */
  allowReordering?: boolean;
  /** Coluna fixa à esquerda: continua visível ao rolar a tabela para o lado. */
  fixed?: boolean;
  /** false impede redimensionar esta coluna. */
  allowResizing?: boolean;
  /** false tira a coluna do seletor de colunas (continua visível ou escondida como estiver). */
  showInColumnChooser?: boolean;
  /** Agrupamento inicial: 0 = primeiro nível, 1 = segundo... A direção vem de `sortOrder`. */
  groupIndex?: number;
  /** false impede agrupar por esta coluna. */
  allowGrouping?: boolean;
  /** false tira o filtro do cabeçalho (lista de valores) desta coluna. */
  allowHeaderFiltering?: boolean;
  /** Filtro inicial do cabeçalho: valores marcados (ou desmarcados, com `filterType: 'exclude'`). */
  filterValues?: any[];
  /** "include": mostra só `filterValues`. "exclude": esconde `filterValues`. Padrão: "include". */
  filterType?: 'include' | 'exclude';
  allowSorting?: boolean;
  allowFiltering?: boolean;
  allowSearch?: boolean;
  /** Ordenação inicial. */
  sortOrder?: SortOrder;
  /** Prioridade da ordenação inicial quando houver várias colunas. */
  sortIndex?: number;
  /** Filtro inicial (como no filter row). */
  filterValue?: any;
  /** Operação usada pelo filter row. Padrão: "contains" para texto e "=" para os outros tipos. */
  selectedFilterOperation?: FilterOperation;
  format?: ValueFormat;
  /** Valor calculado (coluna virtual). */
  calculateCellValue?: (row: T) => any;
  /**
   * Renderização customizada da célula. Pode retornar texto, um HTMLElement
   * ou um TemplateResult do Lit.
   */
  cellRender?: (value: any, row: T) => unknown;
  /**
   * Nome de um template de célula do framework (ex.: `<ng-template bmCellTemplate="acoes">` no Angular).
   * A célula vira um slot e o conteúdo é desenhado fora do Shadow DOM, pelo `cellTemplateRenderer`
   * da grid. Assim o CSS da página (Bootstrap etc.) e os componentes do framework funcionam.
   */
  cellTemplate?: string;
  /**
   * Classe CSS das células desta coluna. Pode ser uma função, para mudar conforme o valor:
   * `(valor, linha) => valor < 0 ? 'negativo' : ''`. O nome também vira um "part":
   * `bm-data-grid::part(negativo) { color: red; }`.
   */
  cssClass?: string | ((value: any, row: T) => string | null | undefined | false);
}

/** O que a grid passa para `cellTemplateRenderer` ao desenhar uma célula com `cellTemplate`. */
export interface CellTemplateContext<T = any> {
  /** Nome do template (o `cellTemplate` da coluna). */
  name: string;
  /** Elemento (fora do Shadow DOM) onde o conteúdo deve ser colocado. */
  element: HTMLElement;
  value: any;
  row: T;
  column: ColumnDef<T>;
}

/**
 * Desenha o template dentro de `ctx.element`. Pode devolver uma função de limpeza,
 * chamada quando a célula sai da tela (paginação, rolagem virtual, filtro) ou os dados mudam.
 */
export type CellTemplateRenderer<T = any> = (ctx: CellTemplateContext<T>) => void | (() => void);

/** Ordem e visibilidade de uma coluna, para salvar e restaurar o layout. */
export interface ColumnLayoutItem {
  dataField: string;
  visible: boolean;
  /** Largura em px definida pelo usuário (arrastando a borda). Sem ela, vale `width` da coluna. */
  width?: number;
  /** Coluna fixa à esquerda. Sem ele, vale `fixed` da coluna. */
  fixed?: boolean;
}

export interface SortDescriptor {
  field: string;
  order: SortOrder;
}

export interface FilterDescriptor {
  field: string;
  operation: FilterOperation;
  value: any;
}

export interface SummaryItem {
  /** dataField da coluna a ser totalizada. */
  column: string;
  summaryType: SummaryType;
  /** Coluna onde o total é exibido. Padrão: a própria `column`. */
  showInColumn?: string;
  /** Texto exibido. "{0}" é substituído pelo valor formatado. Ex.: "Total: {0}". */
  displayFormat?: string;
  valueFormat?: ValueFormat;
  /**
   * Só em `groupSummary`: mostra o total na célula da coluna, na linha do grupo.
   * Sem ele, o total aparece ao lado do título do grupo.
   */
  alignByColumn?: boolean;
}

/**
 * Filtro do cabeçalho de uma coluna. `values` são chaves normalizadas (veja `groupKey`):
 * texto sem acento/caixa, data "AAAA-M-D", vazio = "".
 */
export interface HeaderFilter {
  field: string;
  type: 'include' | 'exclude';
  values: string[];
}

/** Um valor da lista do filtro do cabeçalho. */
export interface HeaderFilterItem {
  key: string;
  /** Texto formatado (vazio vira o texto de "(vazio)"). */
  text: string;
  value: any;
  count: number;
}

/** Um nível de agrupamento. */
export interface GroupDescriptor {
  field: string;
  order: SortOrder;
}

/** Grupos expandidos/recolhidos. */
export interface GroupExpansion {
  /** Estado padrão de todos os grupos. */
  all: boolean;
  /** Exceções por `path` do grupo (true = expandido). */
  overrides: Record<string, boolean>;
}

export interface GroupInfo<T = any> {
  field: string;
  /** Valor da primeira linha do grupo (para exibir). */
  value: any;
  /** Chave normalizada do valor (texto sem acento/caixa, data por dia). */
  key: string;
  /** Identifica o grupo entre todos os níveis. */
  path: string;
  level: number;
  /** Todas as linhas do grupo (inclusive dos subgrupos). */
  rows: T[];
  children?: GroupInfo<T>[];
}

/** Linha exibida quando há agrupamento: um cabeçalho de grupo ou uma linha de dados. */
export type GridRowItem<T = any> =
  | { type: 'group'; group: GroupInfo<T>; expanded: boolean; /** Grupo repetido no topo da página (continuação). */ continued: boolean }
  | { type: 'data'; row: T; level: number };

export interface SummaryResult extends SummaryItem {
  value: number | null;
  text: string;
}

export interface PagingOptions {
  enabled?: boolean;
  pageSize?: number;
  pageIndex?: number;
  /** Tamanhos oferecidos no seletor do pager. */
  allowedPageSizes?: number[];
  showPageSizeSelector?: boolean;
  showInfo?: boolean;
}

export interface QueryState {
  filters: FilterDescriptor[];
  searchText: string;
  sorts: SortDescriptor[];
  pageIndex: number;
  /** 0 desliga a paginação. */
  pageSize: number;
  /** Filtros do cabeçalho (lista de valores). */
  headerFilters?: HeaderFilter[];
  /** Agrupamento. A paginação passa a contar as linhas de grupo. */
  groups?: GroupDescriptor[];
  /** Padrão: tudo expandido. */
  groupExpansion?: GroupExpansion;
}

export interface QueryResult<T = any> {
  /** Todas as linhas após filtro, busca e ordenação. */
  rows: T[];
  /** Linhas da página atual. */
  pageRows: T[];
  totalCount: number;
  pageCount: number;
  pageIndex: number;
  /** Com agrupamento: grupos e linhas da página atual, na ordem de exibição. */
  items?: GridRowItem<T>[];
  /** Com agrupamento: grupos do primeiro nível. */
  groups?: GroupInfo<T>[];
}
