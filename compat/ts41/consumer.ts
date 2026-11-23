// Projeto "consumidor" mínimo, como um Angular 11 usaria os pacotes.
// Se algum .d.ts usar sintaxe nova demais para o TypeScript 4.1, o check:compat falha.
import { configure } from '@brunomouradev/data-grid';
import type {
  BmDataGrid,
  ColumnDef,
  ColumnLayoutChangedDetail,
  GroupingChangedDetail,
  RowStyle,
  SummaryItem,
} from '@brunomouradev/data-grid';
import { toXlsx } from '@brunomouradev/data-grid/engine';
import type { BmPivotGrid, PivotField } from '@brunomouradev/pivot-grid';
import type { BmTreeList, TreeColumnDef } from '@brunomouradev/tree-list';
import type { GridState, RemoteLoadOptions, RemoteLoadResult } from '@brunomouradev/data-grid';

interface Titulo {
  id: number;
  tipo_titulo: number;
  valor: number;
}

configure({ theme: 'bootstrap4', locale: 'pt-BR', density: 'compact' });

const colunas: ColumnDef<Titulo>[] = [
  { dataField: 'id', caption: 'Nº' },
  { dataField: 'valor', format: { style: 'currency', currency: 'BRL' }, cssClass: (v: number) => (v < 0 ? 'negativo' : '') },
];
const totais: SummaryItem[] = [{ column: 'valor', summaryType: 'sum' }];

declare const grid: BmDataGrid<Titulo>;
grid.columns = colunas;
grid.summary = totais;
grid.rowClass = (t) => (t.tipo_titulo === 33 ? 'titulo-33' : '');
grid.rowStyle = (t): RowStyle | null => (t.valor < 0 ? { color: 'red' } : null);
grid.theme = 'material';
grid.exportToExcel('titulos', { selectedOnly: true });

const onLayout = (e: CustomEvent<ColumnLayoutChangedDetail>) => e.detail.layout.length;
const onGroups = (e: CustomEvent<GroupingChangedDetail>) => e.detail.groups.length;

declare const pivot: BmPivotGrid;
const campos: PivotField[] = [{ dataField: 'valor', area: 'data' }];
pivot.fields = campos;

grid.stateStoring = { storageKey: 'titulos' };
grid.remoteData = async (o: RemoteLoadOptions): Promise<RemoteLoadResult<Titulo>> => ({ data: [], totalCount: o.take });
const estado: GridState = grid.getState();
grid.setColumnFixed('id', true);
grid.setColumnWidth('valor', 120);
pivot.updateField('valor', { summaryDisplayMode: 'percentOfGrandTotal', conditionalFormat: { type: 'dataBar' } });
pivot.exportToExcel('pivot');

declare const arvore: BmTreeList<{ id: number; parentId: number | null; nome: string; valor: number }>;
const colunasArvore: TreeColumnDef[] = [{ dataField: 'nome' }, { dataField: 'valor', aggregate: 'sum' }];
arvore.columns = colunasArvore;
arvore.expandAll();

export { onLayout, onGroups, toXlsx, estado };
