// Generic machine page logic
(function(){
  const machineId = document.body.dataset.machine || 'SM25';
  let isPaused = false;
  let pauseStartTime = 0;
  let totalPauseTime = 0;

  function getSavedPlans(){
    const data = JSON.parse(localStorage.getItem('savedPlans')||'{}');
    return data[machineId] || {};
  }

  function populatePlanSelect(){
    const sel = document.getElementById('planSelect');
    if(!sel) return;
    const plans = getSavedPlans();
    sel.innerHTML = '<option value="">Genererad plan</option>';
    Object.keys(plans).forEach(n=>{
      const opt=document.createElement('option');
      opt.value=n; opt.textContent=n; sel.appendChild(opt);
    });
  }

  async function loadOrders() {
    const response = await fetch(`${machineId}.json`);
    let orders = await response.json();
    const planSel = document.getElementById('planSelect');
    if(planSel && planSel.value){
      const plans = getSavedPlans();
      const plan = plans[planSel.value];
      if(plan){
        const map = {};
        orders.forEach(o=>map[o['Kundorder']]=o);
        const ids=new Set();
        orders = plan.map(p=>{ ids.add(p['Kundorder']); return map[p['Kundorder']]||p; });
        Object.values(map).forEach(o=>{ if(!ids.has(o['Kundorder'])) orders.push(o); });
      }
    }
    const ordersWithTimes = calculateAllProductionTimes(orders);
    const ordersContainer = document.getElementById('ordersContainer');
    ordersContainer.innerHTML = '';
    const shifts = { FM: [], EM: [], Natt: [] };
    const shiftLimits = { FM: 14 * 60, EM: 22.5 * 60, Natt: 30 * 60 };
    let usedMinutes = 0;
    let shiftCurrent = { FM: 6 * 60, EM: 14 * 60, Natt: 22.5 * 60 };
    for (let shiftKey of ['FM','EM','Natt']) {
      let shiftStart = shiftCurrent[shiftKey];
      let shiftEnd = shiftLimits[shiftKey];
      for (let i=0;i<ordersWithTimes.length;i++) {
        const order = ordersWithTimes[i];
        if (order._scheduled) continue;
        const time = order.productionTimeNormal || order.productionTimeSaxning || 0;
        const adjustedTime = isPaused ? time + (totalPauseTime / 60) : time;
        let realStart = shiftStart;
        let realEnd = shiftStart + adjustedTime;
        if (realStart >= 1440) realStart -= 1440;
        if (realEnd >= 1440) realEnd -= 1440;
        if (shiftKey === 'Natt' && !(realStart >= 1350 || realEnd <= 360)) continue;
        if (shiftStart + adjustedTime > shiftEnd) continue;
        order.startTime = realStart;
        order.endTime = realEnd;
        order.shift = shiftKey;
        order.adjustedTime = adjustedTime;
        order.productionTime = time;
        order.isSaxning = (parseFloat(order['RawRollWidth'] || '0') <= 1035 && estimateRollCount(order) >= 2);
        order.isProfitable = order.isSaxning ? (order.productionTimeSaxning < order.productionTimeNormal) : false;
        shifts[shiftKey].push(order);
        order._scheduled = true;
        shiftStart = order.endTime >= 1440 ? order.endTime - 1440 : order.endTime;
        usedMinutes += adjustedTime;
        if (usedMinutes >= 24 * 60) break;
      }
      if (usedMinutes >= 24 * 60) break;
    }

    const shiftNames = { FM: 'FM-Skift', EM: 'EM-Skift', Natt: 'Natt-Skift' };

    function analyzeShiftOrders(list){
      const issues = [];
      const weights = list.map(o=>parseFloat(o['Planerad Vikt']||0));
      const smallOrders = weights.filter(w=>w && w<1000).length;
      if(list.length>8) issues.push('Många ordrar kan ge långa omställningar');
      if(smallOrders>list.length/2) issues.push('Hög andel små ordrar (<1 ton)');
      const lengths = new Set(list.map(o=>parseFloat(o['Arklängd'])||0));
      if(lengths.size>3) issues.push('Stor variation i arklängd');
      return issues;
    }
    Object.keys(shifts).forEach(shift => {
      const btn = document.createElement('button');
      btn.className = 'shift-toggle';
      btn.innerHTML = `<span class="shift-arrow">&#9654;</span> ${shiftNames[shift]}`;
      btn.dataset.shift = shift;
      btn.addEventListener('click', () => toggleShift(shift));
      ordersContainer.appendChild(btn);

      const shiftSummary = document.createElement('div');
      shiftSummary.className = 'shift-summary';
      const totalKg = shifts[shift].reduce((acc,o)=>acc+parseFloat(o['Planerad Vikt']||0),0);
      const totalOrders = shifts[shift].length;
      const totalTime = shifts[shift].reduce((acc,o)=>acc+o.adjustedTime,0);
      const kgPerHour = totalTime>0 ? (totalKg/(totalTime/60)) : 0;
      shiftSummary.innerHTML = `
        <h3>Summering för ${shiftNames[shift]}:</h3>
        <p>Planerad produktion: ${totalKg.toFixed(2)} kg</p>
        <p>Körda ordrar: ${totalOrders}</p>
        <p>Summa KG/TIM: ${kgPerHour.toFixed(2)}</p>`;
      ordersContainer.appendChild(shiftSummary);

      const shiftDiv = document.createElement('div');
      shiftDiv.className = 'shift-section shift-wrapper';
      shiftDiv.id = 'section-' + shift;
      shiftDiv.style.display = 'none';

      const analysis = analyzeShiftOrders(shifts[shift]);
      if(analysis.length){
        const aBox=document.createElement('div');
        aBox.className='analysis-box';
        aBox.innerHTML='<b>Analys:</b><ul>'+analysis.map(t=>`<li>${t}</li>`).join('')+'</ul>';
        shiftDiv.appendChild(aBox);
      }

      const ordersList = document.createElement('div');
      ordersList.className = 'orders-list';
      shifts[shift].forEach(order => {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-row';
        orderDiv.innerHTML = `
          <div class="order-summary">
            <span>${order['Kundorder'] || 'Okänd'}</span>
            <span>${(order['Planerad Vikt'] || 0).toFixed(1)} kg</span>
            <span>${formatTime(order.startTime)} - ${formatTime(order.endTime)}</span>
          </div>
          <div class="calc-result" style="display:none;"></div>`;
        orderDiv.querySelector('.order-summary').addEventListener('click', function(){
          showOrderCalculation(this, order, machineId);
        });
        ordersList.appendChild(orderDiv);
      });
      shiftDiv.appendChild(ordersList);
      ordersContainer.appendChild(shiftDiv);
    });

    renderShiftBar(shifts);
  }

  function toggleShift(shift) {
    const btn = document.querySelector(`.shift-toggle[data-shift="${shift}"]`);
    const section = document.getElementById('section-' + shift);
    const isOpen = section && section.style.display === 'block';
    document.querySelectorAll('.shift-section').forEach(sec => sec.style.display='none');
    document.querySelectorAll('.shift-toggle').forEach(b => {
      b.classList.remove('active-shift');
      const arrow = b.querySelector('.shift-arrow');
      if (arrow) arrow.innerHTML = '&#9654;';
    });
    if (!isOpen) {
      section.style.display = 'block';
      btn.classList.add('active-shift');
      const arrow = btn.querySelector('.shift-arrow');
      if (arrow) arrow.innerHTML = '&#9660;';
    }
  }

  function addStop(){
    if(!isPaused){
      isPaused = true;
      pauseStartTime = Date.now();
      document.getElementById('stopInfo').textContent = 'Stopp pausat, klicka igen för att återuppta.';
    } else {
      const pauseEndTime = Date.now();
      const pauseDuration = (pauseEndTime - pauseStartTime) / 60000;
      totalPauseTime += pauseDuration;
      isPaused = false;
      document.getElementById('stopInfo').textContent = `Stopp återupptaget, paus: ${pauseDuration.toFixed(2)} min. Omräknat.`;
      loadOrders();
    }
  }

  function formatTime(minutes){
    const h = Math.floor(minutes/60);
    const m = Math.round(minutes%60);
    return `kl ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  function showOrderCalculation(btn, order, machine){
    const resultDiv = btn.nextElementSibling;
    if(resultDiv.style.display==='block'){
      resultDiv.style.display='none';
      return;
    }
    resultDiv.style.display='block';
    const productionTimeNormal = order.productionTimeNormal || 0;
    const productionTimeSaxning = order.productionTimeSaxning || 0;
    const sheetLength = parseFloat(order['Arklängd']) || 0;
    const rawRollWidth = order['RawRollWidth'];
    const plannedWeight = parseFloat(order['Planerad Vikt']) || 0;
    const gramvikt = parseFloat(order['Gramvikt']) || 0;
    const lanes = parseFloat(order['Antal banor']) || 1;
    if(!sheetLength || !rawRollWidth || !plannedWeight || !gramvikt){
      resultDiv.innerHTML = `<span style='color:#b91c1c'><strong>Kan inte visa uträkning:</strong> Saknar nödvändig data.</span>`;
      return;
    }
    const speed = getMachineSpeed(machine, sheetLength);
    const rawRollWidthFirst = parseFloat((rawRollWidth+'').split(',')[0]);
    let L = (plannedWeight * 1000000) / (gramvikt * rawRollWidthFirst);
    let L_per_lane = L;
    let lengthFormula = `(${plannedWeight} × 1 000 000) / (${gramvikt} × ${rawRollWidthFirst})`;
    if(lanes>1){
      L_per_lane = L / lanes;
      lengthFormula += ` / ${lanes}`;
    }
    const productionTimeMinutes = L_per_lane / speed;
    const stopObj = calculateStopTimes(order);
    const stopTime = stopObj.normalStopTime / 60;
    const totalTime = productionTimeMinutes + stopTime;
    function fm(mins){ const h=Math.floor(mins/60);const m=Math.round(mins%60);return h+' h '+m.toString().padStart(2,'0')+' min'; }
    let comparisonText = order.isSaxning ? `<em>Jämförelse: Normal tid: ${fm(productionTimeNormal)}, Saxning: ${fm(productionTimeSaxning)}</em>` : `<em>Normal tid: ${fm(productionTimeNormal)}</em>`;
    const steps = [
      {title:'Längd (L)',desc:'Beräknar den totala längden papper som ska produceras utifrån vikt, gramvikt och råvalsbredd.',formula:`L = (Planerad Vikt × 1 000 000) / (Gramvikt × RawRollWidth)${lanes>1?' / Antal banor':''}`,values:lengthFormula,result:`<b>${L_per_lane.toFixed(2)} m</b>`},
      {title:'Produktionstid',desc:'Beräknar hur lång tid det tar att producera längden L med aktuell maskinhastighet.',formula:'Produktionstid = L / Hastighet',values:`${L_per_lane.toFixed(2)} / ${speed.toFixed(2)}`,result:`<b>${fm(productionTimeMinutes)}</b>`},
      {title:'Stopptid',desc:'Summerar planerade stopp (t.ex. rullbyten) för ordern.',formula:'Stopptid (från script)',values:`${stopObj.normalStopTime} sek = ${(stopTime).toFixed(2)} min`,result:`<b>${fm(stopTime)}</b>`},
      {title:'Total tid',desc:'Lägger ihop produktionstid och stopptid för att få orderns totala körtid.',formula:'Produktionstid + Stopptid',values:`${fm(productionTimeMinutes)} + ${fm(stopTime)}`,result:`<b>${fm(totalTime)}</b>`}
    ];
    resultDiv.innerHTML = `<div class="calc-steps-horizontal">${steps.map((step,i)=>`<div class="calc-step-big" data-step="${i}"><div class="calc-step-header-big"><span class="calc-step-title">${i+1}. ${step.title}</span><span class="calc-step-arrow-big">&#9654;</span></div><div class="calc-step-content-big"><div class="calc-step-desc">${step.desc}</div><div class="calc-step-formula"><b>Formel:</b> ${step.formula}</div><div class="calc-step-values"><b>Värden:</b> ${step.values}</div><div class="calc-step-result"><b>Resultat:</b> ${step.result}</div></div></div>`).join('')}</div><div style="margin-top:16px; color:#555; font-size:1.08em;">${comparisonText}</div>`;
    const stepDivs = resultDiv.querySelectorAll('.calc-step-big');
    stepDivs.forEach((div,idx)=>{
      const content = div.querySelector('.calc-step-content-big');
      const arrow = div.querySelector('.calc-step-arrow-big');
      content.style.display='none';
      div.addEventListener('click',e=>{
        stepDivs.forEach((other,j)=>{
          const c=other.querySelector('.calc-step-content-big');
          const a=other.querySelector('.calc-step-arrow-big');
          if(j===idx){
            const open=c.style.display==='block';
            c.style.display=open?'none':'block';
            a.style.transform=open?'rotate(0deg)':'rotate(90deg)';
          } else {
            c.style.display='none';
            a.style.transform='rotate(0deg)';
          }
        });
        e.stopPropagation();
      });
    });
  }

  function renderShiftBar(shifts){
    const container=document.getElementById('shiftBarContainer');
    if(!container) return;
    container.innerHTML='';
    const totalKg=Object.keys(shifts).reduce((a,key)=>a+shifts[key].reduce((x,o)=>x+parseFloat(o['Planerad Vikt']||0),0),0);
    if(totalKg===0) return;
    const shiftColors={FM:'#2563eb',EM:'#60a5fa',Natt:'#64748b'};
    const shiftNames={FM:'FM-Skift',EM:'EM-Skift',Natt:'Natt-Skift'};
    const barWrapper=document.createElement('div');
    barWrapper.className='shift-bar';
    Object.keys(shifts).forEach(shift=>{
      const shiftData=shifts[shift];
      const shiftTotalKg=shiftData.reduce((a,o)=>a+parseFloat(o['Planerad Vikt']||0),0);
      const percent=totalKg>0?(shiftTotalKg/totalKg)*100:0;
      const seg=document.createElement('div');
      seg.className='shift-bar-segment-horizontal';
      seg.dataset.shift=shift;
      seg.style.width=percent+'%';
      seg.style.backgroundColor=shiftColors[shift];
      seg.title=`${shiftNames[shift]}: ${shiftTotalKg.toFixed(1)} kg (${percent.toFixed(1)}%)`;
      seg.innerHTML=`<span class="shift-bar-label-horizontal">${shiftNames[shift]}<br><b>${shiftTotalKg.toFixed(1)} kg</b><br><span class='shift-bar-percent'>${percent.toFixed(1)}%</span></span>`;
      seg.onclick=()=>toggleShift(shift);
      barWrapper.appendChild(seg);
    });
    container.appendChild(barWrapper);
    const legend=document.createElement('div');
    legend.className='shift-bar-legend-horizontal';
    legend.innerHTML=Object.keys(shifts).map(s=>`<span class="shift-bar-legend-item"><span class="shift-bar-legend-color" style="background:${shiftColors[s]}"></span>${shiftNames[s]}</span>`).join('');
    container.appendChild(legend);
  }

  window.addStop=addStop;
  document.addEventListener('DOMContentLoaded', () => {
    populatePlanSelect();
    const sel = document.getElementById('planSelect');
    if(sel) sel.addEventListener('change', loadOrders);
    loadOrders();
  });
})();
