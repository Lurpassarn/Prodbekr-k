// Generic machine page logic
(function(){
  const machineId = document.body.dataset.machine || "SM25";
  let isPaused = false;
  let pauseStartTime = 0;
  let totalPauseTime = 0;
  let currentShifts = { FM: [], EM: [], Natt: [] };
  let manualStops = [];

  function getSavedPlans(){
    const data = JSON.parse(localStorage.getItem("savedPlans")||"{}");
    return data[machineId] || {};
  }

  function populatePlanSelect(){
    const sel = document.getElementById("planSelect");
    if(!sel) return;
    const plans = getSavedPlans();
    sel.innerHTML = "<option value=\"\">Genererad plan</option>";
    Object.keys(plans).forEach(n=>{
      const opt=document.createElement("option");
      opt.value=n; opt.textContent=n; sel.appendChild(opt);
    });
  }

  async function loadOrders() {
    const response = await fetch(`${machineId}.json`);
    let orders = await response.json();
    const planSel = document.getElementById("planSelect");
    if(planSel && planSel.value){
      const plans = getSavedPlans();
      const plan = plans[planSel.value];
      if(plan){
        const map = {};
        orders.forEach(o=>map[o["Kundorder"]]=o);
        const ids=new Set();
        orders = plan.map(p=>{ ids.add(p["Kundorder"]); return map[p["Kundorder"]]||p; });
        Object.values(map).forEach(o=>{ if(!ids.has(o["Kundorder"])) orders.push(o); });
      }
    }
    const ordersWithTimes = calculateAllProductionTimes(orders);
    // Skiftindelning
    const shifts = { FM: [], EM: [], Natt: [] };
    const shiftLimits = { FM: 14 * 60, EM: 22.5 * 60, Natt: 30 * 60 };
    let usedMinutes = 0;
    let shiftCurrent = { FM: 6 * 60, EM: 14 * 60, Natt: 22.5 * 60 };
    for (let shiftKey of ["FM","EM","Natt"]) {
      let shiftStart = shiftCurrent[shiftKey];
      let shiftEnd = shiftLimits[shiftKey];
      for (let i=0;i<ordersWithTimes.length;i++) {
        const order = ordersWithTimes[i];
        if (order._scheduled) continue;
        const time = order.productionTimeNormal || order.productionTimeSaxning || 0;
        let realStart = shiftStart;
        let realEnd = shiftStart + time;
        if (realStart >= 1440) realStart -= 1440;
        if (realEnd >= 1440) realEnd -= 1440;
        if (shiftKey === "Natt" && !(realStart >= 1350 || realEnd <= 360)) continue;
        if (shiftStart + time > shiftEnd) continue;
        order.startTime = realStart;
        order.endTime = realEnd;
        order.shift = shiftKey;
        order.adjustedTime = time;
        order.speed = getMachineSpeed(machineId, parseFloat(order["Arklängd"]) || 0);
        shifts[shiftKey].push(order);
        order._scheduled = true;
        shiftStart = order.endTime >= 1440 ? order.endTime - 1440 : order.endTime;
        usedMinutes += time;
        if (usedMinutes >= 24 * 60) break;
      }
      if (usedMinutes >= 24 * 60) break;
    }
    // Summera per skift
    const shiftStats = {};
    Object.keys(shifts).forEach(shift => {
      const totalKg = shifts[shift].reduce((acc, order) => acc + parseFloat(order["Planerad Vikt"] || 0), 0);
      const totalOrders = shifts[shift].length;
      const totalTime = shifts[shift].reduce((acc, order) => acc + order.adjustedTime, 0);
      const kgPerHour = totalTime > 0 ? (totalKg / (totalTime / 60)) : 0;
      shiftStats[shift] = {
        totalKg,
        totalOrders,
        totalTime,
        kgPerHour,
        orders: shifts[shift]
      };
    });
    currentShifts = {
      FM: shifts.FM.map(o => ({ ...o, productionTime: o.adjustedTime })),
      EM: shifts.EM.map(o => ({ ...o, productionTime: o.adjustedTime })),
      Natt: shifts.Natt.map(o => ({ ...o, productionTime: o.adjustedTime }))
    };
    recalcSchedule();
    renderPage();
    // Rendera visuella skiftblock
    if(window.renderShiftsOverview) {
      // Patch: override renderShiftsOverview to use formatTime for order times and remove hashtag
      window.renderShiftsOverview = function(shifts) {
        const container = document.getElementById("shiftsOverview");
        container.innerHTML = "";
        // Hämta färger från CSS-variabler istället för hårdkodade värden
        const getVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
        const shiftColors = {
          FM: getVar("--shift-fm") || "#2563eb",
          EM: getVar("--shift-em") || "#60a5fa",
          Natt: getVar("--shift-natt") || "#fbbf24"
        };
        const shiftNames = { FM: "FM (06:00-14:00)", EM: "EM (14:00-22:30)", Natt: "Natt (22:30-06:00)" };
        Object.keys(shifts).forEach(shiftKey => {
            const shift = shifts[shiftKey];
            const orders = shift.orders || [];
            const maxKgPerHour = Math.max(...Object.values(shifts).map(s=>s.kgPerHour));
            const percent = maxKgPerHour ? Math.round((shift.kgPerHour/maxKgPerHour)*100) : 0;
            const color = shiftColors[shiftKey];
            const icon = shiftKey==="FM"?"🌅":shiftKey==="EM"?"🌇":"🌙";
            const shiftDiv = document.createElement("div");
            shiftDiv.className = "shift-block";
            shiftDiv.innerHTML = `
                <div class="shift-block-header" style="color:${color}">${icon} <b>${shiftNames[shiftKey]}</b></div>
                <div class="shift-progress-bar" style="background:#3b82f6">
                    <div class="shift-progress" style="width:${percent}%;background:${color}"></div>
                </div>
                <div class="shift-block-summary">
                    <span>Ordrar: <b>${shift.totalOrders}</b></span>
                    <span>KG: <b>${shift.totalKg.toFixed(1)}</b></span>
                    <span>KG/TIM: <b>${shift.kgPerHour.toFixed(2)}</b></span>
                </div>
                <div class="shift-orders-list">
                    ${orders.map(order => `
                        <div class="shift-order-card">
                          <div class="shift-order-card-content">
                            <div class="shift-order-card-left">
                              <span class="order-start">${formatTime(order.startTime)}</span>
                              <span class="order-id">${order["Kundorder"]||order["OrderID"]||""}</span>
                            </div>
                            <div class="shift-order-card-right">
                              <span class="order-weight">${order["Planerad Vikt"]||0} kg</span>
                              <span class="order-end">${formatTime(order.endTime)}</span>
                            </div>
                          </div>
                        </div>
                    `).join("")}
                </div>
            `;
            container.appendChild(shiftDiv);
        });
      };
      window.renderShiftsOverview(shiftStats);
    }
    // Summering
    renderShiftSummary(shiftStats);
    // Analys
    renderShiftAnalysis(shiftStats);
    // Skiftbar
    renderShiftBar(shifts);
  }

  function renderShiftSummary(shiftStats) {
    const container = document.getElementById("shiftSummary");
    if(!container) return;
    container.innerHTML = "";
    let html = "<h3>Summering av skift</h3>";
    Object.keys(shiftStats).forEach(shift => {
      const s = shiftStats[shift];
      html += `<div><b>${shift}</b>: Ordrar: <b>${s.totalOrders}</b>, KG: <b>${s.totalKg.toFixed(1)}</b>, KG/TIM: <b>${s.kgPerHour.toFixed(2)}</b></div>`;
    });
    container.innerHTML = html;
  }

  function renderShiftAnalysis(shiftStats) {
    const container = document.getElementById("shiftAnalysis");
    if(!container) return;
    container.innerHTML = "";
    // Dynamisk analys: jämför skift, hitta hög/låg, ge förklaring
    const statsArr = Object.entries(shiftStats).map(([k,v])=>({...v, key:k}));
    if(statsArr.length<2) return;
    const max = statsArr.reduce((a,b)=>a.kgPerHour>b.kgPerHour?a:b);
    const min = statsArr.reduce((a,b)=>a.kgPerHour<b.kgPerHour?a:b);
    let text = "";
    if(max.kgPerHour-min.kgPerHour<5) {
      text = `Alla skift har liknande produktionstakt (${max.kgPerHour.toFixed(2)} - ${min.kgPerHour.toFixed(2)} kg/tim).`;
    } else {
      text = `<b>${max.key}</b> har högst produktionstakt (${max.kgPerHour.toFixed(2)} kg/tim), <b>${min.key}</b> lägst (${min.kgPerHour.toFixed(2)} kg/tim).`;
      // Bidragande faktorer
      const factors = [];
      if(max.totalOrders<min.totalOrders) factors.push(`${max.key} har färre ordrar (${max.totalOrders}) än ${min.key} (${min.totalOrders}), vilket minskar omställningstider.`);
      if(max.totalKg>min.totalKg) factors.push(`${max.key} har högre totalvikt (${max.totalKg.toFixed(1)} kg) än ${min.key} (${min.totalKg.toFixed(1)} kg).`);
      if(max.orders.some(o=>o.isSaxning)) factors.push(`${max.key} har saxning på vissa ordrar, vilket kan öka produktionstakten.`);
      if(min.orders.some(o=>parseFloat(o["Planerad Vikt"]||0)<1000)) factors.push(`${min.key} har många små ordrar (<1 ton), vilket kan sänka produktionen.`);
      if(factors.length) text += "<br><ul><li>" + factors.join("</li><li>") + "</li></ul>";
    }
    container.innerHTML = text;
  }

  function toggleShift(shift) {
    const btn = document.querySelector(`.shift-toggle[data-shift="${shift}"]`);
    const section = document.getElementById("section-" + shift);
    const isOpen = section && section.style.display === "block";
    document.querySelectorAll(".shift-section").forEach(sec => sec.style.display="none");
    document.querySelectorAll(".shift-toggle").forEach(b => {
      b.classList.remove("active-shift");
      const arrow = b.querySelector(".shift-arrow");
      if (arrow) arrow.innerHTML = "&#9654;";
    });
    if (!isOpen) {
      section.style.display = "block";
      btn.classList.add("active-shift");
      const arrow = btn.querySelector(".shift-arrow");
      if (arrow) arrow.innerHTML = "&#9660;";
    }
  }

  function addManualStop(){
    const from=prompt("Från klockan (HH:MM)","06:00");
    if(!from) return;
    const to=prompt("Till klockan (HH:MM)","06:10");
    if(!to) return;
    const start=parseTime(from);
    const end=parseTime(to);
    if(isNaN(start)||isNaN(end)||end<=start){
      alert("Ogiltig tid");
      return;
    }
    manualStops.push({start,end});
    recalcSchedule();
    renderPage();
  }

  function formatTime(minutes){
    const h = Math.floor(minutes/60);
    const m = Math.round(minutes%60);
    return `kl ${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}`;
  }

  function showOrderCalculation(btn, order, machine){
    const resultDiv = btn.nextElementSibling;
    if(resultDiv.style.display==="block"){
      resultDiv.style.display="none";
      return;
    }
    resultDiv.style.display="block";
    const productionTimeNormal = order.productionTimeNormal || 0;
    const productionTimeSaxning = order.productionTimeSaxning || 0;
    const sheetLength = parseFloat(order["Arklängd"]) || 0;
    const rawRollWidth = order["RawRollWidth"];
    const plannedWeight = parseFloat(order["Planerad Vikt"]) || 0;
    const gramvikt = parseFloat(order["Gramvikt"]) || 0;
    const lanes = parseFloat(order["Antal banor"]) || 1;
    if(!sheetLength || !rawRollWidth || !plannedWeight || !gramvikt){
      resultDiv.innerHTML = "<span style='color:#b91c1c'><strong>Kan inte visa uträkning:</strong> Saknar nödvändig data.</span>";
      return;
    }
    const speed = getMachineSpeed(machine, sheetLength);
    const rawRollWidthFirst = parseFloat((rawRollWidth+"").split(",")[0]);
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
    function fm(mins){ const h=Math.floor(mins/60);const m=Math.round(mins%60);return h+" h "+m.toString().padStart(2,"0")+" min"; }
    let comparisonText = order.isSaxning ? `<em>Jämförelse: Normal tid: ${fm(productionTimeNormal)}, Saxning: ${fm(productionTimeSaxning)}</em>` : `<em>Normal tid: ${fm(productionTimeNormal)}</em>`;
    const steps = [
      {title:"Längd (L)",desc:"Beräknar den totala längden papper som ska produceras utifrån vikt, gramvikt och råvalsbredd.",formula:`L = (Planerad Vikt × 1 000 000) / (Gramvikt × RawRollWidth)${lanes>1?" / Antal banor":""}`,values:lengthFormula,result:`<b>${L_per_lane.toFixed(2)} m</b>`},
      {title:"Produktionstid",desc:"Beräknar hur lång tid det tar att producera längden L med aktuell maskinhastighet.",formula:"Produktionstid = L / Hastighet",values:`${L_per_lane.toFixed(2)} / ${speed.toFixed(2)}`,result:`<b>${fm(productionTimeMinutes)}</b>`},
      {title:"Stopptid",desc:"Summerar planerade stopp (t.ex. rullbyten) för ordern.",formula:"Stopptid (från script)",values:`${stopObj.normalStopTime} sek = ${(stopTime).toFixed(2)} min`,result:`<b>${fm(stopTime)}</b>`},
      {title:"Total tid",desc:"Lägger ihop produktionstid och stopptid för att få orderns totala körtid.",formula:"Produktionstid + Stopptid",values:`${fm(productionTimeMinutes)} + ${fm(stopTime)}`,result:`<b>${fm(totalTime)}</b>`}
    ];
    resultDiv.innerHTML = `<div class="calc-steps-horizontal">${steps.map((step,i)=>`<div class="calc-step-big" data-step="${i}"><div class="calc-step-header-big"><span class="calc-step-title">${i+1}. ${step.title}</span><span class="calc-step-arrow-big">&#9654;</span></div><div class="calc-step-content-big"><div class="calc-step-desc">${step.desc}</div><div class="calc-step-formula"><b>Formel:</b> ${step.formula}</div><div class="calc-step-values"><b>Värden:</b> ${step.values}</div><div class="calc-step-result"><b>Resultat:</b> ${step.result}</div></div></div>`).join("")}</div><div style="margin-top:16px; color:#555; font-size:1.08em;">${comparisonText}</div>`;
    const stepDivs = resultDiv.querySelectorAll(".calc-step-big");
    stepDivs.forEach((div,idx)=>{
      const content = div.querySelector(".calc-step-content-big");
      const arrow = div.querySelector(".calc-step-arrow-big");
      content.style.display="none";
      div.addEventListener("click",e=>{
        stepDivs.forEach((other,j)=>{
          const c=other.querySelector(".calc-step-content-big");
          const a=other.querySelector(".calc-step-arrow-big");
          if(j===idx){
            const open=c.style.display==="block";
            c.style.display=open?"none":"block";
            a.style.transform=open?"rotate(0deg)":"rotate(90deg)";
          } else {
            c.style.display="none";
            a.style.transform="rotate(0deg)";
          }
        });
        e.stopPropagation();
      });
    });
  }

  function parseTime(str){
    const [h,m] = str.split(":").map(n=>parseInt(n,10));
    if(isNaN(h) || isNaN(m)) return NaN;
    return h*60 + m;
  }

  function analyzeShiftOrders(list){
    const issues=[];
    const weights=list.map(o=>parseFloat(o["Planerad Vikt"]||0));
    const small=weights.filter(w=>w && w<1000).length;
    if(list.length>8) issues.push("Många ordrar kan ge långa omställningar");
    if(small>list.length/2) issues.push("Hög andel små ordrar (<1 ton)");
    const lengths=new Set(list.map(o=>parseFloat(o["Arklängd"])||0));
    if(lengths.size>3) issues.push("Stor variation i arklängd");
    return issues;
  }

  function recalcSchedule(){
    const starts={FM:6*60,EM:14*60,Natt:22.5*60};
    ["FM","EM","Natt"].forEach(s=>{
      let current=starts[s];
      currentShifts[s].forEach(o=>{
        let start=current;
        let end=start+o.productionTime;
        manualStops.forEach(st=>{
          if(st.end<=start||st.start>=end) return;
          if(st.start<=start){ start=st.end; end=start+o.productionTime; }
          else if(st.start<end){ end+=st.end-st.start; }
        });
        o.startTime=start%1440;
        o.endTime=end%1440;
        current=end;
      });
    });
  }

  function renderPage(){
    const ordersContainer=document.getElementById("ordersContainer");
    ordersContainer.innerHTML="";
    const shiftNames={FM:"FM-Skift",EM:"EM-Skift",Natt:"Natt-Skift"};
    Object.keys(currentShifts).forEach(shift=>{
      const btn=document.createElement("button");
      btn.className="shift-toggle";
      btn.innerHTML=`<span class="shift-arrow">&#9654;</span> ${shiftNames[shift]}`;
      btn.dataset.shift=shift;
      btn.addEventListener("click",()=>toggleShift(shift));
      ordersContainer.appendChild(btn);

      const summary=document.createElement("div");
      summary.className="shift-summary";
      const totalKg=currentShifts[shift].reduce((a,o)=>a+parseFloat(o["Planerad Vikt"]||0),0);
      const totalOrders=currentShifts[shift].length;
      const totalTime=currentShifts[shift].reduce((a,o)=>a+o.productionTime,0);
      const kgPerHour=totalTime>0?(totalKg/(totalTime/60)):0;
      summary.innerHTML=`<h3>Summering för ${shiftNames[shift]}:</h3><p>Planerad produktion: ${totalKg.toFixed(2)} kg</p><p>Körda ordrar: ${totalOrders}</p><p>Summa KG/TIM: ${kgPerHour.toFixed(2)}</p>`;
      ordersContainer.appendChild(summary);

      const section=document.createElement("div");
      section.className="shift-section shift-wrapper";
      section.id="section-"+shift;
      section.style.display="none";

      const analysis=analyzeShiftOrders(currentShifts[shift]);
      if(analysis.length){
        const a=document.createElement("div");
        a.className="analysis-box";
        a.innerHTML="<b>Analys:</b><ul>"+analysis.map(t=>`<li>${t}</li>`).join("")+"</ul>";
        section.appendChild(a);
      }

      const list=document.createElement("div");
      list.className="orders-list";
      list.dataset.shift=shift;
      list.addEventListener("dragover",e=>{
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      list.addEventListener("drop",e=>{
        e.preventDefault();
        e.stopPropagation();
        const fromShift=e.dataTransfer.getData("shift");
        const fromIdx=parseInt(e.dataTransfer.getData("index"),10);
        if(!fromShift) return;
        const item=currentShifts[fromShift].splice(fromIdx,1)[0];
        currentShifts[shift].push(item);
        recalcSchedule();
        renderPage();
      });

      currentShifts[shift].forEach((o,idx)=>{
        const d=document.createElement("div");
        d.className="order-row";
        d.dataset.index=idx;
        d.draggable=true;
        d.addEventListener("dragstart",ev=>{
          ev.dataTransfer.effectAllowed = "move";
          // Some browsers require text data for drag to start
          ev.dataTransfer.setData("text/plain", "");
          ev.dataTransfer.setData("shift", shift);
          ev.dataTransfer.setData("index", idx);
        });
        d.addEventListener("dragover",ev=>{
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
          d.classList.add("drag-over");
        });
        d.addEventListener("dragleave",()=>{ d.classList.remove("drag-over"); });
        d.addEventListener("drop",ev=>{
          ev.preventDefault();
          ev.stopPropagation();
          ev.dataTransfer.dropEffect = "move";
          d.classList.remove("drag-over");
          const fromShift=ev.dataTransfer.getData("shift");
          const fromIdx=parseInt(ev.dataTransfer.getData("index"),10);
          if(!fromShift) return;
          let toIdx=parseInt(d.dataset.index,10);
          const item=currentShifts[fromShift].splice(fromIdx,1)[0];
          if(fromShift===shift && fromIdx<toIdx) toIdx--;
          currentShifts[shift].splice(toIdx,0,item);
          recalcSchedule();
          renderPage();
        });
        d.addEventListener("dragover",ev=>{ ev.preventDefault(); d.classList.add("drag-over"); });
        d.addEventListener("dragleave",()=>{ d.classList.remove("drag-over"); });
        d.addEventListener("drop",ev=>{
          ev.preventDefault();
          d.classList.remove("drag-over");
          const fromShift=ev.dataTransfer.getData("shift");
          const fromIdx=parseInt(ev.dataTransfer.getData("index"),10);
          if(!fromShift) return;
          let toIdx=parseInt(d.dataset.index,10);
          const item=currentShifts[fromShift].splice(fromIdx,1)[0];
          if(fromShift===shift && fromIdx<toIdx) toIdx--;
          currentShifts[shift].splice(toIdx,0,item);
          recalcSchedule();
          renderPage();
        });
        d.innerHTML=`<div class="order-summary"><span>${o["Kundorder"]||"Okänd"}</span><span>${(o["Planerad Vikt"]||0).toFixed(1)} kg</span><span>${o["Arklängd"]||"?"} mm</span><span>${o.speed.toFixed(0)} m/min</span><span>${formatTime(o.startTime)} - ${formatTime(o.endTime)}</span></div><div class="calc-result" style="display:none;"></div>`;
        d.querySelector(".order-summary").addEventListener("click",function(){showOrderCalculation(this,o,machineId);});
        list.appendChild(d);
        manualStops.forEach((st,si)=>{
          if(st.start>=o.startTime && st.start<o.endTime){
            const sdiv=document.createElement("div");
            sdiv.className="manual-stop";
            sdiv.innerHTML=`Stopp ${formatTime(st.start)}-${formatTime(st.end)} <button data-i='${si}'>X</button>`;
            sdiv.querySelector("button").onclick=()=>{manualStops.splice(si,1);recalcSchedule();renderPage();};
            list.appendChild(sdiv);
          }
        });
      });
      section.appendChild(list);
      ordersContainer.appendChild(section);
    });

    renderShiftBar(currentShifts);
  }

  function renderShiftBar(shifts){
    const container=document.getElementById("shiftBarContainer");
    if(!container) return;
    container.innerHTML="";
    const totalKg=Object.keys(shifts).reduce((a,key)=>a+shifts[key].reduce((x,o)=>x+parseFloat(o["Planerad Vikt"]||0),0),0);
    if(totalKg===0) return;
    const barWrapper=document.createElement("div");
    barWrapper.className="shift-bar";
    Object.keys(shifts).forEach(shift=>{
      const shiftData=shifts[shift];
      const shiftTotalKg=shiftData.reduce((a,o)=>a+parseFloat(o["Planerad Vikt"]||0),0);
      const percent=totalKg>0?(shiftTotalKg/totalKg)*100:0;
      const seg=document.createElement("div");
      seg.className="shift-bar-segment-horizontal";
      seg.dataset.shift=shift;
      seg.style.width=percent+"%";
      seg.style.backgroundColor=shiftColors[shift];
      seg.title=`${shiftNames[shift]}: ${shiftTotalKg.toFixed(1)} kg (${percent.toFixed(1)}%)`;
      seg.innerHTML=`<span class="shift-bar-label-horizontal">${shiftNames[shift]}<br><b>${shiftTotalKg.toFixed(1)} kg</b><br><span class='shift-bar-percent'>${percent.toFixed(1)}%</span></span>`;
      seg.onclick=()=>toggleShift(shift);
      barWrapper.appendChild(seg);
    });
    container.appendChild(barWrapper);
    const legend=document.createElement("div");
    legend.className="shift-bar-legend-horizontal";
    legend.innerHTML=Object.keys(shifts).map(s=>`<span class="shift-bar-legend-item"><span class="shift-bar-legend-color" style="background:${shiftColors[s]}"></span>${shiftNames[s]}</span>`).join("");
    container.appendChild(legend);
  }

  window.addManualStop=addManualStop;
  document.addEventListener("DOMContentLoaded", () => {
    populatePlanSelect();
    const sel = document.getElementById("planSelect");
    if(sel) sel.addEventListener("change", loadOrders);
    const stopBtn=document.getElementById("manualStopBtn");
    if(stopBtn) stopBtn.addEventListener("click", addManualStop);
    loadOrders();
  });
})();
