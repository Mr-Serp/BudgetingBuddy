const fullAllocation = 10000;
const allocationPercent = share => (share / 100) + '%';

function allocationsFor(node) {
  return node.allocations ?? (node.type === 'income' && node.account
    ? [{target:node.account, share:fullAllocation}] : []);
}

function reachesAccount(nodes, from, to) {
  const accounts = new Map(nodes.filter(n => n.type === 'account').map(n => [n.id,n]));
  const pending = [from], visited = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (id === to) return true;
    if (visited.has(id) || !accounts.has(id)) continue;
    visited.add(id);
    for (const link of allocationsFor(accounts.get(id))) pending.push(link.target);
  }
  return false;
}

function calculateFlows(nodes) {
  const empty = () => ({income:0, expense:0, investment:0, transfersIn:0, transfersOut:0, net:0});
  const accounts = nodes.filter(n => n.type === 'account');
  const totals = new Map(accounts.map(n => [n.id,empty()]));
  const unassigned = empty(), overall = empty(), edges = [];
  const owners = new Map(nodes.map(n => [n.id,n]));
  const amounts = new Map();
  const percentageInvestments = new Map(accounts.map(n => [n.id,[]]));
  function distribute(node, amount, receive) {
    const links = allocationsFor(node).filter(link => totals.has(link.target));
    let units = 0;
    let distributed = 0;
    for (const link of links) {
      units += link.share;
      const next = Math.floor(amount * units / fullAllocation);
      const cents = next - distributed;
      receive(totals.get(link.target), cents);
      edges.push({source:node, target:owners.get(link.target), share:link.share, cents, type:node.type});
      distributed = next;
    }
    return distributed;
  }
  for (const node of nodes) {
    if (node.type === 'account') continue;
    if (node.type === 'investment' && node.investmentShare !== undefined) {
      amounts.set(node.id,0);
      percentageInvestments.get(node.account)?.push(node);
      continue;
    }
    amounts.set(node.id,node.amount);
    overall[node.type] += node.amount;
    if (node.type === 'income') {
      unassigned.income += node.amount - distribute(node,node.amount,(total,cents) => { total.income += cents; });
    } else if (totals.has(node.account)) {
      totals.get(node.account)[node.type] += node.amount;
      edges.push({source:owners.get(node.account),target:node,type:node.type,cents:node.amount});
    } else {
      unassigned[node.type] += node.amount;
    }
  }
  const upstream = new Map(accounts.map(n => [n.id,0]));
  for (const node of accounts) {
    for (const {target} of allocationsFor(node)) {
      if (upstream.has(target)) upstream.set(target,upstream.get(target) + 1);
    }
  }
  const queue = accounts.filter(n => upstream.get(n.id) === 0);
  for (const node of queue) {
    const total = totals.get(node.id);
    const available = Math.max(0,total.income + total.transfersIn - total.expense - total.investment);
    let units = 0;
    let invested = 0;
    for (const target of percentageInvestments.get(node.id)) {
      units += target.investmentShare;
      const next = Math.floor(available * units / fullAllocation);
      const cents = next - invested;
      amounts.set(target.id,cents);
      total.investment += cents;
      overall.investment += cents;
      edges.push({source:node,target,type:'investment',share:target.investmentShare,cents});
      invested = next;
    }
    total.transfersOut = distribute(node,available - invested,(target,cents) => { target.transfersIn += cents; });
    for (const {target} of allocationsFor(node)) {
      if (!upstream.has(target)) continue;
      upstream.set(target,upstream.get(target) - 1);
      if (upstream.get(target) === 0) queue.push(owners.get(target));
    }
  }
  for (const total of [overall,unassigned,...totals.values()]) {
    total.net = total.income + total.transfersIn - total.expense - total.investment - total.transfersOut;
  }
  return {overall,unassigned,totals,edges,amounts};
}
