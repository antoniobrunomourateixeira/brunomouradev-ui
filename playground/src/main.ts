import type { ColumnDef, ColumnLayoutChangedDetail, GroupingChangedDetail, SelectionChangedDetail, RowEventDetail } from '@brunomouradev/data-grid';
import '@brunomouradev/data-grid';
import type { RemoteLoadOptions } from '@brunomouradev/data-grid';
import { computeSummary, query, resolveColumns } from '@brunomouradev/data-grid/engine';
import { mountThemePicker } from './theme-picker';

mountThemePicker(document.querySelector('.controls') as HTMLElement);

interface Fatura {
  id: number;
  cliente: { nome: string; uf: string };
  vencimento: string;
  valor: number;
  pago: boolean;
  status: 'pago' | 'aberto' | 'atrasado';
  emissao: string;
  forma: string;
  tipo_titulo: number;
}

// ---- dados fictícios (gerador determinístico)
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Élida', 'Fábio', 'Gabriela', 'Heitor', 'Íris', 'João', 'Larissa', 'Márcio'];
const sobrenomes = ['Souza', 'Lima', 'Dias', 'Reis', 'Moura', 'Andrade', 'Costa', 'Prado', 'Ávila', 'Nunes'];
const ufs = ['PR', 'SP', 'SC', 'RS', 'MG', 'RJ'];

const gerar = (n: number): Fatura[] => Array.from({ length: n }, (_, i) => {
  const venc = new Date(2026, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28));
  const status = pick<Fatura['status']>(['pago', 'pago', 'aberto', 'atrasado']);
  return {
    id: i + 1,
    cliente: { nome: `${pick(nomes)} ${pick(sobrenomes)}`, uf: pick(ufs) },
    vencimento: venc.toISOString().slice(0, 10),
    valor: Math.round(rnd() * 500000) / 100,
    pago: status === 'pago',
    status,
    emissao: new Date(venc.getTime() - 30 * 86400000).toISOString().slice(0, 10),
    forma: pick(['Boleto', 'Pix', 'Cartão']),
    tipo_titulo: pick([11, 22, 33]),
  };
});
const dados = gerar(1000);
let muitos: Fatura[] | null = null; // 100 mil linhas, geradas só quando pedir

const columns: ColumnDef<Fatura>[] = [
  { dataField: 'id', caption: 'Nº', width: 80, fixed: true },
  { dataField: 'cliente.nome', caption: 'Cliente', minWidth: 160 },
  { dataField: 'cliente.uf', caption: 'UF', width: 70, alignment: 'center' },
  { dataField: 'vencimento', caption: 'Vencimento', dataType: 'date', width: 140, sortOrder: 'asc' },
  {
    dataField: 'valor',
    caption: 'Valor',
    width: 140,
    format: { style: 'currency', currency: 'BRL' },
    // Célula conforme o valor: o nome vira um part (CSS no index.html)
    cssClass: (v: number) => (v >= 4500 ? 'valor-alto' : ''),
  },
  // Célula por template: desenhada fora do Shadow DOM (o CSS da página vale aqui)
  { dataField: '__acoes', caption: 'Ações', width: 80, cellTemplate: 'acoes', allowSorting: false, allowFiltering: false, allowHeaderFiltering: false, allowSearch: false, calculateCellValue: () => '' },
  { dataField: 'tipo_titulo', caption: 'Tipo', width: 80, alignment: 'center' },
  { dataField: 'pago', caption: 'Pago', width: 90 },
  {
    dataField: 'status',
    caption: 'Status',
    width: 120,
    cellRender: (v: string) => {
      const span = document.createElement('span');
      span.className = 'badge ' + v;
      span.textContent = v;
      return span;
    },
  },
  // Colunas opcionais: começam escondidas e aparecem pelo botão "Colunas"
  { dataField: 'emissao', caption: 'Emissão', dataType: 'date', width: 140, visible: false },
  { dataField: 'forma', caption: 'Forma de pagamento', width: 160, visible: false },
];

const grid = document.getElementById('grid')!;
grid.columns = columns;

// Templates de célula (no Angular, a diretiva bmCellTemplate faz isto sozinha)
grid.cellTemplateRenderer = ({ name, element, row }: any) => {
  if (name !== 'acoes') return;
  element.innerHTML = '<details class="pg-menu"><summary>⋯</summary><div class="pg-menu-itens"><button type="button">Abrir ' + row.id + '</button></div></details>';
  const btn = element.querySelector('button')!;
  const onClick = (e: Event) => { e.stopPropagation(); alert('Abrir ' + row.id); };
  btn.addEventListener('click', onClick);
  return () => btn.removeEventListener('click', onClick);
};

// Estado salvo no navegador: colunas (ordem, visibilidade, largura, fixas), ordenação,
// filtros, busca, agrupamento e tamanho da página. Uma linha só:
const STATE_KEY = 'bm-playground-grid-state';
try {
  // migra o layout/agrupamento salvos pelas versões anteriores do playground
  const oldLayout = localStorage.getItem('bm-playground-grid-layout');
  if (oldLayout && !localStorage.getItem(STATE_KEY)) {
    const oldGroups = localStorage.getItem('bm-playground-grid-grouping');
    localStorage.setItem(STATE_KEY, JSON.stringify({ columns: JSON.parse(oldLayout), groups: oldGroups ? JSON.parse(oldGroups) : [] }));
  }
} catch {
  /* sem localStorage */
}
grid.stateStoring = { storageKey: STATE_KEY };

grid.addEventListener('column-layout-changed', (e) => {
  const { layout } = (e as CustomEvent<ColumnLayoutChangedDetail>).detail;
  log.textContent = 'column-layout-changed → ' + layout.filter((c) => c.visible).map((c) => c.dataField + (c.width ? ' ' + c.width + 'px' : '')).join(', ');
});
grid.addEventListener('grouping-changed', (e) => {
  const { groups } = (e as CustomEvent<GroupingChangedDetail>).detail;
  log.textContent = 'grouping-changed → ' + (groups.map((g) => g.field + ' ' + g.order).join(', ') || '(sem grupos)');
});
// Totais em cada grupo: quantidade ao lado do título, soma na coluna Valor
grid.groupSummary = [
  { column: 'id', summaryType: 'count', displayFormat: '{0} faturas', showInColumn: 'cliente.nome' },
  { column: 'valor', summaryType: 'sum', displayFormat: '{0}', alignByColumn: true },
];
grid.dataSource = dados;
grid.paging = { pageSize: 20, allowedPageSizes: [10, 20, 50, 100] };
// Linha conforme os dados
// 1) por classe: o CSS fica no index.html (bm-data-grid::part(titulo-33))
grid.rowClass = (f: Fatura) => (f.tipo_titulo === 33 ? 'titulo-33' : '');
// 2) por estilo, sem CSS
grid.rowStyle = (f: Fatura) => (f.status === 'atrasado' ? { color: '#c92a2a' } : null);

grid.cellStyles = `
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; text-transform:capitalize; }
  .badge.pago { background:#d1f4e0; color:#116329; }
  .badge.aberto { background:#fff1c2; color:#7d4e00; }
  .badge.atrasado { background:#ffd8d3; color:#a40e26; }
`;
grid.summary = [
  { column: 'id', summaryType: 'count', displayFormat: '{0} faturas', showInColumn: 'cliente.nome' },
  { column: 'valor', summaryType: 'sum', displayFormat: 'Total: {0}' },
  { column: 'valor', summaryType: 'avg', displayFormat: 'Média: {0}' },
];

// ---- eventos
const log = document.getElementById('log')!;
grid.addEventListener('selection-changed', (e) => {
  const d = (e as CustomEvent<SelectionChangedDetail<Fatura>>).detail;
  const total = d.selectedRowsData.reduce((s, r) => s + r.valor, 0);
  log.textContent = `selection-changed → ${d.selectedRowKeys.length} selecionada(s), total ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
});
grid.addEventListener('row-dblclick', (e) => {
  const d = (e as CustomEvent<RowEventDetail<Fatura>>).detail;
  log.textContent = `row-dblclick → fatura ${d.key} de ${d.data.cliente.nome}`;
});

// ---- controles da demo
const bind = (id: string, fn: (el: HTMLInputElement) => void) => {
  const el = document.getElementById(id) as HTMLInputElement;
  el.addEventListener('change', () => fn(el));
};
bind('opt-filter', (el) => (grid.showFilterRow = el.checked));
bind('opt-search', (el) => (grid.showSearchPanel = el.checked));
bind('opt-alt', (el) => (grid.rowAlternationEnabled = el.checked));
bind('opt-collines', (el) => (grid.showColumnLines = el.checked));
bind('opt-selection', (el) => {
  grid.clearSelection();
  grid.selectionMode = el.value as any;
});

// Dados do servidor (simulado): o que uma API faria com os parâmetros que a grid manda
const servidor = async (o: RemoteLoadOptions) => {
  await new Promise((r) => setTimeout(r, 500)); // latência de rede
  if (o.signal.aborted) throw new DOMException('cancelado', 'AbortError');
  const cols = resolveColumns(columns, dados);
  const res = query(
    dados,
    cols,
    { filters: o.filters, headerFilters: o.headerFilters, searchText: o.searchText, sorts: o.sorts, pageIndex: o.take ? o.skip / o.take : 0, pageSize: o.take },
    'pt-BR',
  );
  return { data: res.pageRows, totalCount: res.totalCount, summary: grid.summary.map((s) => computeSummary(res.rows, s, cols, 'pt-BR').value) };
};
bind('opt-remote', (el) => {
  grid.remoteData = el.checked ? servidor : undefined;
  log.textContent = el.checked ? 'remoteData ligado: cada página, ordenação e filtro vira uma chamada ao servidor' : 'remoteData desligado';
});
bind('opt-virtual', (el) => {
  if (el.checked && !muitos) muitos = gerar(100000);
  grid.virtualScrolling = el.checked;
  grid.dataSource = el.checked ? muitos! : dados;
});
