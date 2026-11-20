const graphSeries = [
  {key:'income',label:'Income'},
  {key:'expense',label:'Expenses'},
  {key:'investment',label:'Investments'},
  {key:'net',label:'Remainder'}
];
const shortMonthFormat = new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'});
const chartMoney = new Intl.NumberFormat('en-US',{
  style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2
});

function budgetGraphMonths(year, budget, selected, currentTotals) {
  return Array.from({length:12},(_,index) => {
    const month = year + '-' + String(index + 1).padStart(2,'0');
    const saved = hasSavedMonth(budget,month);
    const state = saved ? 'Saved plan' : month < budget.start ? 'No plan' : 'Carried-forward plan';
    return {month,state,totals:month === selected ? currentTotals : calculateFlows(monthPlan(month,budget)).overall};
  });
}

function graphScale(months) {
  const values = months.flatMap(({totals}) => graphSeries.map(({key}) => totals[key]));
  const min = Math.min(0,...values);
  const max = Math.max(0,...values);
  const rough = (max - min || 100000) / 4;
  const base = 10 ** Math.floor(Math.log10(rough));
  const step = ([1,2,2.5,5,10].find(value => value * base >= rough) ?? 10) * base;
  const bottom = Math.floor(min / step) * step;
  const top = max === min ? step * 4 : Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = bottom; value <= top; value += step) ticks.push(value);
  return {ticks,position:value => 100 * (value - bottom) / (top - bottom)};
}

function renderBudgetGraph() {
  const year = selectedMonth.slice(0,4);
  const months = budgetGraphMonths(year,readBudget(),selectedMonth,flows.overall);
  const {ticks,position} = graphScale(months);
  const selected = months.find(item => item.month === selectedMonth);
  const chart = byId('graph-chart');
  byId('graph-title').textContent = 'Monthly budget · ' + year;
  byId('graph-status').textContent = monthLabel(selectedMonth) + ' · ' + selected.state + (selected.state === 'No plan'
    ? '' : ' · ' + graphSeries.map(({key,label}) => label + ' ' + money(selected.totals[key])).join(' · '));

  const axis = document.createElement('div');
  axis.className = 'graph-axis';
  axis.setAttribute('aria-hidden','true');
  for (const value of ticks) {
    const tick = document.createElement('span');
    tick.className = 'graph-tick' + (value === 0 ? ' graph-zero' : '');
    tick.style.bottom = position(value) + '%';
    tick.textContent = chartMoney.format(value / 100);
    axis.append(tick);
  }
  chart.replaceChildren(axis);
  let active;
  for (const {month,state,totals} of months) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'graph-month';
    button.dataset.month = month;
    button.setAttribute('aria-pressed',String(month === selectedMonth));
    button.setAttribute('aria-label',monthLabel(month) + ', ' + state + (state === 'No plan' ? ''
      : ', ' + graphSeries.map(({key,label}) => label + ' ' + money(totals[key])).join(', ')));
    if (month === selectedMonth) active = button;
    const plot = document.createElement('span');
    plot.className = 'graph-month-plot';
    plot.setAttribute('aria-hidden','true');
    if (state !== 'No plan') {
      for (const {key} of graphSeries) {
        if (!totals[key]) continue;
        const bar = document.createElement('i');
        bar.className = 'graph-bar graph-' + key;
        bar.style.bottom = Math.min(position(0),position(totals[key])) + '%';
        bar.style.height = Math.abs(position(totals[key]) - position(0)) + '%';
        plot.append(bar);
      }
      plot.classList.toggle('graph-projected',state === 'Carried-forward plan');
    }
    const caption = document.createElement('span');
    caption.className = 'graph-month-name';
    caption.textContent = shortMonthFormat.format(new Date(month + '-01T00:00:00Z'));
    button.append(plot,caption);
    button.onclick = () => {
      if (month === selectedMonth) return;
      selectBudgetMonth(month);
      chart.querySelector('[data-month="' + month + '"]').focus({preventScroll:true});
    };
    chart.append(button);
  }
  const scroll = byId('graph-scroll');
  const start = active.offsetLeft;
  const end = start + active.offsetWidth;
  if (start < scroll.scrollLeft || end > scroll.scrollLeft + scroll.clientWidth) {
    scroll.scrollLeft = Math.max(0,start - (scroll.clientWidth - active.offsetWidth) / 2);
  }
}
