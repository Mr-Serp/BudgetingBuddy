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

const budgetKey = 'budgeting-buddy-months-v1';
const today = new Date();
const currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2,'0');
const monthFormat = new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'});

function monthLabel(month) {
  return monthFormat.format(new Date(month + '-01T00:00:00Z'));
}

function shiftMonth(month, delta) {
  const [year,number] = month.split('-').map(Number);
  const index = year * 12 + number - 1 + delta;
  return String(Math.floor(index / 12)).padStart(4,'0') + '-' + String(index % 12 + 1).padStart(2,'0');
}

function monthFromUrl() {
  const value = new URLSearchParams(location.search).get('month');
  return /^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(value ?? '') ? value : currentMonth;
}

let initialBudget;
function readBudget() {
  try {
    const stored = JSON.parse(localStorage.getItem(budgetKey));
    if (stored?.start && stored.months) return stored;
  } catch {}
  initialBudget ??= {start:currentMonth, months:{[currentMonth]:readPlan()}};
  return structuredClone(initialBudget);
}

function initializeBudget() {
  try {
    if (!localStorage.getItem(budgetKey)) localStorage.setItem(budgetKey,JSON.stringify(readBudget()));
  } catch {}
}

function monthPlan(month, budget = readBudget()) {
  if (Object.hasOwn(budget.months,month)) return budget.months[month];
  if (month < budget.start) return [];
  const nearest = Object.keys(budget.months)
    .filter(key => key >= budget.start && key < month).sort().at(-1);
  return budget.months[nearest] ?? [];
}

function saveMonthPlan(month, nodes) {
  const budget = readBudget();
  budget.months[month] = nodes;
  localStorage.setItem(budgetKey,JSON.stringify(budget));
}
