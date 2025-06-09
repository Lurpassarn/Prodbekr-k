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

function renderOrderList(){
  const list=document.getElementById('orderList');
  list.innerHTML='';
  availableOrders.forEach((o,idx)=>{
    const div=document.createElement('div');
    div.className='order-entry';
    div.textContent=`${o['Kundorder']} - ${o['Planerad Vikt']} kg`;
    const btn=document.createElement('button');
    btn.textContent='+';
    btn.onclick=()=>addToSequence(idx);
    div.appendChild(btn);
    list.appendChild(div);
  });
}

function renderSequence(){
  const seq=document.getElementById('sequenceList');
  seq.innerHTML='';
  plannedSequence.forEach((o,idx)=>{
    const div=document.createElement('div');
    div.className='order-entry';
    div.draggable=true;
    div.dataset.index=idx;
    div.textContent=`${idx+1}. ${o['Kundorder']} - ${o['Planerad Vikt']} kg`;
    const rem=document.createElement('button');
    rem.textContent='X';
    rem.onclick=()=>removeFromSequence(idx);
    div.appendChild(rem);
    div.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',idx);});
    div.addEventListener('dragover',e=>e.preventDefault());
    div.addEventListener('drop',e=>{
      e.preventDefault();
      const from=parseInt(e.dataTransfer.getData('text/plain'),10);
      const to=idx;
      if(from===to) return;
      const itm=plannedSequence.splice(from,1)[0];
      plannedSequence.splice(to,0,itm);
      renderSequence();
    });
    seq.appendChild(div);
  });
}

function renderSchedule(){
  const container=document.getElementById('scheduleContainer');
  container.innerHTML='';
  Object.keys(schedule).forEach(shift=>{
    const s=schedule[shift];
    const h=document.createElement('h3');
    h.textContent=shift;
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

function addToSequence(idx){
  const order=availableOrders.splice(idx,1)[0];
  plannedSequence.push(order);
  renderOrderList();
  renderSequence();
}

function removeFromSequence(idx){
  const o=plannedSequence.splice(idx,1)[0];
  availableOrders.push(o);
  renderOrderList();
  renderSequence();
}

function resetSchedule(){
  ['FM','EM','Natt'].forEach(s=>{schedule[s].orders=[];schedule[s].nextStart=shiftTimings[s].start;});
}

function generateSchedule(){
  resetSchedule();
  let current='FM';
  plannedSequence.forEach(o=>{current=scheduleOrder(o,current)||current;});
  renderSchedule();
}

function addCustomOrder(e){
  e.preventDefault();
  const machine=document.getElementById('machineSelect').value;
  const order={
    'Kundorder':document.getElementById('coId').value,
    'Planerad Vikt':parseFloat(document.getElementById('coWeight').value)||0,
    'Gramvikt':parseFloat(document.getElementById('coGram').value)||0,
    'Arklängd':parseFloat(document.getElementById('coLen').value)||0,
    'RawRollWidth':document.getElementById('coWidth').value,
    'Antal banor':parseFloat(document.getElementById('coLanes').value)||1,
    'Arkbredd':parseFloat(document.getElementById('coSheet').value)||0,
    'Maskin id':machine
  };
  const times=calculateProductionTime(order);
  order.productionTimeNormal=times.normalTime;
  order.productionTimeSaxning=times.saxningTime;
  availableOrders.push(order);
  document.getElementById('customOrderForm').reset();
  renderOrderList();
}

function saveCurrentPlan(){
  const name=document.getElementById('planName').value.trim();
  const machine=document.getElementById('machineSelect').value;
  if(!name) return;
  savePlan(machine,name,plannedSequence.slice());
  loadSavedNames(machine);
}

function loadOrders(machine){
  fetch(machine+'.json')
    .then(r=>r.json())
    .then(data=>{
      availableOrders=calculateAllProductionTimes(data);
      plannedSequence=[];
      resetSchedule();
      loadSavedNames(machine);
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
  loadOrders(machine);
  Promise.resolve().then(()=>{
    // remove duplicates from available orders
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
  select.addEventListener('change',()=>loadOrders(select.value));
  document.getElementById('customOrderForm').addEventListener('submit',addCustomOrder);
  document.getElementById('generateScheduleBtn').onclick=generateSchedule;
  document.getElementById('savePlanBtn').onclick=saveCurrentPlan;
  document.getElementById('loadPlanBtn').onclick=loadSelectedPlan;
});
