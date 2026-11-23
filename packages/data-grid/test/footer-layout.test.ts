import { describe, expect, it } from 'vitest';
import { footerSpans } from '../src/engine/index';

const E = { filled: false };
const R = { filled: true, align: 'right' as const };
const L = { filled: true, align: 'left' as const };

describe('footerSpans', () => {
  it('total à direita ocupa as colunas vazias à esquerda', () => {
    expect(footerSpans([E, E, E, R, E])).toEqual([
      { owner: 3, start: 0, span: 4 },
      { owner: -1, start: 4, span: 1 },
    ]);
  });

  it('total à esquerda ocupa as vazias à direita', () => {
    expect(footerSpans([L, E, E])).toEqual([{ owner: 0, start: 0, span: 3 }]);
  });

  it('o alinhado à direita escolhe primeiro', () => {
    expect(footerSpans([L, E, E, R])).toEqual([
      { owner: 0, start: 0, span: 1 },
      { owner: 3, start: 1, span: 3 },
    ]);
  });

  it('para no próximo total', () => {
    expect(footerSpans([E, R, E, R])).toEqual([
      { owner: 1, start: 0, span: 2 },
      { owner: 3, start: 2, span: 2 },
    ]);
  });

  it('colunas travadas não se juntam', () => {
    expect(footerSpans([{ filled: true, align: 'right', locked: true }, { filled: false, locked: true }, E, R])).toEqual([
      { owner: 0, start: 0, span: 1 },
      { owner: -1, start: 1, span: 1 },
      { owner: 3, start: 2, span: 2 },
    ]);
  });

  it('sem totais: uma célula vazia por coluna', () => {
    expect(footerSpans([E, E])).toEqual([
      { owner: -1, start: 0, span: 1 },
      { owner: -1, start: 1, span: 1 },
    ]);
  });
});
