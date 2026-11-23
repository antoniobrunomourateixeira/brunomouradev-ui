import type { DataType, SortOrder, SummaryType, ValueFormat } from '@brunomouradev/data-grid/engine';

export type { DataType, SortOrder, SummaryType, ValueFormat };

export type PivotArea = 'row' | 'column' | 'data' | 'filter';
export type GroupInterval = 'year' | 'quarter' | 'month' | 'day' | 'dayOfWeek';
export type FilterType = 'include' | 'exclude';

/**
 * Como mostrar o valor de um campo de dados (como o "Mostrar valores como" do Excel).
 * - percentOfGrandTotal: % do total geral
 * - percentOfRowTotal / percentOfColumnTotal: % do total da linha / da coluna
 * - percentOfParentRow / percentOfParentColumn: % do subtotal do grupo pai
 * - differenceFromPrevious / percentDifferenceFromPrevious: em relação à coluna anterior (ex.: mês anterior)
 * - runningTotal: total acumulado da esquerda para a direita
 */
export type SummaryDisplayMode =
  | 'absolute'
  | 'percentOfGrandTotal'
  | 'percentOfRowTotal'
  | 'percentOfColumnTotal'
  | 'percentOfParentRow'
  | 'percentOfParentColumn'
  | 'differenceFromPrevious'
  | 'percentDifferenceFromPrevious'
  | 'runningTotal';

/** Informações da célula para formatação condicional por função. */
export interface PivotCellInfo {
  rowPath: any[];
  columnPath: any[];
  /** Linha ou coluna de total/subtotal. */
  isTotal: boolean;
  dataField: string;
}

/**
 * Formatação condicional dos valores (não se aplica aos totais, exceto na função).
 * - colorScale: fundo de minColor (menor valor) até maxColor (maior), com midColor opcional
 * - dataBar: barra horizontal proporcional ao valor
 * - função: devolve um estilo CSS para a célula (ex.: { color: 'red' })
 */
export type PivotConditionalFormat =
  | { type: 'colorScale'; minColor?: string; midColor?: string; maxColor?: string }
  | { type: 'dataBar'; color?: string; negativeColor?: string }
  | ((value: number | null, cell: PivotCellInfo) => Record<string, string> | null | undefined);

/** Mostra só os N maiores (ou menores) valores do campo, pelo total de um campo de dados. */
export interface PivotTopN {
  count: number;
  /** name/dataField do campo de dados usado no ranking. Padrão: o primeiro. */
  dataField?: string;
  /** true = os N menores. */
  bottom?: boolean;
}

export interface PivotField<T = any> {
  /** Identificador único. Padrão: dataField (+ groupInterval). Necessário se o mesmo campo aparecer duas vezes. */
  name?: string;
  /** Campo do objeto. Aceita caminho aninhado ("cliente.uf"). */
  dataField?: string;
  /** Valor calculado (alternativa a dataField). */
  selector?: (row: T) => any;
  caption?: string;
  /** Área onde o campo está. Sem área, ele fica disponível no painel de campos. */
  area?: PivotArea;
  /** Ordem dentro da área. */
  areaIndex?: number;
  dataType?: DataType;
  /** Agrupa datas por ano, trimestre, mês, dia ou dia da semana. */
  groupInterval?: GroupInterval;
  /** Agregação na área de dados. Padrão: "sum" para números, "count" para o resto. */
  summaryType?: SummaryType;
  format?: ValueFormat;
  /** Ordenação dos valores de linha/coluna. Padrão: "asc". */
  sortOrder?: SortOrder;
  /**
   * Ordena os valores deste campo (linha ou coluna) pelo total de um campo de dados,
   * em vez do próprio valor. Recebe o `name` (ou `dataField`) do campo de dados.
   * A direção vem de `sortOrder`.
   */
  sortBySummaryField?: string;
  /**
   * Caminho no eixo oposto usado na ordenação por total. Ex.: `[2025]` ordena as linhas
   * pela coluna 2025. Padrão: `[]` (total geral).
   */
  sortBySummaryPath?: any[];
  /** Só nos campos de dados: como mostrar o valor (% do total, diferença, acumulado...). Padrão: "absolute". */
  summaryDisplayMode?: SummaryDisplayMode;
  /** Só nos campos de dados: cores ou barras conforme o valor. */
  conditionalFormat?: PivotConditionalFormat;
  /** Só nos campos de linha/coluna: mostrar apenas os N maiores (ou menores). Os totais acompanham. */
  topN?: PivotTopN;
  /** Os grupos deste campo começam expandidos. */
  expanded?: boolean;
  /** Valores filtrados (como no filtro do cabeçalho). */
  filterValues?: any[];
  /** "include": mantém só filterValues. "exclude": remove filterValues. Padrão: "include". */
  filterType?: FilterType;
  allowSorting?: boolean;
  allowFiltering?: boolean;
  /** false impede que o usuário mova o campo entre áreas. */
  allowDragging?: boolean;
}

export interface ResolvedPivotField<T = any> extends PivotField<T> {
  name: string;
  caption: string;
  dataType: DataType;
  summaryType: SummaryType;
  sortOrder: SortOrder;
}

export interface PivotNode {
  value: any;
  key: string;
  path: any[];
  pathKey: string;
  level: number;
  text: string;
  field: ResolvedPivotField;
  children: PivotNode[];
}

export interface PivotCube {
  rowFields: ResolvedPivotField[];
  columnFields: ResolvedPivotField[];
  dataFields: ResolvedPivotField[];
  rowRoot: PivotNode;
  columnRoot: PivotNode;
  /** Número de registros após os filtros. */
  recordCount: number;
  getValue(rowPathKey: string, columnPathKey: string, dataIndex: number): number | null;
}

export interface ExpansionState {
  /** Sobrescritas por pathKey (true = expandido). */
  overrides: Record<string, boolean>;
  /** Estado padrão após "expandir/recolher tudo". undefined = usa field.expanded. */
  all?: boolean;
}

/**
 * "tree": uma coluna de cabeçalho com recuo; o subtotal fica na linha do grupo.
 * "tabular": uma coluna por campo de linha; o subtotal vai numa linha "X Total" abaixo do grupo.
 */
export type PivotRowLayout = 'tree' | 'tabular';

export interface PivotLayoutOptions {
  rowExpansion: ExpansionState;
  columnExpansion: ExpansionState;
  showRowGrandTotals: boolean;
  showColumnGrandTotals: boolean;
  /** Coluna de subtotal ao lado de cada grupo de colunas expandido. */
  showColumnTotals: boolean;
  texts: { total: string; grandTotal: string };
  /** Padrão: "tree". */
  rowLayout?: PivotRowLayout;
  /** Só no layout tabular: linha "X Total" abaixo de cada grupo expandido. Padrão: true. */
  showRowTotals?: boolean;
}

/** Célula de cabeçalho de linha no layout tabular. */
export interface PivotRowHeaderCell {
  text: string;
  rowspan: number;
  colspan: number;
  /** Coluna de cabeçalho onde a célula começa (0 = primeiro campo de linha). */
  column: number;
  type: 'value' | 'total' | 'grand';
  pathKey: string;
  path: any[];
  expandable: boolean;
  expanded: boolean;
}

export interface PivotRowItem {
  node: PivotNode | null;
  pathKey: string;
  path: any[];
  level: number;
  text: string;
  expandable: boolean;
  expanded: boolean;
  isGrandTotal: boolean;
  /** Linha de subtotal "X Total" (layout tabular). */
  isTotal: boolean;
  /** Layout tabular: células de cabeçalho que começam nesta linha (da coluna de fora para a de dentro). */
  headers?: PivotRowHeaderCell[];
}

export type PivotColumnType = 'value' | 'total' | 'grand';

export interface PivotColumnItem {
  pathKey: string;
  path: any[];
  type: PivotColumnType;
  dataIndex: number;
}

export interface PivotHeaderCell {
  text: string;
  colspan: number;
  rowspan: number;
  type: PivotColumnType | 'data';
  pathKey?: string;
  path?: any[];
  expandable: boolean;
  expanded: boolean;
  /** Presente nos cabeçalhos-folha (uma coluna de valores): permite ordenar as linhas por ela. */
  dataIndex?: number;
  /** Direção da ordenação das linhas por esta coluna, quando ativa. */
  sortOrder?: SortOrder;
}

export interface PivotView {
  rows: PivotRowItem[];
  /** Número de colunas de cabeçalho de linha (1 no layout em árvore). */
  rowHeaderColumns: number;
  columns: PivotColumnItem[];
  headerRows: PivotHeaderCell[][];
}
