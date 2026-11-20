const connectionEditor = byId('connection-editor');
const connectionFields = byId('allocation-fields');
const allocationStatus = byId('allocation-status');
let connectionDraft, connectionSource, allocationInputs;

function canConnect(source, target) {
  if (target.type === 'account') {
    return source.type === 'income' || (source.type === 'account' && !reachesAccount(nodes,target.id,source.id));
  }
  return source.type === 'account' && ['expense','investment'].includes(target.type);
}

function targetAt(event, source) {
  const card = document.elementFromPoint(event.clientX,event.clientY)?.closest('.node-shell');
  if (!card) return;
  const target = nodes.find(node => node.id === card.dataset.nodeId);
  if (!target || !canConnect(source,target)) return;
  const rect = card.getBoundingClientRect();
  if (event.clientX <= rect.left + Math.max(26,rect.width * .18)) return target;
}

function beginConnectionDrag(event, source) {
  if (event.button !== 0) return;
  const outlet = event.currentTarget;
  delete outlet.dataset.dragged;
  const {clientX,clientY,pointerId} = event;
  outlet.setPointerCapture(pointerId);
  outlet.onpointermove = move => {
    if (!connectionDraft && Math.hypot(move.clientX - clientX,move.clientY - clientY) < 5) return;
    outlet.dataset.dragged = 'true';
    connectionDraft = {source,x:move.clientX,y:move.clientY};
    const target = targetAt(move,source);
    for (const card of nodeLayer.children) {
      const node = nodes.find(item => item.id === card.dataset.nodeId);
      card.classList.toggle('connection-target',!!node && canConnect(source,node));
      card.classList.toggle('connection-hover',node === target);
    }
    draw();
  };
  function finish() {
    connectionDraft = null;
    outlet.onpointermove = null;
    for (const card of nodeLayer.children) card.classList.remove('connection-target','connection-hover');
    if (!viewport.hidden) draw();
  }
  outlet.onlostpointercapture = finish;
  outlet.onpointerup = up => {
    if (!connectionDraft) return;
    const target = targetAt(up,source);
    finish();
    if (!target) {
      byId('connection-status').textContent = 'Drop on the highlighted left edge of a compatible node.';
      return;
    }
    if (target.type === 'account') {
      openConnections(source,target);
    } else {
      target.account = source.id;
      save();
      render();
      byId('connection-status').textContent = target.label + ' is paid from ' + source.label + '.';
    }
  };
}

function drawConnectionDraft(ctx, zoom) {
  if (!connectionDraft) return;
  const {source,x,y} = connectionDraft;
  const rect = surface.getBoundingClientRect();
  const sx = source.x + nodeWidth, sy = source.y + nodeHeight / 2;
  const tx = (x - rect.left) / zoom, ty = (y - rect.top) / zoom;
  const bend = Math.max(30,Math.abs(tx - sx) / 2);
  ctx.strokeStyle = '#78e9d6';
  ctx.lineWidth = 2;
  ctx.setLineDash([6,4]);
  ctx.beginPath();
  ctx.moveTo(sx,sy);
  ctx.bezierCurveTo(sx + bend,sy,tx - bend,ty,tx,ty);
  ctx.stroke();
  ctx.setLineDash([]);
}

function openConnections(source, proposed) {
  connectionSource = source.id;
  const available = nodes.filter(node => node.type === 'account' && canConnect(source,node));
  const shares = new Map(allocationsFor(source).map(link => [link.target,link.share]));
  if (proposed && !shares.has(proposed.id)) {
    const remaining = fullAllocation - [...shares.values()].reduce((sum,share) => sum + share,0);
    if (remaining) {
      shares.set(proposed.id, remaining);
    } else if (shares.size === 1) {
      shares.set(shares.keys().next().value,fullAllocation / 2);
      shares.set(proposed.id,fullAllocation / 2);
    }
  }
  byId('connection-title').textContent = source.label + ' connections';
  byId('connection-help').textContent = source.type === 'income'
    ? 'Split monthly income between accounts. Any unallocated share stays unassigned.'
    : 'Split the funds left after expenses and investments. Any unallocated share stays in this account.';
  connectionFields.replaceChildren();
  allocationInputs = new Map();
  for (const target of available) {
    const label = document.createElement('label');
    label.append(target.label + ' (%)');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = '.01';
    input.required = true;
    input.value = (shares.get(target.id) ?? 0) / 100;
    input.oninput = updateAllocationStatus;
    label.append(input);
    connectionFields.append(label);
    allocationInputs.set(target.id,input);
  }
  updateAllocationStatus();
  if (!available.length) allocationStatus.textContent = 'Add another account to create an allocation.';
  connectionEditor.showModal();
  allocationInputs.get(proposed?.id)?.select();
}

function currentAllocations() {
  return [...allocationInputs].map(([target,input]) => ({target,share:Math.round(input.valueAsNumber * 100)}));
}

function updateAllocationStatus() {
  const sum = currentAllocations().reduce((total, link) => total + link.share,0);
  allocationStatus.textContent = !Number.isFinite(sum) ? 'Enter a percentage for each account.'
    : sum > fullAllocation ? 'Total exceeds 100%. Lower one or more percentages.'
    : allocationPercent(sum) + ' allocated · ' + allocationPercent(fullAllocation - sum) + ' remaining. Set a share to 0% to remove its connection.';
  return sum <= fullAllocation;
}

byId('close-connection').onclick = () => connectionEditor.close();
byId('connection-form').onsubmit = event => {
  event.preventDefault();
  const source = nodes.find(node => node.id === connectionSource);
  if (!source || !updateAllocationStatus()) return;
  source.allocations = currentAllocations().filter(link => link.share > 0);
  if (source.type === 'income') source.account = '';
  save();
  connectionEditor.close();
  render();
  nodeLayer.querySelectorAll('.node-shell').forEach(card => {
    if (card.dataset.nodeId === source.id && !viewport.hidden) card.querySelector('.node-outlet')?.focus();
  });
  byId('connection-status').textContent = 'Connections updated for ' + source.label + '.';
};
