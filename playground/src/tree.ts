import { mountThemePicker } from './theme-picker';
import type { TreeColumnDef, TreeSelectionChangedDetail, ExpandedChangedDetail, TreeRowEventDetail } from '@brunomouradev/tree-list';
import '@brunomouradev/tree-list';

interface Conta {
  id: string;
  parentId: string | null;
  codigo: string;
  nome: string;
  orcado: number | null;
  realizado: number | null;
  responsavel: string;
  /** Só no modo "sob demanda": a conta tem filhos ainda não carregados. */
  temFilhos?: boolean;
}

// ---- plano de contas fictício (determinístico): 3 níveis, ~200 contas
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const pessoas = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa'];
const grupos: Record<string, string[]> = {
  Receitas: ['Vendas de produtos', 'Serviços', 'Assinaturas', 'Receitas financeiras'],
  'Custos operacionais': ['Matéria-prima', 'Frete', 'Embalagens', 'Comissões'],
  'Despesas administrativas': ['Pessoal', 'Aluguel', 'Energia', 'Tecnologia', 'Viagens'],
  'Despesas comerciais': ['Marketing', 'Eventos', 'Brindes'],
};

const contas: Conta[] = [];
Object.keys(grupos).forEach((g, gi) => {
  const gid = String(gi + 1);
  contas.push({ id: gid, parentId: null, codigo: gid, nome: g, orcado: null, realizado: null, responsavel: pick(pessoas) });
  grupos[g].forEach((s, si) => {
    const sid = `${gid}.${si + 1}`;
    contas.push({ id: sid, parentId: gid, codigo: sid, nome: s, orcado: null, realizado: null, responsavel: pick(pessoas) });
    const n = 3 + Math.floor(rnd() * 6);
    for (let k = 1; k <= n; k++) {
      const orcado = Math.round(2000 + rnd() * 48000);
      contas.push({
        id: `${sid}.${k}`,
        parentId: sid,
        codigo: `${sid}.${k}`,
        nome: `${s} — item ${k}`,
        orcado,
        realizado: Math.round(orcado * (0.7 + rnd() * 0.5)),
        responsavel: pick(pessoas),
      });
    }
  });
});

const brl: Intl.NumberFormatOptions = { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 };
const columns: TreeColumnDef<Conta>[] = [
  { dataField: 'nome', caption: 'Conta', minWidth: 280 },
  { dataField: 'codigo', caption: 'Código', width: 100 },
  // aggregate: nas contas-pai mostra a soma das contas abaixo
  { dataField: 'orcado', caption: 'Orçado', width: 140, dataType: 'number', format: brl, aggregate: 'sum' },
  { dataField: 'realizado', caption: 'Realizado', width: 140, dataType: 'number', format: brl, aggregate: 'sum' },
  {
    dataField: 'variacao',
    caption: 'Variação',
    width: 110,
    dataType: 'number',
    alignment: 'right',
    calculateCellValue: (c: Conta) => (c.orcado ? (c.realizado || 0) / c.orcado - 1 : null),
    format: { style: 'percent', maximumFractionDigits: 1 },
  },
  { dataField: 'responsavel', caption: 'Responsável', width: 130 },
];

const tree = document.getElementById('tree')!;
tree.columns = columns;
tree.dataSource = contas;
tree.expandedRowKeys = ['1', '3'];
tree.summary = [
  { column: 'orcado', summaryType: 'sum', displayFormat: '{0}' },
  { column: 'realizado', summaryType: 'sum', displayFormat: '{0}' },
];
// Linha vermelha quando o realizado passou 10% do orçado
tree.rowClass = (c: Conta) => (c.orcado && (c.realizado || 0) > c.orcado * 1.1 ? 'estourou' : '');

// ---- eventos
const log = document.getElementById('log')!;
tree.addEventListener('selection-changed', (e) => {
  const d = (e as CustomEvent<TreeSelectionChangedDetail<Conta>>).detail;
  const folhas = d.selectedRowsData.filter((c) => c.orcado != null);
  const total = folhas.reduce((s, c) => s + (c.realizado || 0), 0);
  log.textContent = `selection-changed → ${d.selectedRowKeys.length} conta(s), realizado das folhas ${total.toLocaleString('pt-BR', brl)}`;
});
tree.addEventListener('expanded-changed', (e) => {
  log.textContent = 'expanded-changed → abertas: ' + (e as CustomEvent<ExpandedChangedDetail>).detail.expandedRowKeys.join(', ');
});
tree.addEventListener('row-dblclick', (e) => {
  const d = (e as CustomEvent<TreeRowEventDetail<Conta>>).detail;
  log.textContent = `row-dblclick → ${d.data.codigo} ${d.data.nome} (nível ${d.level + 1})`;
});

// ---- controles da demo
const bind = (id: string, fn: (el: HTMLInputElement) => void) => {
  const el = document.getElementById(id) as HTMLInputElement;
  el.addEventListener('change', () => fn(el));
};
bind('opt-filter', (el) => (tree.showFilterRow = el.checked));
bind('opt-alt', (el) => (tree.rowAlternationEnabled = el.checked));
bind('opt-selection', (el) => {
  tree.clearSelection();
  tree.selectionMode = el.value as any;
});
// Sob demanda: começa só com os grupos; os filhos "chegam do servidor" ao abrir (com atraso simulado)
bind('opt-lazy', (el) => {
  if (el.checked) {
    tree.hasItemsExpr = 'temFilhos';
    tree.loadChildren = (pai: Conta) =>
      new Promise((ok) =>
        setTimeout(
          () => ok(contas.filter((c) => c.parentId === pai.id).map((c) => ({ ...c, temFilhos: contas.some((x) => x.parentId === c.id) }))),
          600,
        ),
      );
    tree.expandedRowKeys = [];
    tree.dataSource = contas.filter((c) => c.parentId == null).map((c) => ({ ...c, temFilhos: true }));
  } else {
    tree.loadChildren = undefined;
    tree.hasItemsExpr = undefined;
    tree.expandedRowKeys = ['1', '3'];
    tree.dataSource = contas;
  }
});
mountThemePicker(document.querySelector('.controls') as HTMLElement);
