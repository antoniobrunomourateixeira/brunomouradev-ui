/**
 * Layout do rodapé de totais: cada total pode ocupar as colunas vizinhas que estão vazias
 * (sem total), como um `colspan` feito à mão. Assim "Total: R$ 2.521.018,87" não quebra
 * em várias linhas quando a coluna é estreita.
 *
 * - Total alinhado à direita (números) cresce para a esquerda.
 * - Total alinhado à esquerda ou ao centro cresce para a direita.
 * - Os alinhados à direita escolhem primeiro (são os que mais precisam de espaço).
 * - Colunas travadas (`locked`, ex.: colunas fixas) não se juntam com nenhuma outra.
 */
export interface FooterCellInfo {
  /** A coluna tem algum total. */
  filled: boolean;
  align?: 'left' | 'right' | 'center';
  /** Não pode ser mesclada (colunas fixas). */
  locked?: boolean;
}

export interface FooterSpan {
  /** Índice da coluna cujo conteúdo e alinhamento a célula usa (-1 = célula vazia). */
  owner: number;
  /** Primeira coluna coberta pela célula. */
  start: number;
  /** Quantas colunas a célula cobre (colspan). */
  span: number;
}

export function footerSpans(cells: FooterCellInfo[]): FooterSpan[] {
  const n = cells.length;
  const owner = cells.map((c, i) => (c.filled ? i : -1));
  const free = (j: number) => !cells[j].filled && !cells[j].locked && owner[j] === -1;

  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (!c.filled || c.locked || c.align !== 'right') continue;
    for (let j = i - 1; j >= 0 && free(j); j--) owner[j] = i;
  }
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (!c.filled || c.locked || c.align === 'right') continue;
    for (let j = i + 1; j < n && free(j); j++) owner[j] = i;
  }

  const out: FooterSpan[] = [];
  for (let i = 0; i < n; ) {
    const o = owner[i];
    let j = i + 1;
    if (o !== -1) while (j < n && owner[j] === o) j++;
    out.push({ owner: o, start: i, span: j - i });
    i = j;
  }
  return out;
}
