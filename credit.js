const cardKey = 'flowledger-credit-cards-v1';
const cardEditor = byId('card-editor');
const cardFields = byId('card-form').elements;
const cardStatus = byId('credit-status');
const rate = (balance, limit) => limit
  ? new Intl.NumberFormat('en-US', {style:'percent', maximumFractionDigits:1}).format(balance / limit)
  : '—';
let editingCard;
let confirmCardRemoval = false;

function readCards() {
  try {
    const saved = JSON.parse(localStorage.getItem(cardKey));
    if (Array.isArray(saved)) return saved;
  } catch {}
  return [];
}

function creditButton(label, action) {
  const button = document.createElement('button');
  button.className = 'download';
  button.type = 'button';
  button.textContent = label;
  button.onclick = action;
  return button;
}

function renderCredit() {
  const cards = readCards();
  const plan = readPlan();
  const balance = cards.reduce((sum, card) => sum + card.balance, 0);
  const limit = cards.reduce((sum, card) => sum + card.limit, 0);
  const remaining = cards.reduce((sum, card) => sum + Math.max(0, card.balance - card.payment), 0);
  byId('credit-balance').textContent = cards.length ? money(balance) : '—';
  byId('credit-limit').textContent = cards.length ? money(limit) : '—';
  byId('credit-use').textContent = rate(balance, limit);
  byId('credit-after').textContent = rate(remaining, limit);
  const list = byId('card-list');
  list.replaceChildren();
  if (!cards.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Add a card to calculate utilization.';
    list.append(empty);
  }
  for (const card of cards) {
    const linked = plan.find(node => node.id === card.id && node.type === 'expense');
    const account = plan.find(node => node.id === card.account && node.type === 'account');
    const article = document.createElement('article');
    article.className = 'credit-card';
    article.innerHTML = '<div class="credit-card-head"><h3></h3><span></span></div><p></p><p></p><div class="credit-card-actions"></div>';
    article.querySelector('h3').textContent = card.label;
    article.querySelector('span').textContent = rate(card.balance, card.limit) + ' utilized';
    const [details, flow] = article.querySelectorAll('p');
    details.textContent = money(card.balance) + ' of ' + money(card.limit) + ' · '
      + rate(Math.max(0, card.balance - card.payment), card.limit) + ' after payment';
    flow.textContent = money(card.payment) + ' monthly payment · ' + (account?.label ?? 'Unassigned')
      + (linked ? ' · On Flow Map' : '');
    const actions = article.querySelector('.credit-card-actions');
    actions.append(creditButton('Edit card', () => showCardEditor(card)));
    if (card.payment > 0 || linked) {
      actions.append(creditButton(linked ? 'Update Flow Map' : 'Send to Flow Map', () => sendPayment(card.id)));
    }
    list.append(article);
  }
}

function showCardEditor(card) {
  editingCard = card?.id;
  confirmCardRemoval = false;
  byId('card-editor-title').textContent = card ? 'Edit card' : 'Add card';
  byId('remove-card').hidden = !card;
  byId('remove-card').textContent = 'Remove card';
  byId('card-help').textContent = 'Your card details are saved on this device.';
  cardFields.label.value = card?.label ?? '';
  cardFields.label.setCustomValidity('');
  cardFields.balance.value = (card?.balance ?? 0) / 100;
  cardFields.creditLimit.value = card ? card.limit / 100 : '';
  cardFields.payment.value = (card?.payment ?? 0) / 100;
  cardFields.account.replaceChildren(new Option('Unassigned', ''));
  for (const node of readPlan().filter(node => node.type === 'account')) {
    cardFields.account.add(new Option(node.label, node.id));
  }
  cardFields.account.value = card?.account ?? '';
  if (cardFields.account.selectedIndex === -1) cardFields.account.value = '';
  cardEditor.showModal();
  cardFields.label.focus();
}

function saveCards(cards, message) {
  try {
    localStorage.setItem(cardKey, JSON.stringify(cards));
  } catch {
    byId('card-help').textContent = 'Could not save card details on this device.';
    return;
  }
  cardEditor.close();
  renderCredit();
  cardStatus.textContent = message;
}

function sendPayment(id) {
  const card = readCards().find(item => item.id === id);
  if (!card) return renderCredit();
  const plan = readPlan();
  const linked = plan.find(node => node.id === id && node.type === 'expense');
  const account = plan.some(node => node.id === card.account && node.type === 'account') ? card.account : '';
  const label = card.label + ' payment';
  const node = linked ?? {id, type:'expense', ...positionFor('expense', plan)};
  Object.assign(node, {label, amount:card.payment, account});
  if (!linked) plan.push(node);
  try {
    localStorage.setItem(planKey, JSON.stringify(plan));
    renderCredit();
    cardStatus.textContent = label + ' saved to the Flow Map.';
  } catch {
    cardStatus.textContent = 'Could not save the payment to the Flow Map.';
  }
}

byId('add-card').onclick = () => showCardEditor();
byId('close-card').onclick = () => cardEditor.close();
cardFields.label.oninput = () => cardFields.label.setCustomValidity('');
byId('card-form').onsubmit = event => {
  event.preventDefault();
  const label = cardFields.label.value.trim();
  if (!label) {
    cardFields.label.setCustomValidity('Enter a card nickname.');
    cardFields.label.reportValidity();
    return;
  }
  const cards = readCards();
  const index = cards.findIndex(card => card.id === editingCard);
  const card = {
    id:editingCard ?? 'credit-' + crypto.randomUUID(),
    label,
    balance:Math.round(cardFields.balance.valueAsNumber * 100),
    limit:Math.round(cardFields.creditLimit.valueAsNumber * 100),
    payment:Math.round(cardFields.payment.valueAsNumber * 100),
    account:cardFields.account.value
  };
  if (index < 0) cards.push(card);
  else cards[index] = card;
  saveCards(cards, 'Card saved.');
};

byId('remove-card').onclick = () => {
  if (!confirmCardRemoval) {
    confirmCardRemoval = true;
    byId('remove-card').textContent = 'Confirm removal';
    byId('card-help').textContent = 'If you sent a payment to the Flow Map, you can remove that expense there.';
    return;
  }
  saveCards(readCards().filter(card => card.id !== editingCard), 'Card removed.');
};

window.addEventListener('storage', event => {
  if (event.key === cardKey || event.key === planKey || event.key === null) renderCredit();
});
window.addEventListener('pageshow', event => { if (event.persisted) renderCredit(); });
renderCredit();
