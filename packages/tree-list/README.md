# @brunomouradev/tree-list

Tabela em árvore (Web Component `<bm-tree-list>`, estilo DevExpress) para dados hierárquicos: plano de contas, centros de custo, categorias, organograma. Funciona em Angular (11+), React, Vue ou HTML puro.

> Documentação completa (todas as propriedades, métodos e eventos): [DOCUMENTACAO.md](../../DOCUMENTACAO.md#6-treelist)

## Recursos

- Lista plana (`id` + `parentId`) ou hierárquica (`items`)
- Expandir/recolher (botões, teclado ← →, "Expandir tudo")
- Ordenação por nível, filtro por coluna e busca, mantendo o caminho até o item encontrado
- Seleção em cascata (marcar o pai marca os filhos; pai indeterminado)
- Total dos filhos nas linhas-pai (`aggregate: 'sum'`)
- Carregamento sob demanda (`loadChildren`)
- Totais no rodapé, regras de linha (`rowClass`), temas Bootstrap/Tailwind/Material
- Exportação Excel (níveis viram tópicos do Excel) e CSV

## Uso

```html
<bm-tree-list id="contas" show-search-panel show-export-button selection-mode="multiple" style="height: 600px"></bm-tree-list>
<script type="module">
  import '@brunomouradev/tree-list';
  const tree = document.getElementById('contas');
  tree.columns = [
    { dataField: 'nome', caption: 'Conta' },
    { dataField: 'valor', caption: 'Valor', dataType: 'number', format: { style: 'currency', currency: 'BRL' }, aggregate: 'sum' },
  ];
  tree.dataSource = [
    { id: 1, parentId: null, nome: 'Receitas' },
    { id: 2, parentId: 1, nome: 'Vendas', valor: 1000 },
  ];
  tree.expandedRowKeys = [1];
</script>
```

No Angular: `CUSTOM_ELEMENTS_SCHEMA` no módulo, `import '@brunomouradev/tree-list'` e `[dataSource]`, `[columns]`, `(selection-changed)` no template.
