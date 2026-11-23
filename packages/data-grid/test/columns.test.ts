import { describe, expect, it } from 'vitest';
import {
  applyColumnLayout,
  defaultColumnLayout,
  mergeColumnLayout,
  moveColumnBefore,
  moveColumnToVisibleIndex,
  query,
  resolveColumns,
  sameColumnLayout,
  setColumnVisibility,
  toCsv,
  type ColumnDef,
  type ColumnLayoutItem,
} from '../src/engine/index';

const data = [{ id: 1, nome: 'Ana', cidade: 'Curitiba', valor: 10, obs: 'x' }];
const defs: ColumnDef[] = [
  { dataField: 'id' },
  { dataField: 'nome' },
  { dataField: 'cidade' },
  { dataField: 'valor' },
  { dataField: 'obs', visible: false },
];
const cols = resolveColumns(defs, data);
const order = (l: ColumnLayoutItem[]) => l.map((x) => (x.visible ? x.dataField : '-' + x.dataField)).join(',');

describe('layout de colunas', () => {
  it('padrão segue a definição (ordem e visible)', () => {
    expect(order(defaultColumnLayout(cols))).toBe('id,nome,cidade,valor,-obs');
  });

  it('visibleIndex muda a ordem inicial', () => {
    const c = resolveColumns([{ dataField: 'a', visibleIndex: 2 }, { dataField: 'b' }, { dataField: 'c', visibleIndex: 0 }], []);
    // b não tem visibleIndex: usa a posição no array (1)
    expect(order(defaultColumnLayout(c))).toBe('c,b,a');
  });

  it('esconde e mostra, mas nunca a última visível', () => {
    let l = defaultColumnLayout(cols);
    l = setColumnVisibility(l, 'cidade', false);
    l = setColumnVisibility(l, 'obs', true);
    expect(order(l)).toBe('id,nome,-cidade,valor,obs');
    ['id', 'nome', 'valor', 'obs'].forEach((f) => (l = setColumnVisibility(l, f, false)));
    expect(l.filter((x) => x.visible).map((x) => x.dataField)).toEqual(['obs']);
  });

  it('move antes de outra coluna ou para o fim', () => {
    const l = defaultColumnLayout(cols);
    expect(order(moveColumnBefore(l, 'valor', 'id'))).toBe('valor,id,nome,cidade,-obs');
    expect(order(moveColumnBefore(l, 'id', null))).toBe('nome,cidade,valor,-obs,id');
    expect(moveColumnBefore(l, 'id', 'id')).toBe(l);
  });

  it('move por posição entre as visíveis, ignorando as escondidas', () => {
    let l = setColumnVisibility(defaultColumnLayout(cols), 'nome', false); // id,-nome,cidade,valor,-obs
    l = moveColumnToVisibleIndex(l, 'valor', 1); // visíveis: id, valor, cidade
    expect(applyColumnLayout(cols, l).filter((c) => c.visible).map((c) => c.dataField)).toEqual(['id', 'valor', 'cidade']);
  });

  it('layout salvo: ignora colunas que sumiram e encaixa as novas', () => {
    const saved: ColumnLayoutItem[] = [
      { dataField: 'valor', visible: true },
      { dataField: 'apagada', visible: true },
      { dataField: 'id', visible: false },
      { dataField: 'nome', visible: true },
    ];
    // cidade e obs não estavam salvas: cidade entra depois de nome (vizinha no padrão), obs depois de valor
    expect(order(mergeColumnLayout(cols, saved))).toBe('valor,-obs,-id,nome,cidade');
  });

  it('layout salvo sem nenhuma visível mostra a primeira', () => {
    const saved = cols.map((c) => ({ dataField: c.dataField, visible: false }));
    expect(mergeColumnLayout(cols, saved)[0].visible).toBe(true);
  });

  it('applyColumnLayout reordena e aplica a visibilidade; busca e CSV seguem o layout', () => {
    const l = moveColumnBefore(setColumnVisibility(defaultColumnLayout(cols), 'nome', false), 'valor', 'id');
    const ordered = applyColumnLayout(cols, l);
    expect(ordered.map((c) => c.dataField + (c.visible ? '' : '*'))).toEqual(['valor', 'id', 'nome*', 'cidade', 'obs*']);
    expect(toCsv(data, ordered, 'pt-BR').split('\r\n')[0]).toBe('Valor;Id;Cidade');
    // coluna escondida não entra na busca
    expect(query(data, ordered, { filters: [], sorts: [], pageIndex: 0, pageSize: 0, searchText: 'ana' }, 'pt-BR').totalCount).toBe(0);
    expect(query(data, ordered, { filters: [], sorts: [], pageIndex: 0, pageSize: 0, searchText: 'curi' }, 'pt-BR').totalCount).toBe(1);
  });

  it('sameColumnLayout', () => {
    const l = defaultColumnLayout(cols);
    expect(sameColumnLayout(l, l.map((x) => ({ ...x })))).toBe(true);
    expect(sameColumnLayout(l, moveColumnBefore(l, 'nome', 'id'))).toBe(false);
  });
});
