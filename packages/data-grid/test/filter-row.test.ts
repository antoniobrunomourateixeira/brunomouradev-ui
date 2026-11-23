import { describe, expect, it } from 'vitest';
import { applyFilters, parseDatePeriod, parseFilterInput, resolveColumns } from '../src/engine/index';

const data = [
  { id: 1, valor: 50, venc: '2026-04-30' },
  { id: 2, valor: 100, venc: '2026-05-01' },
  { id: 3, valor: 150, venc: '2026-05-31' },
  { id: 4, valor: 200, venc: '2026-06-01' },
  { id: 5, valor: null, venc: null },
];
const cols = resolveColumns([{ dataField: 'id' }, { dataField: 'valor', dataType: 'number' }, { dataField: 'venc', dataType: 'date' }], data);
const run = (field: string, text: string, op?: any) => {
  const col = cols.find((c) => c.dataField === field)!;
  const p = parseFilterInput(text, col.dataType, op);
  return p ? applyFilters(data, [{ field, ...p }], cols).map((r) => r.id) : null;
};

describe('linha de filtro: períodos de data', () => {
  it('ano, mês e dia (pt-BR e ISO)', () => {
    expect(parseDatePeriod('2026')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(parseDatePeriod('05/2026')).toEqual({ from: '2026-05-01', to: '2026-05-31' });
    expect(parseDatePeriod('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(parseDatePeriod('10/05/2026')).toEqual({ from: '2026-05-10', to: '2026-05-10' });
    expect(parseDatePeriod('05/10/2026', 'en-US')).toEqual({ from: '2026-05-10', to: '2026-05-10' });
    expect(parseDatePeriod('31/02/2026')).toBeNull();
    expect(parseDatePeriod('13/2026')).toBeNull();
  });

  it('mês inteiro, antes/depois do período e diferente', () => {
    expect(run('venc', '05/2026')).toEqual([2, 3]);
    expect(run('venc', '>05/2026')).toEqual([4]); // depois do fim de maio
    expect(run('venc', '<05/2026')).toEqual([1]); // antes do início de maio
    expect(run('venc', '>=05/2026')).toEqual([2, 3, 4]);
    expect(run('venc', '<>05/2026')).toEqual([1, 4, 5]);
    expect(run('venc', '2026-05-01')).toEqual([2]);
  });

  it('intervalo com ".." e operador "entre" com um lado só', () => {
    expect(run('venc', '30/04/2026..01/05/2026')).toEqual([1, 2]);
    expect(run('venc', '05/2026..')).toEqual([2, 3, 4]);
    expect(run('venc', '05/2026', 'between')).toEqual([2, 3]);
  });
});

describe('linha de filtro: números', () => {
  it('intervalo e operadores', () => {
    expect(run('valor', '100..150')).toEqual([2, 3]);
    expect(run('valor', '..100')).toEqual([1, 2]);
    expect(run('valor', '>=150')).toEqual([3, 4]);
    expect(run('valor', '100', '>')).toEqual([3, 4]); // operador escolhido no menu
    expect(run('valor', '<100', '>')).toEqual([1]); // prefixo digitado vence o menu
    expect(run('valor', '1.000,5')).toEqual([]);
    expect(parseFilterInput('abc', 'number')).toBeNull();
  });
});
