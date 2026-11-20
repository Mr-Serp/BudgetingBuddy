function reportTable(headers, rows, widths, numericColumns) {
  const cells = rows.map(row => row.map((text, index) => ({
    text,
    alignment: numericColumns.includes(index) ? 'right' : 'left'
  })));
  return {
    margin: [0, 0, 0, 10],
    layout: {
      hLineWidth: (index, table) => index === 0 || index === table.table.body.length ? 0 : 0.5,
      hLineColor: () => '#d4dbe2',
      vLineWidth: () => 0,
      paddingTop: () => 7,
      paddingBottom: () => 7,
      paddingLeft: () => 7,
      paddingRight: () => 7,
      fillColor: index => index === 0 ? '#eef2f5' : null
    },
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths,
      body: [
        headers.map((text, index) => ({
          text, bold: true, alignment: numericColumns.includes(index) ? 'right' : 'left'
        })),
        ...cells
      ]
    }
  };
}

function createExpenseReport({totals, accounts, expenses, period, ytd}) {
  const section = text => ({text, style: 'section', headlineLevel: 1});
  const empty = text => ({text, color: '#475569', margin: [0, 0, 0, 10]});
  const expenseTable = reportTable(
    ['Expense', 'Paid from', 'Monthly amount'],
    expenses.map(item => [item.label, item.account, item.amount]),
    ['*', '*', 100], [2]
  );
  if (expenses.length) {
    expenseTable.table.body.push([
      {text: 'Total monthly expenses', bold: true, colSpan: 2}, {},
      {text: totals.expense, alignment: 'right', bold: true}
    ]);
  }
  return {
    info: {title: 'Monthly financial summary', author: 'Budgeting Buddy'},
    pageSize: 'LETTER',
    pageMargins: [44, 46, 44, 48],
    defaultStyle: {font: 'Roboto', fontSize: 10, color: '#172331'},
    styles: {
      section: {fontSize: 14, bold: true, margin: [0, 15, 0, 6]}
    },
    pageBreakBefore: (currentNode, followingNodesOnPage) =>
      currentNode.headlineLevel === 1 && followingNodesOnPage.length === 0,
    footer: (page, pages) => ({
      columns: [{text: 'Budgeting Buddy'}, {text: page + ' / ' + pages, alignment: 'right'}],
      margin: [44, 12, 44, 0], color: '#475569', fontSize: 9
    }),
    content: [
      {text: 'Monthly financial summary', fontSize: 26, bold: true},
      {text: period + '  •  Planned amounts in USD', color: '#475569', margin: [0, 5, 0, 9]},
      section('Monthly overview'),
      reportTable(
        ['Income', 'Expenses', 'Investments', 'Remainder'],
        [[totals.income, totals.expense, totals.investment, totals.net]],
        ['*', '*', '*', '*'], [0, 1, 2, 3]
      ),
      section('Itemized expenses'),
      expenses.length ? expenseTable : empty('No expense nodes in this plan.'),
      section('Account breakdown'),
      accounts.length ? reportTable(
        ['Account', 'Income', 'Expenses', 'Investments', 'Net transfers', 'Remainder'],
        accounts.map(item => [item.label, item.income, item.expense, item.investment, item.netTransfers, item.net]),
        ['*', 69, 69, 69, 69, 69], [1, 2, 3, 4, 5]
      ) : empty('No account flows to show.'),
      section('Year-to-date account totals'),
      ytd.length ? reportTable(['Account','Planned net'],ytd,['*',120],[1]) : empty('No account flow for this period.')
    ]
  };
}
