const loanForm = byId('loan-form');
const loanResults = byId('loan-results');

function creditScoreBand(score) {
  if (score < 580) return 'Poor';
  if (score < 670) return 'Fair';
  if (score < 740) return 'Good';
  if (score < 800) return 'Very good';
  return 'Exceptional';
}

function loanScenario(income, debt, apr, months, dti) {
  const payment = Math.max(0, Math.floor(income * dti / 100) - debt);
  const rate = apr / 1200;
  const paymentFactor = rate === 0 ? months : -Math.expm1(-months * Math.log1p(rate)) / rate;
  return {payment, principal: Math.floor(payment * paymentFactor + 1e-7)};
}

loanForm.addEventListener('input', () => { loanResults.hidden = true; });
loanForm.addEventListener('submit', event => {
  event.preventDefault();
  const fields = loanForm.elements;
  const score = fields.score.valueAsNumber;
  const income = Math.round(fields.income.valueAsNumber * 100);
  const debt = Math.round(fields.debt.valueAsNumber * 100);
  const apr = fields.apr.valueAsNumber;
  const term = fields.term.valueAsNumber;
  const currentDti = new Intl.NumberFormat('en-US', {style:'percent', maximumFractionDigits:1}).format(debt / income);

  byId('loan-score').textContent = score + ' · ' + creditScoreBand(score) + ' (FICO score range)';
  byId('loan-context').textContent = 'Your existing debt payments use ' + currentDti
    + ' of gross monthly income. The scenarios below use the annual rate you entered.';
  const rows = byId('loan-scenarios');
  rows.replaceChildren();
  for (const dti of [30, 36, 43]) {
    const {payment, principal} = loanScenario(income, debt, apr, term, dti);
    const row = rows.insertRow();
    for (const text of [dti + '%', money(payment), money(principal)]) row.insertCell().textContent = text;
  }
  byId('loan-assumptions').textContent = 'Assumes a fixed ' + apr + '% annual rate, '
    + term + ' monthly payments, and no fees. The debt-to-income percentages are examples.';
  loanResults.hidden = false;
  byId('loan-score').focus();
});
