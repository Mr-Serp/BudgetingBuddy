const byId = id => document.getElementById(id);
const currency = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:2, minimumFractionDigits:2});
const money = cents => currency.format(cents / 100);
const initial = [
  {id:'salary',type:'income',label:'Salary',amount:650000,account:'checking',x:65,y:118},
  {id:'freelance',type:'income',label:'Freelance',amount:95000,account:'checking',x:65,y:240},
  {id:'checking',type:'account',label:'Main checking',x:428,y:173},
  {id:'rent',type:'expense',label:'Rent & utilities',amount:235000,account:'checking',x:791,y:35},
  {id:'living',type:'expense',label:'Living expenses',amount:130000,account:'checking',x:791,y:133},
  {id:'retirement',type:'investment',label:'Retirement',amount:100000,account:'checking',x:791,y:231},
  {id:'index',type:'investment',label:'Index funds',amount:60000,account:'checking',x:791,y:329}
];
function positionFor(type, nodes) {
  const x = {income:65,account:428,expense:791,investment:791}[type];
  let y = 35;
  while (nodes.some(n => Math.abs(n.x - x) < 232 && Math.abs(n.y - y) < 96)) y += 98;
  return {x,y};
}

const planKey = 'flowledger-plan-v1';
function readPlan() {
  try {
    const value = JSON.parse(localStorage.getItem(planKey));
    if (Array.isArray(value)) return value;
  } catch {}
  return structuredClone(initial);
}
