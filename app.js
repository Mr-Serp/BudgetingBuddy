const icons = {income:'↙',account:'▤',expense:'↗',investment:'◈'};
const titles = {income:'Income',account:'Account',expense:'Expense',investment:'Investment'};
let nodes = readPlan();
let scale, activeId, removalPending, lastScale;
const viewport = byId('viewport'), surface = byId('surface'), canvas = byId('edges');
const nodeLayer = byId('nodes'), listView = byId('listView'), editor = byId('editor');
const form = byId('form'), fields = form.elements;
const nodeWidth = 214, nodeHeight = 78;
const accountFor = node => nodes.find(account => account.id === node.account && account.type === 'account');
const totalsFor = id => {
  const totals = {income:0,expense:0,investment:0};
  for (const node of nodes) {
    if (node.type !== 'account' && (id === undefined || node.account === id)) totals[node.type] += node.amount;
  }
  totals.net = totals.income - totals.expense - totals.investment;
  return totals;
};
function save() {
  try {
    localStorage.setItem(planKey, JSON.stringify(nodes));
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
  for (const node of nodes) {
    const account = accountFor(node);
    if (!account) continue;
    const [source,target] = node.type === 'income' ? [node,account] : [account,node];
    const sx = source.x + nodeWidth, sy = source.y + nodeHeight / 2;
    const tx = target.x - 8, ty = target.y + nodeHeight / 2;
    const bend = Math.max(42, Math.abs(tx - sx) * .53);
    const color = getComputedStyle(document.documentElement).getPropertyValue({income:'--green',expense:'--pink',investment:'--purple'}[node.type]).trim();
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
  }
  byId('fit').textContent = Math.round(zoom * 100) + '%';
}
function render() {
  const totals = totalsFor();
  for (const [name,value] of Object.entries(totals)) byId(name).textContent = money(value);
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
    const value = money(node.type === 'account' ? totalsFor(node.id).net : node.amount);
    const button = document.createElement('button');
    button.className = 'node ' + node.type;
    button.style.left = node.x + 'px';
    button.style.top = node.y + 'px';
    button.innerHTML = '<span class="badge" aria-hidden="true"></span><span class="info"><strong></strong><small></small></span><span class="ports" aria-hidden="true"><i></i><i></i></span>';
    button.querySelector('.badge').textContent = icons[node.type];
    button.querySelector('strong').textContent = node.label;
    button.querySelector('small').textContent = value + (node.type === 'account' ? ' net / mo' : ' / mo');
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
      button.style.left = node.x + 'px';
      button.style.top = node.y + 'px';
      draw();
    };
    button.onlostpointercapture = () => { if (drag && moved) save(); drag = null; };
    button.onclick = event => { if (!moved || !event.detail) openEditor(node); };
    nodeLayer.append(button);
    const row = document.createElement('button');
    row.className = 'row';
    const connection = node.type === 'account' ? 'Monthly net' : accountFor(node)?.label ?? 'Unassigned';
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
  byId('amountLabel').hidden = byId('accountLabel').hidden = isAccount;
  fields.amount.disabled = fields.account.disabled = isAccount;
  byId('direction').textContent = type === 'income' ? 'Deposits into' : 'Paid from';
  byId('help').textContent = isAccount ? 'The account shows its monthly net flow.' : 'Choose an account to connect this node on the map.';
}
function openEditor(node) {
  activeId = node?.id;
  removalPending = false;
  byId('dialogTitle').textContent = node ? 'Edit node' : 'Add node';
  byId('remove').hidden = !node;
  byId('remove').textContent = 'Delete node';
  fields.type.value = node?.type ?? 'expense';
  fields.type.disabled = !!node;
  fields.label.value = node?.label ?? '';
  fields.amount.value = node?.amount === undefined ? '0' : (node.amount / 100).toFixed(2);
  fields.account.replaceChildren(new Option('Unassigned',''));
  for (const account of nodes.filter(n => n.type === 'account')) fields.account.add(new Option(account.label,account.id));
  fields.account.value = node?.account ?? (node ? '' : fields.account.options[1]?.value ?? '');
  fields.label.setCustomValidity('');
  updateFields();
  editor.showModal();
  fields.label.focus();
}
fields.type.onchange = updateFields;
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
  const node = existing ?? {id:crypto.randomUUID(),type,...positionFor(type, nodes)};
  node.label = label;
  if (type !== 'account') {
    node.amount = Math.round(Number(fields.amount.value) * 100);
    node.account = fields.account.value;
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
  for (const node of nodes) if (node.account === activeId) node.account = '';
  save();
  editor.close();
  render();
};
function setView(isMap) {
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
new ResizeObserver(() => { if (!viewport.hidden) draw(); }).observe(viewport);
render();
window.addEventListener('storage', event => {
  if (event.key !== planKey && event.key !== null) return;
  if (editor.open) editor.close();
  nodes = readPlan();
  render();
});
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  nodes = readPlan();
  render();
});

function downloadPlan() {
  const summary = [['Account', 'Income (USD)', 'Expenses (USD)', 'Investments (USD)', 'Remainder (USD)']];
  function addSummary(label, totals) {
    summary.push([label, totals.income / 100, totals.expense / 100, totals.investment / 100, totals.net / 100]);
  }
  addSummary('Entire plan', totalsFor());
  for (const node of nodes) {
    if (node.type === 'account') addSummary(node.label, totalsFor(node.id));
  }
  if (nodes.some(node => node.type !== 'account' && !accountFor(node))) {
    addSummary('Unassigned flows', totalsFor(''));
  }

  const rows = [['Node', 'Type', 'Linked account', 'Monthly flow (USD)', 'Account net (USD)']];
  for (const node of nodes) {
    const isAccount = node.type === 'account';
    rows.push([
      node.label,
      titles[node.type],
      isAccount ? '' : accountFor(node)?.label ?? 'Unassigned',
      isAccount ? null : node.amount / 100,
      isAccount ? totalsFor(node.id).net / 100 : null
    ]);
  }

  const workbook = createPlanWorkbook(summary, rows, fflate);
  const url = URL.createObjectURL(new Blob([workbook], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'budgeting-buddy-plan.xlsx';
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
    .map(node => ({label: node.label, ...formattedTotals(node.id)}));
  if (nodes.some(node => node.type !== 'account' && !accountFor(node))) {
    accounts.push({label: 'Unassigned flows', ...formattedTotals('')});
  }
  const expenses = nodes.filter(node => node.type === 'expense').map(node => ({
    label: node.label,
    account: accountFor(node)?.label ?? 'Unassigned',
    amount: money(node.amount)
  }));
  const report = createExpenseReport({totals: formattedTotals(), accounts, expenses});

  try {
    pdfLibrary ??= loadPdfScript('vendor/pdfmake.min.js')
      .then(() => loadPdfScript('vendor/pdfmake-fonts.js'))
      .catch(error => { pdfLibrary = undefined; throw error; });
    await pdfLibrary;
    await new Promise(resolve => window.pdfMake.createPdf(report).download('budgeting-buddy-expense-summary.pdf', resolve));
    status.textContent = 'PDF download started.';
  } catch {
    status.textContent = 'Could not prepare the PDF. Try Download PDF again.';
  } finally {
    button.disabled = false;
  }
}
byId('download-pdf').onclick = downloadExpenseReport;
