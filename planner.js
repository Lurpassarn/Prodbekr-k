const shiftTimings = {
  FM: { start: 6 * 60, end: 14 * 60 },
  EM: { start: 14 * 60, end: 22.5 * 60 },
  Natt: { start: 22.5 * 60, end: 30 * 60 }
};

const schedule = {
  FM: { nextStart: shiftTimings.FM.start, orders: [] },
  EM: { nextStart: shiftTimings.EM.start, orders: [] },
  Natt: { nextStart: shiftTimings.Natt.start, orders: [] }
};

let availableOrders = [];

function nextShift(shift) {
  return shift === 'FM' ? 'EM' : shift === 'EM' ? 'Natt' : 'FM';
}

function formatTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function renderOrderList() {
  const list = document.getElementById('orderList');
  list.innerHTML = '';
  availableOrders.forEach((o, idx) => {
    const div = document.createElement('div');
    div.className = 'order-entry';
    div.innerHTML = `${o['Kundorder']} - ${o['Planerad Vikt']} kg ` +
      `<button data-idx="${idx}">Lägg till</button>`;
    div.querySelector('button').onclick = () => addOrder(idx);
    list.appendChild(div);
  });
}

function renderSchedule() {
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '';
  Object.keys(schedule).forEach(shift => {
    const s = schedule[shift];
    const h = document.createElement('h3');
    h.textContent = shift + '-skift';
    container.appendChild(h);
    const ul = document.createElement('ul');
    s.orders.forEach(o => {
      const li = document.createElement('li');
      li.textContent = `${o.orderId} ${formatTime(o.start)} - ${formatTime(o.end)} (${o.weight.toFixed(1)} kg)`;
      ul.appendChild(li);
    });
    container.appendChild(ul);
  });
}

function scheduleOrder(order, shift) {
  let timeLeft = order.productionTimeNormal;
  let weightLeft = parseFloat(order['Planerad Vikt']) || 0;
  const rate = weightLeft / order.productionTimeNormal;
  while (timeLeft > 0) {
    if (schedule[shift].nextStart < shiftTimings[shift].start)
      schedule[shift].nextStart = shiftTimings[shift].start;
    if (schedule[shift].nextStart >= shiftTimings[shift].end) {
      shift = nextShift(shift);
      continue;
    }
    const start = schedule[shift].nextStart;
    const available = shiftTimings[shift].end - start;
    const runTime = Math.min(timeLeft, available);
    const weight = rate * runTime;
    schedule[shift].orders.push({ orderId: order['Kundorder'], start, end: start + runTime, weight });
    schedule[shift].nextStart = start + runTime;
    timeLeft -= runTime;
    weightLeft -= weight;
    if (timeLeft > 0) shift = nextShift(shift);
  }
}

function addOrder(idx) {
  const order = availableOrders[idx];
  const shift = prompt('Lägg till i skift (FM/EM/Natt):', 'FM');
  if (!shiftTimings[shift]) return;
  scheduleOrder(order, shift);
  availableOrders.splice(idx, 1);
  renderOrderList();
  renderSchedule();
}

function loadOrders(machine) {
  fetch(machine + '.json')
    .then(r => r.json())
    .then(data => {
      availableOrders = calculateAllProductionTimes(data);
      renderOrderList();
    });
}

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('machineSelect');
  loadOrders(select.value);
  select.addEventListener('change', () => loadOrders(select.value));
});
