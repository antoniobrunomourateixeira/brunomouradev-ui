import { describe, expect, it } from 'vitest';
import {
  applyColumnLayout,
  defaultColumnLayout,
  fixedFirst,
  mergeColumnLayout,
  resolveColumns,
  sameColumnLayout,
  setColumnFixed,
  setColumnWidths,
  type ColumnDef,
} from '../src/engine/index';

const defs: ColumnDef[] = [
  { dataField: 'id', width: 80, fixed: true },
  { dataField: 'nome' },
  { dataField: 'valor', width: 120 },
];
const cols = resolveColumns(defs, []);

describe('largura e colunas fixas', () => {
  it('padrão guarda fixed da definição e não grava largura', () => {
    expect(defaultColumnLayout(cols)).toEqual([
      { dataField: 'id', visible: true, fixed: true },
      { dataField: 'nome', visible: true },
      { dataField: 'valor', visible: true },
    ]);
  });

  it('setColumnWidths grava px (mínimo 20) e null volta ao padrão', () => {
    let l = setColumnWidths(defaultColumnLayout(cols), { nome: 250.6, valor: 5 });
    expect(l.find((x) => x.dataField === 'nome')!.width).toBe(251);
    expect(l.find((x) => x.dataField === 'valor')!.width).toBe(20);
    l = setColumnWidths(l, { nome: null });
    expect(l.find((x) => x.dataField === 'nome')!.width).toBeUndefined();
  });

  it('applyColumnLayout usa a largura e o fixed do layout', () => {
    const l = setColumnFixed(setColumnWidths(defaultColumnLayout(cols), { nome: 300 }), 'id', false);
    const out = applyColumnLayout(cols, setColumnFixed(l, 'valor', true));
    expect(out.map((c) => `${c.dataField}:${c.width}:${c.fixed}`)).toEqual(['id:80:false', 'nome:300:false', 'valor:120:true']);
    expect(fixedFirst(out).map((c) => c.dataField)).toEqual(['valor', 'id', 'nome']);
  });

  it('layout salvo traz largura e fixed; sem fixed salvo vale o da coluna', () => {
    const merged = mergeColumnLayout(cols, [
      { dataField: 'nome', visible: true, width: 222, fixed: true },
      { dataField: 'id', visible: true },
    ]);
    // valor não estava salvo: entra logo depois da vizinha anterior no padrão (nome)
    expect(merged).toEqual([
      { dataField: 'nome', visible: true, width: 222, fixed: true },
      { dataField: 'valor', visible: true },
      { dataField: 'id', visible: true, fixed: true },
    ]);
  });

  it('sameColumnLayout considera largura e fixed', () => {
    const a = defaultColumnLayout(cols);
    expect(sameColumnLayout(a, setColumnWidths(a, { nome: 100 }))).toBe(false);
    expect(sameColumnLayout(a, setColumnFixed(a, 'nome', true))).toBe(false);
    expect(sameColumnLayout(a, a.map((x) => ({ ...x })))).toBe(true);
  });
});
