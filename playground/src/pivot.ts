import { mountThemePicker } from './theme-picker';
import type { PivotCellEventDetail, PivotField } from '@brunomouradev/pivot-grid';
import '@brunomouradev/pivot-grid';

interface Venda {
  id: number;
  data: string;
  regiao: string;
  uf: string;
  vendedor: string;
  categoria: string;
  produto: string;
  quantidade: number;
  valor: number;
}

// ---- dados fictícios (gerador determinístico)
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

const regioes: Record<string, string[]> = {
  Sul: ['PR', 'SC', 'RS'],
  Sudeste: ['SP', 'RJ', 'MG'],
  'Centro-Oeste': ['GO', 'MS'],
  Nordeste: ['BA', 'PE'],
};
const catalogo: Record<string, [string, number][]> = {
  Eletrônicos: [['Notebook', 4200], ['Monitor', 1100], ['Fone', 250]],
  Móveis: [['Cadeira', 900], ['Mesa', 1500]],
  Papelaria: [['Caderno', 25], ['Caneta', 4], ['Agenda', 45]],
};
const vendedores = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio'];

const vendas: Venda[] = Array.from({ length: 5000 }, (_, i) => {
  const regiao = pick(Object.keys(regioes));
  const categoria = pick(Object.keys(catalogo));
  const [produto, preco] = pick(catalogo[categoria]);
  const quantidade = 1 + Math.floor(rnd() * 10);
  const d = new Date(2024 + Math.floor(rnd() * 3), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28));
  return {
    id: i + 1,
    data: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    regiao,
    uf: pick(regioes[regiao]),
    vendedor: pick(vendedores),
    categoria,
    produto,
    quantidade,
    valor: Math.round(quantidade * preco * (0.85 + rnd() * 0.3) * 100) / 100,
  };
});

const brl: Intl.NumberFormatOptions = { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 };

const fields: PivotField<Venda>[] = [
  { dataField: 'regiao', caption: 'Região', area: 'row', areaIndex: 0, expanded: true },
  { dataField: 'uf', caption: 'UF', area: 'row', areaIndex: 1 },
  { dataField: 'data', caption: 'Ano', groupInterval: 'year', area: 'column', areaIndex: 0 },
  { dataField: 'data', caption: 'Trimestre', groupInterval: 'quarter', area: 'column', areaIndex: 1 },
  { dataField: 'data', caption: 'Mês', groupInterval: 'month' },
  { dataField: 'valor', caption: 'Faturamento', area: 'data', summaryType: 'sum', format: brl },
  { dataField: 'quantidade', caption: 'Quantidade' },
  { dataField: 'categoria', caption: 'Categoria', area: 'filter' },
  { dataField: 'produto', caption: 'Produto' },
  { dataField: 'vendedor', caption: 'Vendedor' },
];

const pivot = document.getElementById('pivot')!;
pivot.fields = fields;
pivot.dataSource = vendas;

// ---- eventos
const log = document.getElementById('log')!;
pivot.addEventListener('cell-dblclick', (e) => {
  const d = (e as CustomEvent<PivotCellEventDetail<Venda>>).detail;
  const linha = d.rowPath.join(' › ') || 'Total Geral';
  const coluna = d.columnPath.join(' › ') || 'Total Geral';
  log.textContent = `cell-dblclick → ${linha} × ${coluna}: ${d.records!.length} registros (ids ${d.records!.slice(0, 8).map((r) => r.id).join(', ')}${d.records!.length > 8 ? '…' : ''})`;
});
pivot.addEventListener('fields-changed', (e) => {
  const f = (e as CustomEvent).detail.fields as PivotField[];
  const resumo = (a: string) => f.filter((x) => x.area === a).sort((x, y) => (x.areaIndex ?? 0) - (y.areaIndex ?? 0)).map((x) => x.caption).join(', ') || '—';
  log.textContent = `fields-changed → linhas: ${resumo('row')} | colunas: ${resumo('column')} | valores: ${resumo('data')}`;
});

// ---- controles da demo
const bind = (id: string, fn: (el: HTMLInputElement) => void) => {
  const el = document.getElementById(id) as HTMLInputElement;
  el.addEventListener('change', () => fn(el));
};
bind('opt-panel', (el) => (pivot.showFieldPanel = el.checked));
bind('opt-coltotals', (el) => (pivot.showColumnTotals = el.checked));
bind('opt-tabular', (el) => (pivot.rowLayout = el.checked ? 'tabular' : 'tree'));
// Formatação condicional: barras proporcionais ao faturamento
bind('opt-bars', (el) => pivot.updateField('valor', { conditionalFormat: el.checked ? { type: 'dataBar' } : undefined }));
// Escala de cores (verde = maior)
bind('opt-heat', (el) => pivot.updateField('valor', { conditionalFormat: el.checked ? { type: 'colorScale' } : undefined }));
// Top N: só as 5 UFs que mais faturam (os totais acompanham)
bind('opt-top', (el) => pivot.updateField('uf', { topN: el.checked ? { count: 5 } : undefined }));
const modo = document.getElementById('opt-mode') as HTMLSelectElement;
modo.addEventListener('change', () => pivot.updateField('valor', { summaryDisplayMode: modo.value as any }));
mountThemePicker(document.querySelector('.controls') as HTMLElement);
