# brunomouradev-ui — Documentação completa

Biblioteca de componentes de tabela no estilo DevExpress, feita com **Web Components** (Lit + TypeScript). Funciona em Angular (11+), React, Vue ou HTML puro, sem depender de framework.

| Pacote | Tag | Para quê |
|---|---|---|
| `@brunomouradev/data-grid` | `<bm-data-grid>` | Tabela de dados: ordenar, filtrar, agrupar, paginar, selecionar, totais, Excel, dados do servidor |
| `@brunomouradev/pivot-grid` | `<bm-pivot-grid>` | Tabela dinâmica (como a do Excel): linhas × colunas × valores, subtotais, % do total, Top N |
| `@brunomouradev/tree-list` | `<bm-tree-list>` | Tabela em árvore: plano de contas, centros de custo, categorias, organograma |
| `@brunomouradev/themes` | — | Paletas fixas em CSS (opcional) |

**Índice**

1. [Instalação](#1-instalação)
2. [Primeiros passos (HTML, Angular, React, Vue)](#2-primeiros-passos)
3. [Configuração global, temas e customização](#3-configuração-global-temas-e-customização)
4. [DataGrid](#4-datagrid)
5. [PivotGrid](#5-pivotgrid)
6. [TreeList](#6-treelist)
7. [Motor de dados (sem DOM)](#7-motor-de-dados-sem-dom)
8. [Receitas](#8-receitas)
9. [Teclas de atalho](#9-teclas-de-atalho)
10. [Desenvolvimento e testes](#10-desenvolvimento-e-testes)
11. [Limitações conhecidas](#11-limitações-conhecidas)

---

## 1. Instalação

```bash
npm i @brunomouradev/data-grid
```

```bash
npm i @brunomouradev/pivot-grid @brunomouradev/tree-list
```

> **Versão do Node:** o projeto que **usa** os pacotes pode estar no Node 14 ou mais novo (a instalação e o build do Angular 11 com webpack 4 foram testados com Node 14.20).

**O que vem no pacote**
- JavaScript em **ES2019** (compatível com o webpack 4 do Angular 11), com o Lit embutido. Não precisa instalar mais nada.
- Tipos `.d.ts` compatíveis com **TypeScript 4.1+** (conferidos pelo `npm run check:compat`).
- O CSS fica dentro do componente: não há arquivo de estilo para importar.

Importar o pacote já registra a tag (`<bm-data-grid>` etc.). Para usar outro nome de tag: `defineDataGrid('minha-grid')`.

---

## 2. Primeiros passos

### HTML / JavaScript puro

```html
<bm-data-grid id="grid" key-expr="id" show-filter-row show-search-panel selection-mode="multiple" style="height: 600px"></bm-data-grid>

<script type="module">
  import '@brunomouradev/data-grid';

  const grid = document.getElementById('grid');
  grid.columns = [
    { dataField: 'id', caption: 'Nº', width: 80 },
    { dataField: 'cliente.nome', caption: 'Cliente' },
    { dataField: 'valor', caption: 'Valor', format: { style: 'currency', currency: 'BRL' } },
    { dataField: 'vencimento', caption: 'Vencimento', dataType: 'date', sortOrder: 'asc' },
  ];
  grid.dataSource = dados;
  grid.summary = [{ column: 'valor', summaryType: 'sum', displayFormat: 'Total: {0}' }];
  grid.addEventListener('selection-changed', (e) => console.log(e.detail.selectedRowsData));
</script>
```

**Regra geral para usar os componentes:**
- **Atributos** (`show-filter-row`, `key-expr="id"`) servem para configurações simples: textos e liga/desliga.
- **Propriedades** (`grid.columns = [...]`) servem para objetos, listas e funções.
- **Eventos** (`addEventListener('selection-changed', ...)`) servem para reagir ao usuário. Os dados vêm em `event.detail`.
- **Métodos** (`grid.exportToExcel()`) servem para comandar a grid pelo código.

### Angular (11+)

**1. Configuração global** (`main.ts`). Vale para todas as grids do sistema:

```ts
import { configure } from '@brunomouradev/data-grid';
configure({ theme: 'bootstrap4', locale: 'pt-BR' }); // currency: 'BRL' (opcional; padrão BRL no pt-BR)
```

**2. Liberar a tag no módulo** onde a grid é usada (ou no `SharedModule`):

```ts
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import '@brunomouradev/data-grid'; // registra <bm-data-grid>
import '@brunomouradev/tree-list'; // se usar
import '@brunomouradev/pivot-grid'; // se usar

@NgModule({
  declarations: [TitulosComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TitulosModule {}
```

**3. Componente** (`titulos.component.ts`):

```ts
import { Component, ElementRef, ViewChild } from '@angular/core';
import type { BmDataGrid, ColumnDef, SummaryItem } from '@brunomouradev/data-grid';

interface Titulo { id: number; cliente: string; tipo_titulo: number; vencimento: string; valor: number; }

@Component({ selector: 'app-titulos', templateUrl: './titulos.component.html' })
export class TitulosComponent {
  @ViewChild('grid') grid!: ElementRef<BmDataGrid<Titulo>>;

  titulos: Titulo[] = [];
  colunas: ColumnDef<Titulo>[] = [
    { dataField: 'id', caption: 'Nº', width: 80, fixed: true },
    { dataField: 'cliente', caption: 'Cliente', allowHiding: false },
    { dataField: 'vencimento', caption: 'Vencimento', dataType: 'date', sortOrder: 'asc' },
    { dataField: 'valor', caption: 'Valor', format: { style: 'currency', currency: 'BRL' } },
  ];
  totais: SummaryItem[] = [{ column: 'valor', summaryType: 'sum', displayFormat: 'Total: {0}' }];

  // funções como PROPRIEDADES (arrow function), não como métodos: mantêm o "this"
  classeLinha = (t: Titulo) => (t.tipo_titulo === 33 ? 'titulo-33' : '');

  ngOnInit() {
    this.service.listar().subscribe((dados) => (this.titulos = dados)); // array novo = grid atualiza
  }

  exportar() {
    this.grid.nativeElement.exportToExcel('titulos');
  }
}
```

**4. Template** (`titulos.component.html`):

```html
<bm-data-grid
  #grid
  key-expr="id"
  show-filter-row
  show-header-filter
  show-search-panel
  show-export-button
  column-chooser-enabled
  allow-column-reordering
  allow-column-resizing
  selection-mode="multiple"
  [dataSource]="titulos"
  [columns]="colunas"
  [summary]="totais"
  [rowClass]="classeLinha"
  [stateStoring]="{ storageKey: 'titulos-grid' }"
  (selection-changed)="selecionados = $event.detail.selectedRowsData"
  (row-dblclick)="abrir($event.detail.data)"
  style="height: 600px"
></bm-data-grid>
```

**5. CSS das regras de linha** (`styles.scss`). O Shadow DOM só deixa entrar estilo pelos *parts*:

```scss
bm-data-grid::part(titulo-33) { --bm-row-bg: #d1f4e0; color: #116329; }
```

> Quando você altera o array "por dentro" (`push`, `splice`), chame `grid.refresh()`. Atribuir um array novo atualiza sozinho.

### React

```tsx
import '@brunomouradev/data-grid';
import type { BmDataGrid } from '@brunomouradev/data-grid';

function Titulos({ dados }) {
  const ref = useRef<BmDataGrid>(null);
  useEffect(() => {
    ref.current!.columns = colunas;
    ref.current!.dataSource = dados;
    const onSel = (e: any) => console.log(e.detail);
    ref.current!.addEventListener('selection-changed', onSel);
    return () => ref.current?.removeEventListener('selection-changed', onSel);
  }, [dados]);
  return <bm-data-grid ref={ref} key-expr="id" show-filter-row style={{ height: 600 }} />;
}
```

### Vue 3

```vue
<template>
  <bm-data-grid key-expr="id" show-filter-row :dataSource.prop="dados" :columns.prop="colunas" @selection-changed="onSel" />
</template>
<script setup>
import '@brunomouradev/data-grid';
</script>
```

No `vite.config`: `vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('bm-') } } })`.

---

## 3. Configuração global, temas e customização

### `configure()`: uma vez para o sistema todo

```ts
import { configure } from '@brunomouradev/data-grid'; // também exportado pela pivot-grid e tree-list

configure({
  theme: 'bootstrap4',  // 'default' | 'bootstrap4' | 'bootstrap5' | 'tailwind' | 'material'
  appearance: 'light',  // 'light' | 'dark' | 'auto' (segue o sistema operacional)
  density: 'standard',  // 'compact' | 'standard' | 'comfortable'
  locale: 'pt-BR',
});
```

- Vale para todas as grids, pivots e trees da página, inclusive as que já estão na tela.
- O atributo no elemento vence o `configure`: `<bm-data-grid theme="material" appearance="dark" density="compact">`.
- `getConfig()` devolve a configuração atual.

### Temas

| Tema | Visual | De onde vêm as cores |
|---|---|---|
| `default` | neutro | fixas |
| `bootstrap4` | `.table .table-striped .thead-light` | `--primary` e `--font-family-sans-serif` do BS4; o resto é a paleta do BS4 |
| `bootstrap5` | `.table` do 5.3 | `--bs-*` (segue o `$primary` do projeto e o `data-bs-theme="dark"`) |
| `tailwind` | tabela do Tailwind UI | `--color-*`, `--font-sans`, `--radius-lg` (Tailwind 4); defina `--color-primary` para o destaque |
| `material` | tabela do Angular Material 3 | `--mat-sys-*` (segue o tema do Material, inclusive o escuro) |

**Densidade:**
- `compact` reduz o espaço vertical das células pela metade (parecido com `.table-sm`).
- `comfortable` aumenta o espaço em 50%.

### Variáveis CSS: customizar qualquer tema

As variáveis `--bm-*` sempre vencem o tema:

```css
bm-data-grid, bm-pivot-grid, bm-tree-list {
  --bm-color-primary: #e8590c;
}
```

| Variável | O que muda |
|---|---|
| `--bm-font-family`, `--bm-font-size` | fonte |
| `--bm-color-text`, `--bm-color-text-muted` | texto e texto secundário |
| `--bm-color-bg`, `--bm-color-bg-alt` | fundo e linhas alternadas |
| `--bm-color-bg-header`, `--bm-color-header-text`, `--bm-header-font-weight` | cabeçalho e rodapé |
| `--bm-color-bg-hover`, `--bm-color-bg-selected` | linha com o mouse e selecionada |
| `--bm-color-border` | bordas |
| `--bm-color-primary`, `--bm-color-primary-text`, `--bm-color-focus` | destaque, texto sobre o destaque, contorno de foco |
| `--bm-radius`, `--bm-shadow` | cantos e sombra dos menus |
| `--bm-cell-padding-y`, `--bm-cell-padding-x` | espaço das células |
| `--bm-row-bg` | fundo de uma linha (use em `::part(...)` das regras de linha) |

`themePalette('bootstrap5', 'dark')` devolve os valores de um tema, útil para montar o seu.

### CSS parts: mudar um pedaço específico

```css
bm-data-grid::part(header-cell) { text-transform: uppercase; letter-spacing: 0.02em; }
bm-data-grid::part(row-selected) { outline: 1px solid var(--bm-color-primary); }
```

As listas de parts de cada componente estão nas seções 4.9, 5.7 e 6.6.

### `cellStyles`: CSS do conteúdo das células

O conteúdo gerado por `cellRender` fica dentro do Shadow DOM, onde o CSS da página não chega. Passe o CSS por aqui:

```js
grid.cellStyles = `.badge { padding: 2px 8px; border-radius: 999px; } .badge.pago { background: #d1f4e0; }`;
```

### Templates de célula (`cellTemplate`): HTML do próprio framework

Para botões, dropdowns, badges ou barras de progresso, o mais simples é escrever a célula no HTML da tela.
A coluna recebe um nome em `cellTemplate` e a grid desenha a célula **fora do Shadow DOM**, num elemento
que vai para um `<slot>`. Por isso o CSS da página (Bootstrap, ícones) e os componentes do framework funcionam
sem `cellStyles`.

```ts
{ dataField: '__acoes', caption: 'Ações', fixed: true, cellTemplate: 'acoes', calculateCellValue: () => '' }
{ dataField: 'STATUS', caption: 'Status', cellTemplate: 'status' }
```

**Angular:** use a diretiva `bmCellTemplate` (código abaixo). `let-linha` é a linha; `let-valor="valor"` e
`let-coluna="coluna"` também existem.

```html
<bm-data-grid [dataSource]="dados" [columns]="colunas">
  <ng-template bmCellTemplate="acoes" let-linha>
    <div ngbDropdown container="body" class="d-inline-block">
      <button class="btn btn-outline-primary btn-sm" ngbDropdownToggle><i class="icofont-medical-sign"></i></button>
      <div ngbDropdownMenu>
        <button class="dropdown-item" (click)="abrirFicha(linha)">Abrir Ficha</button>
        <button class="dropdown-item" (click)="excluir(linha)">Excluir</button>
      </div>
    </div>
  </ng-template>

  <ng-template bmCellTemplate="status" let-valor="valor">
    <span class="badge" [ngClass]="valor === 'PAGO' ? 'badge-success' : 'badge-danger'">{{ valor }}</span>
  </ng-template>

  <ng-template bmCellTemplate="progresso" let-valor="valor">
    <div class="progress" style="height: 6px"><div class="progress-bar" [style.width.%]="valor"></div></div>
  </ng-template>
</bm-data-grid>
```

- Em dropdowns e tooltips, use `container="body"`: a célula corta o que passa da borda dela.
- O clique dentro do template também chega na linha (seleção, `row-click`). Use `$event.stopPropagation()` se não quiser isso.
- A grid só desenha os templates das linhas na tela (página atual ou trecho visível da rolagem virtual) e os destrói quando saem.

A diretiva não vem compilada no pacote (cada versão do Angular compila de um jeito). Copie este arquivo para o projeto
e declare/exporte as duas diretivas num módulo:

```ts
import { AfterContentInit, ContentChildren, Directive, ElementRef, Input, OnDestroy, QueryList, TemplateRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import type { CellTemplateContext } from '@brunomouradev/data-grid';

@Directive({ selector: 'ng-template[bmCellTemplate]' })
export class BmCellTemplateDirective {
  @Input('bmCellTemplate') nome!: string;
  constructor(public template: TemplateRef<any>) {}
}

@Directive({ selector: 'bm-data-grid' })
export class BmDataGridTemplatesDirective implements AfterContentInit, OnDestroy {
  @ContentChildren(BmCellTemplateDirective) templates!: QueryList<BmCellTemplateDirective>;
  private sub?: Subscription;
  constructor(private el: ElementRef<any>, private vcr: ViewContainerRef) {}

  ngAfterContentInit() { this.ligar(); this.sub = this.templates.changes.subscribe(() => this.ligar()); }
  ngOnDestroy() { this.sub?.unsubscribe(); }

  private ligar() {
    const mapa = new Map(this.templates.map((t) => [t.nome, t.template] as const));
    this.el.nativeElement.cellTemplateRenderer = !mapa.size ? undefined : (ctx: CellTemplateContext) => {
      const template = mapa.get(ctx.name);
      if (!template) return;
      const view = this.vcr.createEmbeddedView(template, { $implicit: ctx.row, linha: ctx.row, valor: ctx.value, coluna: ctx.column });
      view.rootNodes.forEach((n) => ctx.element.appendChild(n));
      view.detectChanges();
      return () => view.destroy();
    };
  }
}
```

**Outros frameworks / JS puro:** a grid chama `cellTemplateRenderer({ name, element, value, row, column })`
para cada célula. Preencha `element` e, se precisar, devolva uma função de limpeza:

```js
grid.cellTemplateRenderer = ({ name, element, row }) => {
  if (name !== 'acoes') return;
  element.innerHTML = '<button class="btn btn-sm btn-outline-primary">Abrir</button>';
  element.querySelector('button').onclick = () => abrir(row);
};
```

### Idioma e textos

- Os textos seguem o `locale`, que pode vir do `configure`, do `<html lang>` ou do navegador.
- Há traduções prontas em pt-BR e en.
- Para trocar qualquer texto, use `messages`:

```js
grid.messages = { noData: 'Nenhum título encontrado', export: 'Baixar' };
```

As chaves estão em `DataGridMessages`, `PivotGridMessages` e `TreeListMessages`. Os textos padrão estão em `messagesPt`/`messagesEn`, `pivotMessagesPt`/`pivotMessagesEn` e `treeListMessagesPt`/`treeListMessagesEn`.

---

## 4. DataGrid

`<bm-data-grid>`

### 4.1 Propriedades

#### Tudo num objeto: `options` (como o `dtOptions` do DataTables)

Qualquer propriedade da tabela abaixo (menos `dataSource`) pode ir num objeto `DataGridOptions`.
O HTML fica só com os dados, os eventos e os templates:

```html
<bm-data-grid [options]="opcoes" [dataSource]="dados" (row-dblclick)="abrir($event)"></bm-data-grid>
```

```ts
import type { DataGridOptions } from '@brunomouradev/data-grid';

opcoes: DataGridOptions = {
  theme: 'bootstrap4',
  locale: 'pt-BR',
  columns: [{ dataField: 'VALOR', caption: 'Valor', format: 'currency' }],
  paging: { pageSize: 50 },
  showFilterRow: true,
  exportFileName: 'relatorio',
};
```

Para um padrão do sistema, crie um arquivo com um objeto e espalhe nas telas:

```ts
// grid-padrao.ts
export const GRID_PADRAO: DataGridOptions = { theme: 'bootstrap4', locale: 'pt-BR', showHeaderFilter: true, showFilterRow: true };

// na tela
opcoes: DataGridOptions = { ...GRID_PADRAO, columns: [...], exportFileName: 'relatorio' };
```

- Trocar o objeto (`this.opcoes = { ...this.opcoes, paging: { pageSize: 100 } }`) aplica as chaves de novo. Alterar "por dentro" não avisa a grid.
- Não repita a mesma opção no `options` e no HTML: vale a última aplicada.
- `dataSource` fica fora porque muda a cada pesquisa.

| Propriedade | Atributo | Tipo | Padrão | O que faz |
|---|---|---|---|---|
| `dataSource` | — | `T[]` | `[]` | Os dados. Array novo atualiza; alteração "por dentro" pede `refresh()` |
| `columns` | — | `ColumnDef<T>[]` | gerado da 1ª linha | Definição das colunas (4.2) |
| `keyExpr` | `key-expr` | `string` | o próprio objeto | Campo que identifica a linha (seleção, estado) |
| `paging` | — | `PagingOptions` | `{ enabled: true, pageSize: 20 }` | `enabled`, `pageSize`, `pageIndex`, `allowedPageSizes`, `showPageSizeSelector`, `showInfo` |
| `selectionMode` | `selection-mode` | `'none' \| 'single' \| 'multiple'` | `none` | Seleção de linhas |
| `showFilterRow` | `show-filter-row` | `boolean` | `false` | Linha de filtro com operadores (4.5.3) |
| `showHeaderFilter` | `show-header-filter` | `boolean` | `false` | Funil no cabeçalho (lista de valores) |
| `showFilterPanel` | `show-filter-panel` | `boolean` | `false` | Barra com os filtros ativos, removíveis |
| `showSearchPanel` | `show-search-panel` | `boolean` | `false` | Busca em todas as colunas |
| `showGroupPanel` | `show-group-panel` | `boolean` | `false` | Painel "arraste um cabeçalho para agrupar" |
| `showExportButton` | `show-export-button` | `boolean` | `false` | Botão Exportar (Excel/CSV/selecionadas) |
| `exportFormats` | `export-formats` | `('xlsx'\|'csv')[]` | `['xlsx','csv']` | Formatos do botão (um só = botão sem menu) |
| `exportFileName` | `export-file-name` | `string` | `'dados'` | Nome do arquivo exportado |
| `exportSheetName` | `export-sheet-name` | `string` | `'Dados'` | Nome da aba no Excel |
| `columnChooserEnabled` | `column-chooser-enabled` | `boolean` | `false` | Botão "Colunas": mostrar/esconder, reordenar, fixar |
| `allowColumnReordering` | `allow-column-reordering` | `boolean` | `false` | Arrastar o cabeçalho para mudar a ordem |
| `allowColumnResizing` | `allow-column-resizing` | `boolean` | `false` | Arrastar a borda para mudar a largura; duplo clique ajusta |
| `columnLayout` | — | `ColumnLayoutItem[]` | colunas padrão | Layout salvo (ordem, visível, largura, fixa) |
| `grouping` | — | `GroupDescriptor[]` | `groupIndex` das colunas | Agrupamento salvo |
| `groupSummary` | — | `SummaryItem[]` | `[]` (mostra a quantidade) | Totais nas linhas de grupo |
| `autoExpandAll` | `auto-expand-all` | `boolean` | `true` | Grupos começam abertos (`="false"` para fechados) |
| `summary` | — | `SummaryItem[]` | `[]` | Totais do rodapé |
| `virtualScrolling` | `virtual-scrolling` | `boolean` | `false` | Rolagem virtual: tudo numa rolagem só, desenhando só o visível |
| `stateStoring` | — | `StateStoringOptions` | — | Salva e restaura o estado sozinho (4.5.12) |
| `remoteData` | — | `(o) => Promise<RemoteLoadResult>` | — | Dados do servidor (4.5.13) |
| `remoteHeaderFilter` | — | `(field, o) => Promise<any[]>` | — | Valores do funil vindos do servidor |
| `loading` | `loading` | `boolean` | `false` | Mostra o indicador de carregando |
| `rowClass` | — | `(row, index) => string \| string[]` | — | Classe/part da linha conforme os dados |
| `rowStyle` | — | `(row, index) => { css }` | — | Estilo da linha conforme os dados |
| `cellStyles` | — | `string` | `''` | CSS injetado no Shadow DOM (para `cellRender`) |
| `cellTemplateRenderer` | — | `(ctx) => void \| (() => void)` | — | Desenha as colunas com `cellTemplate` (no Angular, a diretiva `bmCellTemplate` preenche sozinha) |
| `showRowLines` | `show-row-lines` | `boolean` | `true` | Linhas entre as linhas |
| `showColumnLines` | `show-column-lines` | `boolean` | `false` | Linhas entre as colunas (no tema bootstrap4 fica igual ao `.table-bordered`) |
| `columnAutoWidth` | `column-auto-width` | `boolean` | `false` | Colunas do tamanho do conteúdo, sem cortar com "…" (como uma `<table>` comum). A largura da coluna ou a arrastada vira mínima |
| `rowAlternationEnabled` | `row-alternation-enabled` | `boolean` | `false` | Linhas alternadas (zebra) |
| `hoverStateDisabled` | `hover-state-disabled` | `boolean` | `false` | Desliga o destaque do mouse |
| `theme` / `appearance` / `density` | iguais | ver seção 3 | `configure()` | Visual |
| `locale` | `locale` | `string` | `configure()`/`<html lang>` | Números, datas e textos |
| `messages` | — | `Partial<DataGridMessages>` | — | Troca textos |
| `noDataText` | `no-data-text` | `string` | "Sem dados" | Texto da tabela vazia |

### 4.2 Colunas (`ColumnDef`)

| Campo | Tipo | O que faz |
|---|---|---|
| `dataField` | `string` | Campo do objeto; aceita caminho: `'cliente.nome'` |
| `caption` | `string` | Título (padrão: o nome do campo formatado) |
| `dataType` | `'string' \| 'number' \| 'date' \| 'boolean'` | Tipo (padrão: inferido; texto ISO vira data) |
| `format` | atalho | `Intl.NumberFormatOptions` | `Intl.DateTimeFormatOptions` | `(valor, linha) => string` | Atalhos: `'currency'`, `'number'`, `'integer'` (sem milhar), `'percent'` (12.5 → 12,5%), `'date'`, `'datetime'`, `'time'`. O atalho já define o tipo e o alinhamento. Ou opções do Intl: `{ style: 'currency', currency: 'EUR' }` |
| `width`, `minWidth` | `number \| string` / `number` | Largura (px) |
| `alignment` | `'left' \| 'center' \| 'right'` | Alinhamento (números à direita por padrão) |
| `visible` | `boolean` | `false` = coluna opcional, começa escondida |
| `visibleIndex` | `number` | Posição inicial |
| `fixed` | `boolean` | Fixa à esquerda (fica visível ao rolar para o lado) |
| `allowHiding`, `allowReordering`, `allowResizing` | `boolean` | Travar esconder, mover ou redimensionar |
| `showInColumnChooser` | `boolean` | `false` tira a coluna do seletor |
| `allowSorting`, `allowFiltering`, `allowSearch`, `allowGrouping`, `allowHeaderFiltering` | `boolean` | Desligar recursos na coluna |
| `sortOrder`, `sortIndex` | `'asc' \| 'desc'`, `number` | Ordenação inicial (várias colunas: `sortIndex`) |
| `groupIndex` | `number` | Agrupamento inicial (0 = primeiro nível) |
| `filterValue` | `any` | Filtro inicial da linha de filtro (ex.: `'>100'`) |
| `selectedFilterOperation` | `FilterOperation` | Operador padrão da linha de filtro |
| `filterValues`, `filterType` | `any[]`, `'include' \| 'exclude'` | Filtro inicial do funil |
| `calculateCellValue` | `(linha) => any` | Coluna calculada |
| `cellRender` | `(valor, linha) => texto \| HTMLElement \| TemplateResult` | Célula customizada |
| `cellTemplate` | `string` | Nome do template de célula do framework, ex.: `<ng-template bmCellTemplate="acoes">` (veja "Templates de célula") |
| `cssClass` | `string \| (valor, linha) => string` | Classe da célula; o nome também vira *part* |

### 4.3 Métodos

**Dados e linhas**

| Método | O que faz |
|---|---|
| `refresh()` | Reprocessa depois de alterar o array "por dentro" |
| `reload()` | Busca de novo no servidor (modo `remoteData`) |
| `getVisibleRows()` | Linhas da página atual |
| `getFilteredRows()` | Todas as linhas filtradas e ordenadas (todas as páginas) |
| `totalCount()`, `pageIndex()`, `pageCount()` | Contagens |
| `goToPage(i)` | Vai para a página `i` (0 = primeira) |
| `navigateToRow(key)` | Leva a linha até a tela (muda de página ou rola) |

**Seleção**

| Método | O que faz |
|---|---|
| `getSelectedRowKeys()`, `getSelectedRowsData()` | Linhas selecionadas |
| `selectRows(keys, preserve?)`, `deselectRows(keys)` | Selecionar/desmarcar por chave |
| `selectAll()`, `clearSelection()` | Tudo / nada (`selectAll` = as linhas filtradas) |

**Ordenação, filtros e busca**

| Método | O que faz |
|---|---|
| `sortBy([{ field, order }])`, `clearSorting()` | Ordenação (várias colunas) |
| `filterColumn(field, texto, operação?)` | Como digitar na linha de filtro: `filterColumn('valor', '>100')`, `filterColumn('venc', '05/2026')` |
| `searchByText(texto)` | Busca |
| `clearFilter()` | Limpa linha de filtro, funis e busca |
| `setHeaderFilter(field, valores \| null, 'include'\|'exclude')` | Funil por código: `setHeaderFilter('uf', ['PR','SC'])` |
| `getHeaderFilters()`, `setHeaderFilters(lista)`, `clearHeaderFilter(field?)` | Funis (salvar/restaurar) |
| `getHeaderFilterItems(field)` | Valores que aparecem na lista do funil |

**Colunas**

| Método | O que faz |
|---|---|
| `getColumnLayout()`, `setColumnLayout(layout)`, `resetColumnLayout()` | Layout (ordem, visível, largura, fixa) |
| `setColumnVisible(field, visível)` | Mostrar/esconder |
| `moveColumn(field, posição)` | Mover para a posição entre as visíveis |
| `setColumnWidth(field, px \| null)`, `autoFitColumn(field)` | Largura / ajustar ao conteúdo |
| `setColumnFixed(field, fixa)` | Fixar à esquerda |
| `showColumnChooser()`, `hideColumnChooser()` | Abrir/fechar o seletor |

**Agrupamento**

| Método | O que faz |
|---|---|
| `groupBy(field, nível?, ordem?)`, `ungroup(field)`, `clearGrouping()`, `getGrouping()` | Agrupar |
| `expandAll()`, `collapseAll()` | Abrir/fechar todos os grupos |

**Estado**

| Método | O que faz |
|---|---|
| `getState()` | Tudo o que o usuário mudou (`GridState`) |
| `setState(estado)` | Aplica (campos ausentes ficam como estão) |
| `resetState()` | Volta ao padrão e apaga o estado salvo |

**Exportar e copiar**

| Método | O que faz |
|---|---|
| `exportToExcel(nome?, { selectedOnly?, sheetName? })` | Baixa .xlsx (no modo servidor, busca todos os registros antes) |
| `getXlsx(opções?)` | Bytes do .xlsx (`Uint8Array`), para enviar ao servidor |
| `exportToCsv(nome?, opções?)`, `getCsv(separador?)` | CSV (UTF-8 com BOM, `;`) |
| `copySelection()` | Copia as linhas selecionadas (ou a célula com foco) em formato que cola no Excel |

### 4.4 Eventos

`grid.addEventListener('nome', (e) => e.detail)` / Angular: `(nome)="fn($event.detail)"`

| Evento | `detail` | Quando |
|---|---|---|
| `row-click` / `row-dblclick` | `{ data, key, rowIndex, originalEvent }` | Clique / duplo clique |
| `row-enter` | `{ data, key, rowIndex }` | Enter numa linha (teclado) |
| `selection-changed` | `{ selectedRowKeys, selectedRowsData }` | Seleção mudou |
| `state-changed` | `{ sorts, filters, headerFilters, searchText, pageIndex, pageSize }` | Ordenação, filtro, busca ou página |
| `column-layout-changed` | `{ layout }` | Colunas mudaram (ordem, visível, largura, fixa) |
| `grouping-changed` | `{ groups }` | Agrupamento mudou |
| `exporting` | `{ format, fileName, selectedOnly }` | Antes de baixar; mude `fileName` ou `preventDefault()` |
| `copy-rows` | `{ text, rowCount }` | Ctrl+C copiou |
| `content-ready` | `{ totalCount, pageIndex, pageCount }` | Dados processados |
| `load-error` | `{ error }` | Erro em `remoteData` |

### 4.5 Recursos (como e onde)

#### 4.5.1 Colunas: padrão, opcionais, ordem, largura, fixas
- **Colunas opcionais:** `visible: false` faz a coluna começar escondida. O usuário liga pelo botão **Colunas** (`column-chooser-enabled`).
- **Reordenar:** arraste o cabeçalho (`allow-column-reordering`) ou os itens do seletor.
- **Largura:** arraste a borda do cabeçalho (`allow-column-resizing`). O duplo clique na borda ajusta ao conteúdo.
  - Só a coluna arrastada ganha largura fixa. As colunas sem `width` dividem o espaço que sobra, com no mínimo `minWidth` (padrão 100px) cada. Quando não cabem, aparece a rolagem lateral.
  - Se todas as colunas tiverem largura, a última coluna não fixa estica para ocupar a tela. Assim a grid acompanha o tamanho da janela e não sobra espaço à direita.
- **Fixar:** use `fixed: true` na coluna ou o 📌 no seletor. Colunas fixas, seleção e recuo dos grupos ficam presos à esquerda ao rolar para o lado.
- **Salvar:** o layout vai em `column-layout-changed` / `columnLayout`, ou automático com `stateStoring`.
  - Colunas que sumiram do código são ignoradas.
  - Colunas novas entram na posição padrão.

#### 4.5.2 Ordenação
- Clique no cabeçalho alterna entre ▲, ▼ e sem ordem.
- **Shift+clique** ordena por mais de uma coluna.
- Inicial: `sortOrder`/`sortIndex`. Pelo código: `sortBy`.

#### 4.5.3 Linha de filtro (`show-filter-row`)
- Os campos não têm borda e ganham uma linha embaixo ao focar ou quando há filtro.
- O botão à esquerda abre o **menu de operadores**:
  - texto: contém, não contém, começa com, termina com, igual, diferente;
  - número e data: =, ≠, <, >, ≤, ≥, **entre**. "Entre" mostra os campos **de** e **até**.
- **Números:**
  - `>100`, `<=50`, `<>0`: o operador digitado vence o menu;
  - `10..50` = entre.
- **Datas por período:**
  - `2026` = o ano todo;
  - `05/2026` = o mês;
  - `10/05/2026` = o dia;
  - `>05/2026` = depois de maio;
  - `01/05/2026..15/05/2026` = intervalo.
  - Em `en-US` a ordem é mês/dia.
- Texto inválido deixa a linha do campo vermelha.
- O × limpa o campo.
- O operador escolhido entra no estado salvo (`filterOperations`).

#### 4.5.4 Funil no cabeçalho (`show-header-filter`)
- O funil mostra a lista dos valores da coluna, com a quantidade de linhas de cada um, busca e "Selecionar todos". Enter aplica e Esc fecha.
- A lista considera os outros filtros.
- Texto é comparado sem diferenciar maiúsculas e acentos; datas, pelo dia.
- Com menos valores desmarcados que marcados, o filtro grava como `exclude`, para valores novos continuarem aparecendo.

#### 4.5.5 Busca e barra de filtros
- `show-search-panel` procura o texto em todas as colunas visíveis, pelo valor formatado.
- `show-filter-panel` mostra os filtros ativos (ex.: "Valor entre 1000 – 2000", "Busca: Ana"), cada um com ×, mais "Limpar tudo".

#### 4.5.6 Paginação e rolagem virtual
- **Paginação:** `paging = { pageSize: 50, allowedPageSizes: [20, 50, 100] }`. O usuário também pode escolher "Todos".
- **Rolagem virtual** (`virtual-scrolling` + altura definida):
  - Sem páginas: desenha só ~30 linhas por vez.
  - Aguenta 100 mil linhas.
  - Funciona com filtro, ordenação, seleção, totais e agrupamento.

#### 4.5.7 Seleção
- `selection-mode="multiple"`:
  - caixas de marcação, com "Selecionar todos" no cabeçalho;
  - Ctrl+clique marca linhas soltas e Shift+clique marca um intervalo;
  - Espaço marca pelo teclado.
- **Com agrupamento:** a caixa da linha do grupo seleciona o grupo inteiro.

#### 4.5.8 Totais
```js
grid.summary = [
  { column: 'id', summaryType: 'count', displayFormat: '{0} títulos' },
  { column: 'valor', summaryType: 'sum', displayFormat: 'Total: {0}' },
  { column: 'vencimento', summaryType: 'min', displayFormat: 'Mais antigo: {0}' },
];
```

| Campo | O que faz |
|---|---|
| `summaryType` | `sum`, `avg`, `min`, `max` ou `count` |
| `showInColumn` | mostra embaixo de outra coluna |
| `valueFormat` | formato do número |
| `alignByColumn` | só em `groupSummary`: mostra o total na coluna, na linha do grupo |

O total é calculado sobre todas as linhas filtradas, não só a página.

**Espaço do rodapé (colspan automático):** cada total ocupa também as colunas vizinhas que não têm total, como um `colspan`. Assim "Total: R$ 2.521.018,87" fica numa linha só, mesmo em coluna estreita.
- Total alinhado à direita (números) cresce para a esquerda.
- Total alinhado à esquerda ou ao centro cresce para a direita.
- Colunas fixas não se juntam com outras. Para um total que fica numa coluna fixa estreita, use `showInColumn` para mostrá-lo em outra coluna.
- Cada total fica numa linha. Se mesmo assim não couber, ele é cortado com "…" e o texto completo aparece ao passar o mouse.
- Vale também para o TreeList. A função é `footerSpans` e está no motor.

#### 4.5.9 Agrupamento (`show-group-panel`)
- **Agrupar:** arraste cabeçalhos para o painel, em vários níveis.
- **No painel:**
  - clicar no grupo inverte a ordem;
  - arrastar troca o nível;
  - o × desagrupa;
  - arrastar o grupo de volta para o cabeçalho também desagrupa.
- **Linha do grupo:** clique para abrir ou fechar. O painel tem "Expandir tudo" e "Recolher tudo".
- **Totais por grupo:** use `groupSummary`.
- **Paginação:** conta as linhas de grupo, e um grupo que continua na página seguinte repete o título com "continuação".

#### 4.5.10 Linha e célula conforme os dados
```js
grid.rowStyle = (t) => (t.tipo_titulo === 33 ? { background: '#d1f4e0', color: '#116329' } : null); // sem CSS
grid.rowClass = (t) => (t.status === 'atrasado' ? 'atrasado' : '');                              // com CSS
// coluna: { dataField: 'valor', cssClass: (v) => (v < 0 ? 'negativo' : '') }
```
```css
bm-data-grid::part(atrasado) { --bm-row-bg: #ffe3e3; font-weight: 600; } /* --bm-row-bg vale também nas colunas fixas */
bm-data-grid::part(negativo) { color: #c92a2a; }
```
- A linha selecionada e a linha com o mouse por cima continuam visíveis por cima da cor da regra.
- Funciona com paginação, agrupamento e rolagem virtual.

#### 4.5.11 Exportar
O botão Exportar abre um menu com: Excel (.xlsx), CSV e "Excel, só as selecionadas (N)".

O Excel sai com:
- números e datas de verdade, no formato da coluna (R$, %, casas decimais);
- cabeçalho congelado e autofiltro;
- larguras ajustadas;
- grupos com tópicos do Excel (+/−);
- totais na última linha.

O arquivo é gerado no navegador, sem bibliotecas.

#### 4.5.12 Salvar o estado (`stateStoring`)
```js
grid.stateStoring = { storageKey: 'titulos-grid' };                     // localStorage
grid.stateStoring = { storageKey: 'x', type: 'sessionStorage' };
grid.stateStoring = {                                                   // no servidor
  type: 'custom',
  customLoad: () => api.get('/preferencias/titulos-grid'),
  customSave: (estado) => api.put('/preferencias/titulos-grid', estado),
};
```
- **O que é salvo:** colunas (ordem, visíveis, largura, fixas), ordenação, linha de filtro e operadores, funis, busca, agrupamento e tamanho da página.
- **Opcional:** `savePageIndex: true` e `saveSelection: true`.
- **Quando grava:** 300 ms depois de cada mudança (ajuste com `savingTimeout`).

#### 4.5.13 Dados do servidor (`remoteData`)
Para tabelas grandes, a grid pede só a página atual:

```ts
grid.remoteData = async (o) => {
  // o = { skip, take, sorts, filters, headerFilters, searchText, searchFields, signal }
  const r = await fetch('/api/titulos/buscar', { method: 'POST', body: JSON.stringify(o), signal: o.signal });
  return r.json(); // { data: Titulo[], totalCount: number, summary?: number[] }
};
```

| Campo | O que é |
|---|---|
| `skip` / `take` | página: pular / trazer (`take: 0` = todos, usado na exportação) |
| `sorts` | `[{ field, order }]` |
| `filters` | `[{ field, operation, value }]`. Operações: `contains notcontains startswith endswith = <> < <= > >= between notbetween`. Datas em `AAAA-MM-DD`; `between` usa `value: [de, até]` (um lado pode ser `null`) |
| `headerFilters` | `[{ field, type: 'include'\|'exclude', values }]`. Valores normalizados: texto minúsculo sem acento, data `AAAA-M-D` |
| `searchText` + `searchFields` | busca e colunas onde procurar |
| `signal` | é cancelado quando o usuário muda algo antes da resposta |

- O retorno `summary` é opcional: são os totais do rodapé, na ordem de `grid.summary`.
- Enquanto busca, aparece "Carregando…". Um erro mostra a mensagem e dispara `load-error`.
- `remoteHeaderFilter(field, o)` pode devolver os valores distintos da coluna para o funil.

**No servidor (C#/Java/Node):** traduza `filters` para `WHERE`, `sorts` para `ORDER BY` e `skip/take` para `OFFSET/FETCH`. Devolva `COUNT(*)` em `totalCount`.

### 4.6 Tipos exportados
`ColumnDef`, `ColumnLayoutItem`, `SortDescriptor`, `FilterDescriptor`, `FilterOperation`, `HeaderFilter`, `HeaderFilterItem`, `SummaryItem`, `PagingOptions`, `GroupDescriptor`, `GridState`, `StateStoringOptions`, `RemoteLoadOptions`, `RemoteLoadResult`, `RowStyle`, `ExportFormat`, `ExportOptions`, `ExportingDetail`, `RowEventDetail`, `SelectionChangedDetail`, `StateChangedDetail`, `ColumnLayoutChangedDetail`, `GroupingChangedDetail`, `ContentReadyDetail`, `DataGridMessages`, `BmConfig`, `ThemeName`, `Appearance`, `Density`.

### 4.7 Mensagens (`messages`)
Todas as chaves de `DataGridMessages`:

`noData`, `searchPlaceholder`, `filterPlaceholder`, `pageInfo` ("Página {0} de {1} ({2} itens)"), `pageSize`, `all`, `firstPage`, `prevPage`, `nextPage`, `lastPage`, `export`, `exportMenu`, `exportXlsxOnly`, `exportXlsx`, `exportCsv`, `exportSelected`, `clearFilters`, `columnChooser`, `resetColumns`, `dragToReorder`, `fixColumn`, `unfixColumn`, `resizeColumn`, `groupPanelHint`, `ungroup`, `expandAll`, `collapseAll`, `expandGroup`, `collapseGroup`, `groupItems`, `groupItem`, `groupContinued`, `groupEmpty`, `selectGroup`, `headerFilter`, `ok`, `cancel`, `noValues`, `loading`, `loadError`, `virtualInfo`, `selectAll`, `selectRow`, `copiedRows`, `copiedCell`, `filterOps` (nome de cada operador), `filterOperation`, `filterFrom`, `filterTo`, `datePlaceholder`, `filterPanelTitle`, `clearAll`, `searchChip`, `valuesCount`, `yes`, `no`, `sum`, `avg`, `min`, `max`, `count`.

### 4.8 Slot
`<div slot="toolbar">…</div>`: conteúdo seu na barra de ferramentas, à esquerda.

### 4.9 CSS parts
`grid`, `toolbar`, `search`, `scroller`, `header-row`, `header-cell`, `filter-row`, `row`, `row-selected`, `cell`, `summary-row`, `summary-cell`, `pager`, `no-data`, `column-chooser`, `column-chooser-button`, `group-panel`, `group-chip`, `group-row`, `header-filter`, `header-filter-button`, `filter-operation-menu`, `filter-panel`, `filter-chip`, `export-button`, `export-menu`, `loading`, mais os nomes devolvidos por `rowClass` e `cssClass`.

---

## 5. PivotGrid

`<bm-pivot-grid>`

```js
pivot.fields = [
  { dataField: 'regiao', caption: 'Região', area: 'row', expanded: true },
  { dataField: 'uf', caption: 'UF', area: 'row', topN: { count: 5 } },
  { dataField: 'data', caption: 'Ano', groupInterval: 'year', area: 'column' },
  { dataField: 'data', caption: 'Mês', groupInterval: 'month', area: 'column' },
  { dataField: 'valor', caption: 'Faturamento', area: 'data', summaryType: 'sum',
    format: { style: 'currency', currency: 'BRL' }, conditionalFormat: { type: 'dataBar' } },
  { dataField: 'categoria', area: 'filter' },
  { dataField: 'vendedor' }, // sem área: fica disponível no painel de campos
];
pivot.dataSource = vendas;
```

### 5.1 Propriedades

| Propriedade | Atributo | Padrão | O que faz |
|---|---|---|---|
| `dataSource` | — | `[]` | Registros |
| `fields` | — | `[]` | Campos e áreas (5.2) |
| `showFieldPanel` | `show-field-panel` | `false` | Painel para arrastar campos entre as áreas |
| `showExportButton` | `show-export-button` | `false` | Botão Exportar (Excel/CSV) |
| `exportFormats` | `export-formats` | `['xlsx','csv']` | Formatos do botão |
| `exportFileName` | `export-file-name` | `'pivot'` | Nome do arquivo |
| `showExpandButtons` | `show-expand-buttons` | `false` | "Expandir tudo" / "Recolher tudo" |
| `rowLayout` | `row-layout` | `'tree'` | `'tree'` (recuo) ou `'tabular'` (uma coluna por campo) |
| `showRowTotals` | — | `true` | Tabular: linha "X Total" abaixo dos grupos |
| `showRowGrandTotals` / `showColumnGrandTotals` | — | `true` | Total geral das linhas/colunas |
| `showColumnTotals` | — | `true` | Subtotal ao lado de cada grupo de colunas aberto |
| `allowFieldDragging` / `allowSorting` / `allowFiltering` | — | `true` | Liga/desliga interações |
| `rowHeaderWidth` | `row-header-width` | `220` | Largura (px) da coluna de cabeçalhos de linha |
| `theme`, `appearance`, `density`, `locale`, `messages` | — | — | Como na DataGrid |

### 5.2 Campos (`PivotField`)

| Campo | O que faz |
|---|---|
| `dataField` / `selector` | Campo do objeto / valor calculado `(linha) => valor` |
| `name` | Identificador (obrigatório se o mesmo `dataField` aparece duas vezes) |
| `caption` | Título |
| `area`, `areaIndex` | `'row' \| 'column' \| 'data' \| 'filter'` e posição |
| `dataType` | Tipo (padrão: inferido) |
| `groupInterval` | Datas: `'year' \| 'quarter' \| 'month' \| 'day' \| 'dayOfWeek'` |
| `summaryType` | Dados: `sum`, `avg`, `count`, `min`, `max` |
| `summaryDisplayMode` | Dados: como mostrar o valor (5.5) |
| `conditionalFormat` | Dados: cores ou barras (5.5) |
| `format` | Formato (`Intl`) |
| `sortOrder` | `asc`/`desc` dos valores do campo |
| `sortBySummaryField`, `sortBySummaryPath` | Ordenar os valores pelo total de um campo de dados (ex.: regiões por faturamento) |
| `topN` | Linha/coluna: `{ count, dataField?, bottom? }`, só os N maiores (os totais acompanham) |
| `expanded` | Grupos começam abertos |
| `filterValues`, `filterType` | Filtro (`include`/`exclude`) |
| `allowSorting`, `allowFiltering`, `allowDragging` | Travar interações no campo |

### 5.3 Métodos

| Método | O que faz |
|---|---|
| `refresh()` | Reprocessa |
| `getFields()` | Campos atuais (com as mudanças do usuário) |
| `updateField(nome, mudanças)` | Muda um campo: `updateField('valor', { summaryDisplayMode: 'percentOfGrandTotal' })` |
| `moveField(nome, área, posição?)` | Move entre áreas |
| `sortBySummary(campoDeDados \| null, caminho?, ordem?)` | Ordena as linhas pelo total (ou por uma coluna: `sortBySummary('valor', [2025])`) |
| `expandAll(área?)`, `collapseAll(área?)` | `'row' \| 'column' \| 'both'` |
| `drillDown(caminhoLinha, caminhoColuna)` | Registros por trás de uma célula |
| `exportToExcel(nome?)`, `getXlsx(aba?)` | Excel com cabeçalhos mesclados, números de verdade e totais em negrito |
| `exportToCsv(nome?)`, `getCsv(sep?)` | CSV do que está na tela |

### 5.4 Eventos

| Evento | `detail` |
|---|---|
| `cell-click`, `cell-dblclick` | `{ rowPath, columnPath, rowFields, columnFields, dataField, value, rowType, columnType, records?, originalEvent }`. `rowType`/`columnType`: `'value' \| 'total' \| 'grand'`. `records` (os registros da célula, drill-down) só vem no `cell-dblclick` |
| `fields-changed` | `{ fields }` (para salvar a configuração do usuário) |
| `content-ready` | — |

### 5.5 Mostrar valores como, cores e Top N
- **`summaryDisplayMode`.** Também há um seletor no chip do campo de dados, no painel de campos.

  | Modo | O que mostra |
  |---|---|
  | `absolute` | o valor |
  | `percentOfGrandTotal` | % do total geral |
  | `percentOfRowTotal` | % do total da linha |
  | `percentOfColumnTotal` | % do total da coluna |
  | `percentOfParentRow` | % do subtotal do grupo pai, nas linhas |
  | `percentOfParentColumn` | % do subtotal do grupo pai, nas colunas |
  | `differenceFromPrevious` | diferença em relação à coluna anterior, por exemplo o mês anterior |
  | `percentDifferenceFromPrevious` | % de diferença em relação à coluna anterior |
  | `runningTotal` | total acumulado da esquerda para a direita |
- **`conditionalFormat`** (não pinta os totais):
  - `{ type: 'colorScale', minColor?, midColor?, maxColor? }`: escala de cores;
  - `{ type: 'dataBar', color?, negativeColor? }`: barra proporcional;
  - `(valor, { rowPath, columnPath, isTotal, dataField }) => ({ color: 'red' })`: regra própria.
- **`topN: { count: 5 }`:** mostra só os 5 maiores pelo primeiro campo de dados.
  - `dataField` escolhe outro campo de dados.
  - `bottom: true` mostra os menores.
  - Os totais consideram só os que aparecem.

### 5.6 Mensagens
`PivotGridMessages`: `total`, `grandTotal`, `blank`, `noData`, `filterArea`, `columnArea`, `rowArea`, `dataArea`, `availableFields`, `dropHere`, `selectAll`, `search`, `ok`, `cancel`, `expandAll`, `collapseAll`, `export`, `exportMenu`, `exportXlsx`, `exportCsv`, `showValuesAs`, `displayModes`, `sortAsc`, `sortDesc`, `sortByColumn`, `filter`, `sum`, `avg`, `min`, `max`, `count`.

### 5.7 CSS parts
`pivot`, `toolbar`, `field-panel`, `field-zone`, `field-chip`, `scroller`, `column-header`, `row`, `row-header`, `cell`, `no-data`, `export-button`, `export-menu`.

---

## 6. TreeList

`<bm-tree-list>`: mesma aparência e temas da DataGrid, com hierarquia.

```js
tree.columns = [
  { dataField: 'nome', caption: 'Conta' },                        // a 1ª coluna mostra a árvore
  { dataField: 'orcado', caption: 'Orçado', dataType: 'number',
    format: { style: 'currency', currency: 'BRL' }, aggregate: 'sum' }, // pais mostram a soma dos filhos
];
tree.dataSource = contas; // [{ id, parentId, nome, orcado }, ...]
```

### 6.1 Estrutura dos dados
- **Lista plana** (padrão): `keyExpr="id"` e `parentIdExpr="parentId"`.
  - É raiz o item com pai `null`, `undefined` ou `''`, ou com um pai que não existe na lista.
  - Para outro valor de raiz, use `rootValue`.
- **Lista hierárquica:** `items-expr="items"` (cada item traz os filhos em `items`).
- **Ciclos** (A pai de B e B pai de A) não travam: o item vira raiz.

### 6.2 Propriedades

| Propriedade | Atributo | Padrão | O que faz |
|---|---|---|---|
| `dataSource` | — | `[]` | Dados (plano ou hierárquico) |
| `columns` | — | gerado | `TreeColumnDef[]` = `ColumnDef` + `aggregate` + `aggregateAlways` |
| `keyExpr` | `key-expr` | `'id'` | Chave |
| `parentIdExpr` | `parent-id-expr` | `'parentId'` | Campo do pai |
| `itemsExpr` | `items-expr` | — | Campo dos filhos (lista hierárquica) |
| `rootValue` | — | `null` | Valor de pai que indica raiz |
| `hasItemsExpr` | `has-items-expr` | — | Campo booleano "tem filhos a carregar" (sob demanda) |
| `loadChildren` | — | — | `(pai) => Promise<filhos[]>`: carrega ao abrir |
| `treeColumn` | `tree-column` | 1ª visível | Coluna que mostra o recuo e o botão |
| `autoExpandAll` | `auto-expand-all` | `false` | Começa tudo aberto |
| `expandedRowKeys` | — | — | Itens abertos no início |
| `selectionMode` | `selection-mode` | `none` | `none`/`single`/`multiple` |
| `recursiveSelection` | — | `true` | Seleção em cascata (pai ↔ filhos) |
| `showFilterRow`, `showSearchPanel`, `showExportButton`, `showExpandButtons` | iguais | `false` | Recursos |
| `summary` | — | `[]` | Totais do rodapé (sobre os itens filtrados) |
| `rowClass` | — | — | `(linha, nível) => classe` (vira *part*) |
| `exportFormats`, `exportFileName` | iguais | `['xlsx','csv']`, `'arvore'` | Exportação |
| `showRowLines`, `showColumnLines`, `rowAlternationEnabled`, `hoverStateDisabled` | iguais | | Visual |
| `theme`, `appearance`, `density`, `locale`, `messages`, `noDataText` | | | Como na DataGrid |

**Coluna com total dos filhos:**
- `aggregate: 'sum' | 'avg' | 'count' | 'min' | 'max'`: nos itens com filhos, mostra o total das folhas abaixo, quando o próprio item não tem valor. Com filtro, considera só os itens que aparecem.
- `aggregateAlways: true`: mostra o total sempre, mesmo quando o item tem valor próprio.

### 6.3 Métodos

| Método | O que faz |
|---|---|
| `expandRow(key)` (async), `collapseRow(key)`, `isRowExpanded(key)` | Abrir/fechar |
| `expandAll()`, `collapseAll()`, `getExpandedRowKeys()` | Todos |
| `navigateToRow(key)` | Abre os pais e rola até o item |
| `getNode(key)` | Nó: `{ key, data, level, parent, children, hasChildren }` |
| `getSelectedRowKeys()`, `getSelectedRowsData()`, `selectRows(keys, preserve?)`, `deselectRows(keys)`, `selectAll()`, `clearSelection()` | Seleção |
| `searchByText(t)`, `filterColumn(field, texto)`, `clearFilter()` | Busca/filtro (mantêm o caminho até o item encontrado) |
| `sortBy(sorts)`, `clearSorting()` | Ordena os irmãos de cada nível |
| `getVisibleRows()` | Dados das linhas exibidas |
| `exportToExcel(nome?)`, `getXlsx(aba?)` | Excel: níveis viram tópicos (+/−), totais dos filhos, números de verdade |
| `exportToCsv(nome?)`, `getCsv(sep?)` | CSV com recuo |
| `refresh()` | Reprocessa |

### 6.4 Eventos

| Evento | `detail` |
|---|---|
| `row-click`, `row-dblclick` | `{ data, key, level, hasChildren, originalEvent }` |
| `selection-changed` | `{ selectedRowKeys, selectedRowsData }` |
| `expanded-changed` | `{ expandedRowKeys }` |
| `content-ready` | `{ visibleCount, totalCount }` |

### 6.5 Teclado
No botão da árvore:
- **→** abre o item;
- **←** fecha o item ou volta para o pai;
- **Enter** ou **Espaço** alterna aberto/fechado.

### 6.6 CSS parts
`grid`, `toolbar`, `search`, `scroller`, `header-row`, `header-cell`, `filter-row`, `row`, `row-selected`, `cell`, `tree-cell`, `summary-row`, `summary-cell`, `no-data`, `export-button`, `export-menu`, mais os nomes devolvidos por `rowClass`.

### 6.7 Funções do motor da árvore
`buildTree(dados, opções)`, `sortTree`, `filterTree`, `flattenTree`, `descendants`, `toggleRecursive`, `checkState` e `rollupValues`, exportadas pelo pacote. Servem para usar a mesma lógica fora do componente (por exemplo, no servidor).

---

## 7. Motor de dados (sem DOM)

`@brunomouradev/data-grid/engine` não depende de Lit nem do navegador. Pode ser usado no Node, por exemplo para o servidor responder ao `remoteData` com a mesma lógica da grid:

```ts
import { query, resolveColumns, computeSummary } from '@brunomouradev/data-grid/engine';

const cols = resolveColumns(colunas, dados);
const r = query(dados, cols, { filters, headerFilters, searchText, sorts, pageIndex: skip / take, pageSize: take }, 'pt-BR');
return { data: r.pageRows, totalCount: r.totalCount };
```

| Grupo | Funções |
|---|---|
| Consulta | `query`, `applyFilters`, `applyHeaderFilters`, `applySearch`, `applySort`, `paginate`, `computeSummary` |
| Colunas | `resolveColumns`, `defaultColumnLayout`, `mergeColumnLayout`, `applyColumnLayout`, `setColumnVisibility`, `setColumnWidths`, `setColumnFixed`, `moveColumnBefore`, `moveColumnToVisibleIndex`, `sameColumnLayout`, `fixedFirst` |
| Filtro | `parseFilterInput(texto, tipo, operação?, locale?)`, `parseDatePeriod(texto, locale?)`, `parseLocaleNumber`, `foldText`, `headerFilterKey`, `headerFilterItems` |
| Agrupamento | `groupKey`, `groupSorts`, `buildGroups`, `flattenGroups`, `paginateItems`, `isGroupExpanded` |
| Valores | `getField`, `getCellValue`, `formatValue`, `toDate`, `toNumber`, `comparable`, `inferDataType`, `humanize` |
| Exportação | `toCsv`, `toXlsx` (da grid), `writeXlsx({ rows, merges, freezeRows, freezeCols, outlineLevels, colWidths })` (genérico), `excelDate`, `excelNumberFormat`, `columnLetter`, `XLSX_MIME`, `zipStore`, `unzipStore`, `crc32` |
| Temas | `configure`, `getConfig`, `THEMES`, `THEME_TOKENS`, `themeCss`, `themePalette`, `applyThemeAttributes`, `GRID_CSS` |

O motor da pivot é exportado pela própria pivot-grid: `buildCube`, `buildView`, `resolveFields`, `drillDown`, `pivotToCsv`, `pivotToXlsx`, `displayValue`, `formatDisplay`, `conditionalStats` e `conditionalStyle`.

---

## 8. Receitas

**Lista de títulos grande, vinda da API, com o layout do usuário salvo:**

```ts
// main.ts
configure({ theme: 'bootstrap4', locale: 'pt-BR', density: 'compact' });
```

```html
<bm-data-grid
  key-expr="id" show-filter-row show-header-filter show-filter-panel show-search-panel show-export-button
  column-chooser-enabled allow-column-reordering allow-column-resizing selection-mode="multiple"
  [columns]="colunas" [summary]="totais" [remoteData]="buscar" [stateStoring]="{ storageKey: 'grid-titulos' }"
  [rowClass]="classeLinha" (row-dblclick)="abrir($event.detail.data)" style="height: calc(100vh - 220px)"
></bm-data-grid>
```

```ts
buscar = (o: RemoteLoadOptions) => this.http.post<RemoteLoadResult<Titulo>>('/api/titulos/grid', o).toPromise();
classeLinha = (t: Titulo) => (t.tipo_titulo === 33 ? 'titulo-33' : t.diasAtraso > 30 ? 'atrasado' : '');
```

**Recebimentos por região × mês (pivot):**
```ts
pivot.fields = [
  { dataField: 'regiao', area: 'row' },
  { dataField: 'carteira', area: 'row' },
  { dataField: 'dataPagamento', groupInterval: 'month', area: 'column' },
  { dataField: 'valorPago', area: 'data', format: { style: 'currency', currency: 'BRL' }, conditionalFormat: { type: 'colorScale' } },
];
```

**Plano de contas / centros de custo (tree):** use `aggregate: 'sum'` nas colunas de valor, `selection-mode="multiple"` para a seleção em cascata e `loadChildren` se a árvore for grande.

---

## 9. Teclas de atalho

| Onde | Tecla | Ação |
|---|---|---|
| DataGrid (célula) | ← → ↑ ↓ | Mover entre células (↓ na última linha vai para a próxima página) |
| | Home / End | Primeira/última coluna (com Ctrl: primeira/última linha) |
| | PageUp / PageDown | Página anterior/seguinte (na rolagem virtual: uma tela) |
| | Espaço | Selecionar a linha |
| | Enter | Evento `row-enter` |
| | Ctrl+A | Selecionar tudo |
| | Ctrl+C | Copiar as linhas selecionadas (ou a célula) para colar no Excel |
| Cabeçalho | Enter / Espaço | Ordenar (Shift = várias colunas) |
| Menus e popups | ↑ ↓, Enter, Esc | Navegar, aplicar, fechar |
| TreeList | → / ← | Abrir / fechar (ou ir ao pai) |

---

## 10. Desenvolvimento e testes

Precisa do **Node 18+** (recomendado 20, veja `.nvmrc`). Com Node mais antigo, `dev`, `build`, `test` e `typecheck` param com uma mensagem explicando o que fazer (`scripts/check-node.cjs`). Projetos que **usam** os pacotes podem continuar no Node 14.

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências |
| `npm run dev` | Playground: http://localhost:5173 (DataGrid), `/pivot.html` (PivotGrid) e `/tree.html` (TreeList) |
| `npm test` | Testes dos motores (vitest), por pacote |
| `npm run typecheck` | Checagem de tipos |
| `npm run build` | Gera `packages/*/dist` (ES2019 + UMD + `.d.ts`) |
| `npm run check:compat` | Depois do build: confere que os tipos abrem no TypeScript 4.1 (Angular 11) |

**Estrutura**
```
packages/
  data-grid/   src/engine (motor sem DOM, temas, CSS, Excel) · src/data-grid.ts (componente) · test/
  pivot-grid/  src/engine (cubo, view, exibição, Excel) · src/pivot-grid.ts · test/
  tree-list/   src/engine/tree.ts · src/tree-list.ts · test/
  themes/      paletas fixas (opcional)
playground/    páginas de demonstração (código-fonte dos pacotes, com recarga automática)
compat/ts41/   projeto mínimo compilado com TypeScript 4.1
```

---

## 11. Limitações conhecidas

**DataGrid**
- **Busca com muitos dados:** leva ~1 s em 100 mil linhas, porque formata todas as colunas.
- **Rolagem virtual:**
  - as linhas precisam ter a mesma altura;
  - o limite prático é ~400 mil linhas, por causa do limite de altura do navegador;
  - não funciona junto com `remoteData`.
- **`remoteData`:**
  - o agrupamento vale só para a página carregada;
  - sem `remoteHeaderFilter`, o funil mostra só os valores da página;
  - `selectAll` seleciona a página carregada.
- **Larguras:** quando todas as colunas têm largura, a última coluna não fixa estica para ocupar a tela. Diminuir a largura dela só tem efeito quando a tabela é mais larga que a tela.
- **Exportação para Excel:** o arquivo não é comprimido (~400 KB para 1.000 linhas).
- **Linhas coloridas com colunas fixas:** use `--bm-row-bg` no `::part`; `background` não chega às colunas fixas.

**PivotGrid**
- O Top N e os modos de exibição consideram os campos de dados da própria pivot (sem campos calculados entre si).

**TreeList**
- O carregamento sob demanda (`loadChildren`) funciona com lista plana.
- Não tem paginação nem rolagem virtual: para árvores muito grandes, use o carregamento sob demanda.

**Angular**
- Com `CUSTOM_ELEMENTS_SCHEMA`, o template não tem autocomplete nem checagem dos atributos. Um wrapper Angular resolveria isso; é um próximo passo possível.
