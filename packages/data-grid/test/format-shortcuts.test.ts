import { describe, expect, it } from 'vitest';
import { formatValue, normalizeFormat, resolveColumns } from '../src/engine/index';
import { excelNumberFormat } from '../src/engine/xlsx';

const nbsp = (s: string) => s.replace(/ | /g, ' ');

describe('atalhos de format', () => {
  it('currency usa BRL no pt-BR e USD no en-US', () => {
    expect(nbsp(formatValue(1234.5, 'number', 'currency', 'pt-BR'))).toBe('R$ 1.234,50');
    expect(formatValue(1234.5, 'number', 'currency', 'en-US')).toBe('$1,234.50');
  });

  it('integer não usa separador de milhar; number usa', () => {
    expect(formatValue(23924, 'number', 'integer', 'pt-BR')).toBe('23924');
    expect(formatValue(23924.456, 'number', 'number', 'pt-BR')).toBe('23.924,46');
  });

  it('percent mostra o valor como está (12.5 → 12,5%)', () => {
    expect(formatValue(12.5, 'number', 'percent', 'pt-BR')).toBe('12,5%');
  });

  it('date e datetime no formato do locale', () => {
    expect(formatValue('2024-11-03', 'date', 'date', 'pt-BR')).toBe('03/11/2024');
    expect(nbsp(formatValue('2024-11-03T14:05:00', 'date', 'datetime', 'pt-BR'))).toBe('03/11/2024, 14:05');
  });

  it('o atalho define o dataType e o alinhamento da coluna', () => {
    const [v, d] = resolveColumns([{ dataField: 'v', format: 'currency' }, { dataField: 'd', format: 'date' }], [{ v: '10', d: 'x' }]);
    expect(v.dataType).toBe('number');
    expect(v.alignment).toBe('right');
    expect(d.dataType).toBe('date');
  });

  it('Excel recebe formatos de número equivalentes', () => {
    expect(excelNumberFormat('integer', 'pt-BR')).toBe('0');
    expect(excelNumberFormat('percent', 'pt-BR')).toBe('#,##0.00"%"');
    expect(excelNumberFormat('currency', 'pt-BR')).toContain('R$');
  });

  it('formatos que não são atalho passam direto', () => {
    const o = { style: 'currency', currency: 'EUR' } as const;
    expect(normalizeFormat(o, 'pt-BR')).toBe(o);
  });
});
