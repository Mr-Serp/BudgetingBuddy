const icons = {income:'↙',account:'▤',expense:'↗',investment:'◈'};
const titles = {income:'Income',account:'Account',expense:'Expense',investment:'Investment'};
initializeBudget();
let selectedMonth = monthFromUrl();
let nodes = monthPlan(selectedMonth);
let accountRollup;
let scale, activeId, removalPending, lastScale;
const viewport = byId('viewport'), surface = byId('surface'), canvas = byId('edges');
const nodeLayer = byId('nodes'), listView = byId('listView'), editor = byId('editor');
const form = byId('form'), fields = form.elements;
const nodeWidth = 214, nodeHeight = 78;
const accountFor = node => nodes.find(account => account.id === node.account && account.type === 'account');
let flows;
const totalsFor = id => id === undefined ? flows.overall : flows.totals.get(id) ?? flows.unassigned;
const plannedAmount = node => flows.amounts.get(node.id);
const hasUnassigned = () => ['income','expense','investment'].some(type => flows.unassigned[type])
  || nodes.some(node => node.type === 'investment' && node.investmentShare !== undefined && !accountFor(node));
function connectionLabel(node) {
  if (node.type !== 'income') {
    const account = accountFor(node)?.label ?? 'Unassigned';
    return node.investmentShare === undefined ? account : account + ' · ' + allocationPercent(node.investmentShare);
  }
  const links = allocationsFor(node);
  return links.length ? links.map(link => {
    const account = nodes.find(n => n.id === link.target);
    return (account?.label ?? 'Unassigned') + ' ' + allocationPercent(link.share);
  }).join(', ') : 'Unassigned';
}
function save() {
  try {
    saveMonthPlan(selectedMonth,nodes);
    byId('status').textContent = '● Saved on this device';
  } catch {
    byId('status').textContent = 'Changes could not be saved';
  }
}
function bounds() {
  return {
    width: Math.max(1060, ...nodes.map(n => n.x + nodeWidth + 55)),
    height: Math.max(427, ...nodes.map(n => n.y + nodeHeight + 20))
  };
}
function draw() {
  const {width,height} = bounds();
  const zoom = scale ?? Math.min(viewport.clientWidth / width, 1.18);
  const ratio = window.devicePixelRatio || 1;
  lastScale = zoom;
  surface.style.width = width * zoom + 'px';
  surface.style.height = height * zoom + 'px';
  nodeLayer.style.transform = 'scale(' + zoom + ')';
  nodeLayer.style.transformOrigin = 'top left';
  canvas.style.width = width * zoom + 'px';
  canvas.style.height = height * zoom + 'px';
  canvas.width = Math.ceil(width * zoom * ratio);
  canvas.height = Math.ceil(height * zoom * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(zoom * ratio, zoom * ratio);
  for (const {source,target,type,share,cents} of flows.edges) {
    const sx = source.x + nodeWidth, sy = source.y + nodeHeight / 2;
    const tx = target.x - 8, ty = target.y + nodeHeight / 2;
    const bend = Math.max(42, Math.abs(tx - sx) * .53);
    const color = getComputedStyle(document.documentElement).getPropertyValue({income:'--green',expense:'--pink',investment:'--purple',account:'--blue'}[type]).trim();
    ctx.strokeStyle = color;
    ctx.globalAlpha = .64;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(sx,sy);
    ctx.bezierCurveTo(sx + bend,sy,tx - bend,ty,tx,ty);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx,ty);
    ctx.lineTo(tx - 7,ty - 3.5);
    ctx.lineTo(tx - 7,ty + 3.5);
    ctx.fill();
    if (share !== undefined && (type !== 'income' || share !== fullAllocation)) {
      const label = allocationPercent(share) + ' · ' + money(cents);
      const x = (sx + tx) / 2, y = (sy + ty) / 2;
      ctx.font = '600 12px system-ui';
      const labelWidth = ctx.measureText(label).width + 12;
      ctx.fillStyle = '#0d1520';
      ctx.fillRect(x - labelWidth / 2,y - 12,labelWidth,24);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(label,x,y);
    }
  }
  drawConnectionDraft(ctx, zoom);
  byId('fit').textContent = Math.round(zoom * 100) + '%';
}
function render() {
  flows = calculateFlows(nodes);
  byId('clear-map').disabled = nodes.length === 0;
  renderMonthSummary();
  const totals = totalsFor();
  for (const name of ['income','expense','investment','net']) byId(name).textContent = money(totals[name]);
  byId('count').textContent = nodes.length + (nodes.length === 1 ? ' node' : ' nodes');
  nodeLayer.replaceChildren();
  listView.replaceChildren();
  if (!nodes.length) {
    for (const layer of [nodeLayer,listView]) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Add a node to start mapping your cash flow.';
      layer.append(empty);
    }
  }
  for (const node of nodes) {
    const value = money(node.type === 'account' ? totalsFor(node.id).net : plannedAmount(node));
    const button = document.createElement('button');
    const card = document.createElement('div');
    card.className = 'node-shell ' + node.type;
    card.dataset.nodeId = node.id;
    card.style.left = node.x + 'px';
    card.style.top = node.y + 'px';
    button.className = 'node ' + node.type;
    button.innerHTML = '<span class="badge" aria-hidden="true"></span><span class="info"><strong></strong><small></small></span>';
    button.querySelector('.badge').textContent = icons[node.type];
    button.querySelector('strong').textContent = node.label;
    button.querySelector('small').textContent = value + (node.type === 'account' ? ' net / mo' : ' / mo')
      + (node.investmentShare === undefined ? '' : ' · ' + allocationPercent(node.investmentShare));
    button.title = titles[node.type] + ' · ' + node.label;
    let drag, moved = false;
    button.onpointerdown = event => {
      if (event.button !== 0) return;
      moved = false;
      drag = {x:event.clientX,y:event.clientY,left:node.x,top:node.y};
      button.setPointerCapture(event.pointerId);
    };
    button.onpointermove = event => {
      if (!drag) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!moved && Math.hypot(dx,dy) < 5) return;
      moved = true;
      scale = lastScale;
      node.x = Math.max(0, Math.round(drag.left + dx / scale));
      node.y = Math.max(0, Math.round(drag.top + dy / scale));
      card.style.left = node.x + 'px';
      card.style.top = node.y + 'px';
      draw();
    };
    button.onlostpointercapture = () => { if (drag && moved) save(); drag = null; };
    button.onclick = event => { if (!moved || !event.detail) openEditor(node); };
    card.append(button);
    if (node.type !== 'income') {
      const inlet = document.createElement('span');
      inlet.className = 'node-inlet';
      inlet.setAttribute('aria-hidden','true');
      card.append(inlet);
    }
    if (node.type === 'income' || node.type === 'account') {
      const outlet = document.createElement('button');
      outlet.type = 'button';
      outlet.className = 'node-outlet';
      outlet.setAttribute('aria-label','Edit outgoing connections for ' + node.label);
      outlet.title = 'Drag to connect or click to edit';
      outlet.onpointerdown = event => beginConnectionDrag(event,node);
      outlet.onclick = event => {
        if (!outlet.dataset.dragged || !event.detail) openConnections(node);
      };
      card.append(outlet);
    }
    nodeLayer.append(card);
    const row = document.createElement('button');
    row.className = 'row';
    const connection = node.type === 'account' ? 'Monthly net' : connectionLabel(node);
    for (const text of [node.label, titles[node.type] + ' · ' + connection, value]) {
      const span = document.createElement('span');
      span.textContent = text;
      row.append(span);
    }
    row.onclick = () => openEditor(node);
    listView.append(row);
  }
  if (!viewport.hidden) draw();
}
function updateFields() {
  const type = fields.type.value;
  const isAccount = type === 'account';
  const splitIncome = type === 'income' && nodes.find(n => n.id === activeId)?.allocations !== undefined;
  const isInvestment = type === 'investment';
  const isPercent = isInvestment && fields.fundingMode.value === 'percent';
  byId('fundingModeLabel').hidden = fields.fundingMode.disabled = !isInvestment;
  byId('investmentShareLabel').hidden = fields.investmentShare.disabled = !isPercent;
  byId('amountLabel').hidden = fields.amount.disabled = isAccount || isPercent;
  byId('accountLabel').hidden = fields.account.disabled = isAccount || splitIncome;
  byId('direction').textContent = type === 'income' ? 'Deposits into' : 'Paid from';
  byId('help').textContent = isAccount ? 'The account shows its monthly net flow.' : splitIncome ? 'Use the right circle to edit percentage allocations.' : isPercent ? 'Percentage investments use available funds after expenses and fixed investments, before transfers out.' : 'Choose an account to connect this node on the map.';
}
function openEditor(node, fundingAccount) {
  activeId = node?.id;
  removalPending = false;
  byId('dialogTitle').textContent = fundingAccount ? 'Fund investment' : node ? 'Edit node' : 'Add node';
  byId('remove').hidden = !node;
  byId('remove').textContent = 'Delete node';
  fields.type.value = node?.type ?? 'expense';
  fields.type.disabled = !!node;
  fields.label.value = node?.label ?? '';
  fields.amount.value = node?.amount === undefined ? '0' : (node.amount / 100).toFixed(2);
  fields.account.replaceChildren(new Option('Unassigned',''));
  for (const account of nodes.filter(n => n.type === 'account')) fields.account.add(new Option(account.label,account.id));
  fields.account.value = fundingAccount?.id ?? node?.account ?? (node ? '' : fields.account.options[1]?.value ?? '');
  fields.fundingMode.value = node?.investmentShare === undefined ? 'fixed' : 'percent';
  fields.investmentShare.value = node?.investmentShare === undefined ? '10' : node.investmentShare / 100;
  fields.account.setCustomValidity('');
  fields.investmentShare.setCustomValidity('');
  fields.label.setCustomValidity('');
  updateFields();
  byId('node-connections').hidden = !node || !['income','account'].includes(node.type);
  byId('node-connections').onclick = () => { editor.close(); openConnections(node); };
  editor.showModal();
  (fundingAccount ? fields.fundingMode : fields.label).focus();
}
fields.type.onchange = () => {
  fields.account.setCustomValidity('');
  fields.investmentShare.setCustomValidity('');
  updateFields();
};
fields.fundingMode.onchange = () => {
  fields.account.setCustomValidity('');
  fields.investmentShare.setCustomValidity('');
  updateFields();
};
fields.account.onchange = () => {
  fields.account.setCustomValidity('');
  fields.investmentShare.setCustomValidity('');
};
fields.investmentShare.oninput = () => fields.investmentShare.setCustomValidity('');
fields.label.oninput = () => fields.label.setCustomValidity('');
byId('add').onclick = () => openEditor();
byId('close').onclick = () => editor.close();
form.onsubmit = event => {
  event.preventDefault();
  const label = fields.label.value.trim();
  if (!label) {
    fields.label.setCustomValidity('Enter a node name.');
    fields.label.reportValidity();
    return;
  }
  const type = fields.type.value;
  const existing = nodes.find(n => n.id === activeId);
  const percent = type === 'investment' && fields.fundingMode.value === 'percent';
  const share = percent ? Math.round(fields.investmentShare.valueAsNumber * 100) : undefined;
  if (percent && !fields.account.value) {
    fields.account.setCustomValidity('Choose an account for this percentage investment.');
    fields.account.reportValidity();
    return;
  }
  if (percent) {
    const used = nodes.filter(n => n.id !== activeId && n.account === fields.account.value)
      .reduce((sum,n) => sum + (n.investmentShare ?? 0),0);
    if (used + share > fullAllocation) {
      fields.investmentShare.setCustomValidity('This account has ' + allocationPercent(fullAllocation - used) + ' available for percentage investments.');
      fields.investmentShare.reportValidity();
      return;
    }
  }
  const node = existing ?? {id:crypto.randomUUID(),type,...positionFor(type, nodes)};
  node.label = label;
  if (type !== 'account') {
    if (percent) node.investmentShare = share;
    else delete node.investmentShare;
    node.amount = Math.round(Number(fields.amount.value) * 100);
    if (!fields.account.disabled) node.account = fields.account.value;
  }
  if (!existing) nodes.push(node);
  save();
  editor.close();
  render();
};
byId('remove').onclick = () => {
  if (!removalPending) {
    removalPending = true;
    byId('remove').textContent = 'Confirm delete';
    byId('help').textContent = fields.type.value === 'account'
      ? 'Deleting this account leaves its connected nodes unassigned.'
      : 'Confirm to delete this node from your plan.';
    return;
  }
  nodes = nodes.filter(n => n.id !== activeId);
  for (const node of nodes) {
    if (node.account === activeId) node.account = '';
    if (node.allocations) node.allocations = node.allocations.filter(link => link.target !== activeId);
  }
  save();
  editor.close();
  render();
};
const clearMapDialog = byId('clear-map-dialog');
byId('clear-map').onclick = () => {
  byId('clear-map-description').textContent = 'Remove all nodes and connections for ' + monthLabel(selectedMonth) + '?';
  byId('clear-map-error').textContent = '';
  clearMapDialog.showModal();
};
byId('cancel-clear-map').onclick = () => clearMapDialog.close();
byId('clear-map-form').onsubmit = event => {
  event.preventDefault();
  try {
    clearMonthPlan(selectedMonth);
  } catch {
    byId('clear-map-error').textContent = 'Could not save the change on this device. Please try again.';
    return;
  }
  nodes = [];
  byId('status').textContent = '● Saved on this device';
  clearMapDialog.close();
  render();
  byId('connection-status').textContent = 'Flow Map cleared for ' + monthLabel(selectedMonth) + '.';
  byId('add').focus();
};

function setView(isMap) {
  byId('clear-map').hidden = !isMap;
  viewport.hidden = byId('zoom').hidden = !isMap;
  listView.hidden = isMap;
  byId('map').setAttribute('aria-pressed', isMap);
  byId('list').setAttribute('aria-pressed', !isMap);
  if (isMap) draw();
}
byId('map').onclick = () => setView(true);
byId('list').onclick = () => setView(false);
byId('fit').onclick = () => { scale = undefined; viewport.scrollTo(0,0); draw(); };
byId('out').onclick = () => { scale = Math.max(.2,lastScale / 1.25); draw(); };
byId('in').onclick = () => { scale = Math.min(2,lastScale * 1.25); draw(); };
function renderMonthSummary() {
  const budget = readBudget();
  accountRollup = yearToDateAccounts(selectedMonth,{
    ...budget, months:{...budget.months,[selectedMonth]:nodes}
  });
  const label = monthLabel(selectedMonth);
  byId('budget-month').textContent = label;
  byId('budget-month').dateTime = selectedMonth;
  byId('prev-month').disabled = selectedMonth === '1000-01';
  byId('next-month').disabled = selectedMonth === '9999-12';
  byId('credit-link').href = 'credit.html?month=' + selectedMonth;
  const saved = Object.hasOwn(budget.months,selectedMonth);
  byId('month-note').textContent = saved ? 'USD · Changes apply to this month'
    : selectedMonth < budget.start ? 'USD · No prior plan for this month'
      : 'USD · Starting from the last saved plan. Edit to save this month.';
  byId('account-period').textContent = 'Planned net through ' + label + '. Year-to-date totals reset in January.';
  const body = byId('account-rollup-body');
  body.replaceChildren();
  for (const [id,account] of accountRollup) {
    const row = body.insertRow();
    for (const value of [account.label,money(flows.totals.get(id)?.net ?? 0),money(account.net)]) {
      row.insertCell().textContent = value;
    }
  }
  if (!accountRollup.size) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = 3;
    cell.textContent = 'No account flow for this period.';
  }
}

function changeMonth(delta) {
  selectedMonth = shiftMonth(selectedMonth,delta);
  const url = new URL(location.href);
  url.searchParams.set('month',selectedMonth);
  history.replaceState(null,'',url);
  nodes = monthPlan(selectedMonth);
  byId('connection-status').textContent = '';
  byId('report-status').textContent = '';
  render();
}
byId('prev-month').onclick = () => changeMonth(-1);
byId('next-month').onclick = () => changeMonth(1);
new ResizeObserver(() => { if (!viewport.hidden) draw(); }).observe(viewport);
render();
window.addEventListener('storage', event => {
  if (event.key !== budgetKey && event.key !== null) return;
  if (editor.open) editor.close();
  if (byId('connection-editor').open) byId('connection-editor').close();
  if (clearMapDialog.open) clearMapDialog.close();
  nodes = monthPlan(selectedMonth);
  render();
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  nodes = monthPlan(selectedMonth);
  render();
});

function downloadPlan() {
  const summary = [['Account', 'Income (USD)', 'Expenses (USD)', 'Investments (USD)', 'Net transfers (USD)', 'Remainder (USD)', 'Year-to-date net (USD)']];
  function addSummary(label, totals, ytd = null) {
    summary.push([label, totals.income / 100, totals.expense / 100, totals.investment / 100, (totals.transfersIn - totals.transfersOut) / 100, totals.net / 100, ytd === null ? null : ytd / 100]);
  }
  addSummary('Entire plan', totalsFor());
  for (const [id, account] of accountRollup) {
    addSummary(account.label, flows.totals.get(id) ?? {income:0,expense:0,investment:0,transfersIn:0,transfersOut:0,net:0}, account.net);
  }
  if (hasUnassigned()) {
    addSummary('Unassigned flows', totalsFor(''));
  }

  const rows = [['Node', 'Type', 'Linked account', 'Monthly flow (USD)', 'Account net (USD)']];
  for (const node of nodes) {
    const isAccount = node.type === 'account';
    rows.push([
      node.label,
      titles[node.type],
      isAccount ? '' : connectionLabel(node),
      isAccount ? null : plannedAmount(node) / 100,
      isAccount ? totalsFor(node.id).net / 100 : null
    ]);
  }

  const workbook = createPlanWorkbook(summary, rows, fflate, selectedMonth);
  const url = URL.createObjectURL(new Blob([workbook], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'budgeting-buddy-plan-' + selectedMonth + '.xlsx';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
byId('download').onclick = downloadPlan;

let pdfLibrary;
function loadPdfScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error('PDF library unavailable')); };
    document.head.append(script);
  });
}

async function downloadExpenseReport() {
  const button = byId('download-pdf');
  const status = byId('report-status');
  button.disabled = true;
  status.textContent = 'Preparing PDF…';
  const formattedTotals = id => Object.fromEntries(
    Object.entries(totalsFor(id)).map(([type, cents]) => [type, money(cents)])
  );

  const accounts = nodes.filter(node => node.type === 'account')
    .map(node => {
      const {transfersIn, transfersOut} = totalsFor(node.id);
      return {label: node.label, ...formattedTotals(node.id), netTransfers:money(transfersIn - transfersOut)};
    });
  if (hasUnassigned()) {
    accounts.push({label: 'Unassigned flows', ...formattedTotals(''), netTransfers:money(0)});
  }
  const expenses = nodes.filter(node => node.type === 'expense').map(node => ({
    label: node.label,
    account: accountFor(node)?.label ?? 'Unassigned',
    amount: money(node.amount)
  }));
  const exportMonth = selectedMonth;
  const ytd = [...accountRollup.values()].map(account => [account.label,money(account.net)]);
  const report = createExpenseReport({totals: formattedTotals(), accounts, expenses, period:monthLabel(exportMonth), ytd});

  try {
    pdfLibrary ??= loadPdfScript('vendor/pdfmake.min.js')
      .then(() => loadPdfScript('vendor/pdfmake-fonts.js'))
      .catch(error => { pdfLibrary = undefined; throw error; });
    await pdfLibrary;
    await new Promise(resolve => window.pdfMake.createPdf(report).download('budgeting-buddy-expense-summary-' + exportMonth + '.pdf', resolve));
    status.textContent = 'PDF download started.';
  } catch {
    status.textContent = 'Could not prepare the PDF. Try Download PDF again.';
  } finally {
    button.disabled = false;
  }
}
byId('download-pdf').onclick = downloadExpenseReport;
