const STORAGE_KEY = 'savedPlans';

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
let plannedSequence = [];

function nextShift(shift){
  return shift === 'FM' ? 'EM' : shift === 'EM' ? 'Natt' : 'FM';
}

function formatTime(mins){
  const h = Math.floor(mins/60)%24;
  const m = Math.round(mins%60);
  return String(h).padStart(2,'0')+':' + String(m).padStart(2,'0');
}

function getSaved(machine){
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
  return data[machine] || {};
}

function savePlan(machine,name,sequence){
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
  if(!data[machine]) data[machine]={};
  data[machine][name] = sequence;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSavedNames(machine){
  const sel = document.getElementById('savedPlans');
  const plans = getSaved(machine);
  sel.innerHTML = '<option value="">Välj plan</option>';
  Object.keys(plans).forEach(n=>{
    const opt=document.createElement('option');
    opt.value=n; opt.textContent=n; sel.appendChild(opt);
  });
}

function renderOrderList() {
  const list = document.getElementById('orderList');
  list.innerHTML = '';
  availableOrders.forEach((o, idx) => {
    const div = document.createElement('div');
    div.className = 'order-entry';
    div.innerHTML = `${o['Kundorder']} - ${o['Planerad Vikt']} kg ` +
      `<button data-idx="${idx}">Lägg till ordning</button>`;
    div.querySelector('button').onclick = () => addToSequence(idx);
    list.appendChild(div);
  });
}

function renderSequence() {
  const seq = document.getElementById('sequenceList');
  seq.innerHTML = '';
  plannedSequence.forEach((o, idx) => {
    const div = document.createElement('div');
    div.className = 'order-entry';
    div.innerHTML = `${idx + 1}. ${o['Kundorder']} - ${o['Planerad Vikt']} kg ` +
      `<button data-idx="${idx}" class="up">&#8679;</button>` +
      `<button data-idx="${idx}" class="down">&#8681;</button>` +
      `<button data-idx="${idx}" class="remove">X</button>`;
    div.querySelector('.up').onclick = () => moveSequence(idx, -1);
    div.querySelector('.down').onclick = () => moveSequence(idx, 1);
    div.querySelector('.remove').onclick = () => removeFromSequence(idx);
    seq.appendChild(div);
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
    const ul=document.createElement('ul');
    s.orders.forEach(o=>{
      const li=document.createElement('li');
      li.textContent=`${o.orderId} ${formatTime(o.start)} - ${formatTime(o.end)} (${o.weight.toFixed(1)} kg)`;
      ul.appendChild(li);
    });
    container.appendChild(ul);
  });
}

function scheduleOrder(order,shift){
  let timeLeft=order.productionTimeNormal;
  let weightLeft=parseFloat(order['Planerad Vikt'])||0;
  const rate=weightLeft/order.productionTimeNormal;
  while(timeLeft>0){
    if(schedule[shift].nextStart<shiftTimings[shift].start)
      schedule[shift].nextStart=shiftTimings[shift].start;
    if(schedule[shift].nextStart>=shiftTimings[shift].end){
      shift=nextShift(shift);continue;
    }
    const start=schedule[shift].nextStart;
    const available=shiftTimings[shift].end-start;
    const run=Math.min(timeLeft,available);
    const weight=rate*run;
    schedule[shift].orders.push({orderId:order['Kundorder'],start,end:start+run,weight});
    schedule[shift].nextStart=start+run;
    timeLeft-=run;weightLeft-=weight;
    if(timeLeft>0) shift=nextShift(shift);
  }
  return shift;
}


function addToSequence(idx) {
  const order = availableOrders.splice(idx, 1)[0];
  plannedSequence.push(order);
  renderOrderList();
  renderSequence();
}

function moveSequence(idx, dir) {
  const newIndex = idx + dir;
  if (newIndex < 0 || newIndex >= plannedSequence.length) return;
  const temp = plannedSequence[idx];
  plannedSequence[idx] = plannedSequence[newIndex];
  plannedSequence[newIndex] = temp;
  renderSequence();
}

function removeFromSequence(idx) {
  const order = plannedSequence.splice(idx, 1)[0];
  availableOrders.push(order);
  renderOrderList();
  renderSequence();
}


function resetSchedule() {
  ['FM','EM','Natt'].forEach(s => {
    schedule[s].orders = [];
    schedule[s].nextStart = shiftTimings[s].start;
  });
}

function generateSchedule() {
  resetSchedule();
  let currentShift = 'FM';
  plannedSequence.forEach(o => {
    currentShift = scheduleOrder(o, currentShift) || currentShift;
  });
  renderSchedule();
}

function addCustomOrder(e) {
  if(e) e.preventDefault();
  const orderId = document.getElementById('coId').value.trim();
  if (!orderId) return;
  const weight = parseFloat(document.getElementById('coWeight').value) || 0;
  const gram = parseFloat(document.getElementById('coGram').value) || 0;
  const length = parseFloat(document.getElementById('coLen').value) || 0;
  const width = document.getElementById('coWidth').value || '';
  const lanes = parseFloat(document.getElementById('coLanes').value) || 1;
  const sheetW = parseFloat(document.getElementById('coSheet').value) || 0;
  const machine = document.getElementById('machineSelect').value;
  const order = {
    'Kundorder': orderId,
    'Planerad Vikt': weight,
    'Gramvikt': gram,
    'Arklängd': length,
    'RawRollWidth': width,
    'Antal banor': lanes,
    'Arkbredd': sheetW,
    'Maskin id': machine
  };
  const { normalTime, saxningTime } = calculateProductionTime(order);
  order.productionTimeNormal = normalTime;
  order.productionTimeSaxning = saxningTime;
  availableOrders.push(order);
  renderOrderList();
  if(e) e.target.reset();
}

function loadOrders(machine) {
  fetch(machine + '.json')
    .then(r => r.json())
    .then(data => {
      availableOrders = calculateAllProductionTimes(data);
      plannedSequence = [];
      resetSchedule();
      renderOrderList();
      renderSequence();
      renderSchedule();
    });
}

function loadSelectedPlan(){
  const sel=document.getElementById('savedPlans');
  const name=sel.value; if(!name) {plannedSequence=[];renderSequence();renderOrderList();return;}
  const machine=document.getElementById('machineSelect').value;
  const plan=getSaved(machine)[name];
  if(!plan) return;
  loadOrders(machine).then(()=>{
    plan.forEach(p=>{
      const idx=availableOrders.findIndex(o=>o['Kundorder']===p['Kundorder']);
      if(idx>-1) availableOrders.splice(idx,1);
    });
    plannedSequence=plan.slice();
    renderOrderList();
    renderSequence();
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  const select=document.getElementById('machineSelect');
  loadOrders(select.value);
  loadSavedNames(select.value);
  select.addEventListener('change', () => { loadOrders(select.value); loadSavedNames(select.value); });
  document.getElementById('savePlanBtn').onclick = () => {
    const name=document.getElementById('planName').value.trim();
    if(!name){ alert('Ange namn f\u00f6r planen'); return; }
    savePlan(select.value,name,plannedSequence);
    loadSavedNames(select.value);
    alert('Plan sparad');
  };
  document.getElementById('loadPlanBtn').onclick = loadSelectedPlan;
  document.getElementById('customOrderForm').addEventListener('submit', addCustomOrder);
  document.getElementById('generateScheduleBtn').onclick = generateSchedule;
});
