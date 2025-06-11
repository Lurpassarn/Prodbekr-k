// Generic machine page logic - Updated version with static shifts
(function(){
  const machineId = document.body.dataset.machine || "SM25";
  let isPaused = false;
  let pauseStartTime = 0;
  let totalPauseTime = 0;  let currentShifts = { FM: [], EM: [], Natt: [] };
  let manualStops = [];
  let overflowOrders = []; // Orders that don't fit in any shift

  // Expose functions and variables globally for cross-machine transfer
  window.currentShifts = currentShifts;
  window.recalcSchedule = recalcSchedule;
  window.renderPage = renderPage;
  window.loadOrders = loadOrders;

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
  }  async function loadOrders() {
    try {
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
      Natt: shifts.Natt.map(o => ({ ...o, productionTime: o.adjustedTime }))    };
    recalcSchedule();
    checkAndHandleOverflow(); // Check for overflow orders after initial scheduling
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
    renderShiftSummary(shiftStats);    // Analys
    renderShiftAnalysis(shiftStats);    // Skiftbar
    renderShiftBar(shifts);
    
    } catch (error) {
      console.error('Error in loadOrders:', error);
      // Show error to user
      const container = document.getElementById('ordersContainer');
      if (container) {
        container.innerHTML = `<div style="color: red; padding: 20px;">
          <h3>Fel vid laddning av data</h3>
          <p>Kunde inte ladda orderdata för ${machineId}. Kontrollera att ${machineId}.json finns.</p>
          <pre>${error.message}</pre>
        </div>`;
      }
    }
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
    const starts = { FM: 6 * 60, EM: 14 * 60, Natt: 22.5 * 60 }; // När skiften startar
    const limits = { FM: 14 * 60, EM: 22.5 * 60, Natt: 30 * 60 }; // När skiften slutar (30*60 = 06:00 nästa dag)
    
    // Calculate times for each shift independently
    Object.keys(currentShifts).forEach(shift => {
      let currentTime = starts[shift];
      const shiftEndTime = limits[shift];
      
      // Calculate start/end times for all orders in this shift
      currentShifts[shift].forEach((order, index) => {
        let orderStart = currentTime;
        let orderEnd = orderStart + order.productionTime;
        
        // Apply manual stops that affect this order
        manualStops.forEach(st => {
          if(st.end <= orderStart || st.start >= orderEnd) return;
          if(st.start <= orderStart) { 
            orderStart = st.end; 
            orderEnd = orderStart + order.productionTime; 
          } else if(st.start < orderEnd) { 
            orderEnd += st.end - st.start; 
          }
        });
        
        // Handle day boundary for Natt shift (can cross midnight)
        if (shift === 'Natt') {
          order.startTime = orderStart % 1440;
          order.endTime = orderEnd % 1440;
        } else {
          order.startTime = orderStart;
          order.endTime = orderEnd;
        }
        
        // Mark if this order exceeds shift capacity
        if (orderEnd > shiftEndTime) {
          order._exceedsCapacity = true;
        } else {
          order._exceedsCapacity = false;
        }
        
        currentTime = orderEnd; // Next order starts when this one ends
      });
    });
    
    // Update global reference
    window.currentShifts = currentShifts;
  }  function renderPage(){
    const ordersContainer=document.getElementById("ordersContainer");
    if (!ordersContainer) {
      console.error('ordersContainer not found!');
      return;
    }
    ordersContainer.innerHTML="";
    
    // Create always visible orders container with header
    const ordersWrapper = document.createElement("div");
    ordersWrapper.className = "orders-wrapper";
    ordersWrapper.innerHTML = `
      <div class="orders-header">
        <h3>📋 Produktionsordrar</h3>
        <p>Alla skift visas nedan. Dra och släpp ordrar för att ändra ordningen.</p>
      </div>
    `;    ordersContainer.appendChild(ordersWrapper);
    
    // Create shifts container for horizontal layout
    const shiftsContainer = document.createElement("div");
    shiftsContainer.className = "shifts-container";
    ordersWrapper.appendChild(shiftsContainer);
    
    const shiftNames={FM:"🌅 FM-Skift (06:00-14:00)",EM:"🌇 EM-Skift (14:00-22:30)",Natt:"🌙 Natt-Skift (22:30-06:00)"};
    
    Object.keys(currentShifts).forEach(shift=>{
      // Create static shift container (no toggle functionality)
      const shiftContainer = document.createElement("div");
      shiftContainer.className = "shift-container-static";
      
      const shiftHeader=document.createElement("div");
      shiftHeader.className="shift-header-static";
      shiftHeader.innerHTML=`<h4>${shiftNames[shift]}</h4>`;
      
      const summary=document.createElement("div");
      summary.className="shift-summary";
      const totalKg=currentShifts[shift].reduce((a,o)=>a+parseFloat(o["Planerad Vikt"]||0),0);
      const totalOrders=currentShifts[shift].length;
      const totalTime=currentShifts[shift].reduce((a,o)=>a+o.productionTime,0);
      const kgPerHour=totalTime>0?(totalKg/(totalTime/60)):0;
      summary.innerHTML=`<div class="shift-stats">
        <span><strong>Planerad produktion:</strong> ${totalKg.toFixed(2)} kg</span>
        <span><strong>Körda ordrar:</strong> ${totalOrders}</span>
        <span><strong>KG/TIM:</strong> ${kgPerHour.toFixed(2)}</span>
      </div>`;
        // Always visible section (no display:none or toggle)
      const section=document.createElement("div");
      section.className="shift-section-static shift-wrapper";
      section.id="section-"+shift;

      const list=document.createElement("div");
      list.className="orders-list";
      list.dataset.shift=shift;
      
      // Enhanced drag-and-drop for the entire list
      list.addEventListener("dragover",e=>{
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        list.classList.add("drag-target");
        
        // Find the right position for placeholder with our helper function
        const afterElement = getDragAfterElement(list, e.clientY);
        const placeholder = document.querySelector('.drag-placeholder') || createDragPlaceholder();
        
        if (afterElement == null) {
          list.appendChild(placeholder);
        } else {
          list.insertBefore(placeholder, afterElement);
        }
        
        // Update position for ghost element if it exists
        updateDragGhostPosition(document.querySelector('.drag-ghost'), e);
      });
      
      list.addEventListener("dragleave",(e)=>{
        if (!list.contains(e.relatedTarget)) {
          list.classList.remove("drag-target");
          removeDragPlaceholder();
        }
      });
      
      list.addEventListener("dragenter", e => {
        e.preventDefault();
        list.classList.add("active-drop-target");
      });
      
      list.addEventListener("drop",e=>{
        e.preventDefault();
        e.stopPropagation();
        list.classList.remove("drag-target");
        list.classList.remove("active-drop-target");
        removeDragPlaceholder();
        removeDragGhost();
        
        const fromShift=e.dataTransfer.getData("shift");
        const fromIdx=parseInt(e.dataTransfer.getData("index"),10);
        if(!fromShift) return;
        
        const afterElement = getDragAfterElement(list, e.clientY);
        let toIdx = afterElement ? Array.from(list.children).indexOf(afterElement) : list.children.length;
        
        const item=currentShifts[fromShift].splice(fromIdx,1)[0];
        if(fromShift === shift && fromIdx < toIdx) toIdx--;
        
        currentShifts[shift].splice(toIdx, 0, item);
        recalcSchedule();
        renderPage();
      });

      currentShifts[shift].forEach((o,idx)=>{
        const orderDiv=document.createElement("div");
        orderDiv.className="order-row";
        orderDiv.dataset.index=idx;
        orderDiv.draggable=true;
        
        orderDiv.addEventListener("dragstart",ev=>{
          ev.dataTransfer.effectAllowed = "move";
          // Some browsers require text data for drag to start
          ev.dataTransfer.setData("text/plain", "");
          ev.dataTransfer.setData("shift", shift);
          ev.dataTransfer.setData("index", idx);
          
          // Visual feedback
          setTimeout(() => {
            orderDiv.classList.add("dragging");
          }, 0);
          
          // Mark all potential drop zones
          highlightDropzones(true);
          
          // Create a ghost that follows the mouse cursor
          const ghost = createDragGhost(orderDiv);
          
          // Set ghost in the right starting position
          updateDragGhostPosition(ghost, ev);
        });
        
        orderDiv.addEventListener("dragend",ev=>{
          orderDiv.classList.remove("dragging");
          highlightDropzones(false);
          removeDragGhost();
          
          // Remove all drag-over classes and placeholders
          document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
          document.querySelectorAll(".active-drop-target").forEach(el => el.classList.remove("active-drop-target"));
          removeDragPlaceholder();
        });
        
        orderDiv.addEventListener("dragover",ev=>{
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
          orderDiv.classList.add("drag-over");
        });
        
        orderDiv.addEventListener("dragleave",()=>{ 
          orderDiv.classList.remove("drag-over"); 
        });
        
        orderDiv.addEventListener("drop",ev=>{
          ev.preventDefault();
          ev.stopPropagation();
          orderDiv.classList.remove("drag-over");
          
          const fromShift=ev.dataTransfer.getData("shift");
          const fromIdx=parseInt(ev.dataTransfer.getData("index"),10);
          if(!fromShift) return;
          
          let toIdx=parseInt(orderDiv.dataset.index,10);
          const item=currentShifts[fromShift].splice(fromIdx,1)[0];
          if(fromShift===shift && fromIdx<toIdx) toIdx--;
          
          currentShifts[shift].splice(toIdx,0,item);
          recalcSchedule();
          renderPage();
        });        // Beräkna tidsåtgång i HH:MM format
        const totalMinutes = Math.round(o.productionTime);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const timeDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}H`;
          orderDiv.innerHTML=`
          <div class="order-card">            <div class="order-card-header">
              <div class="order-id">${o["Kundorder"]||"Okänd"}</div>
              <div class="order-time">${formatTime(o.startTime)} - ${formatTime(o.endTime)}</div>
            </div>
            <div class="order-card-content" style="display:none;">
              <div class="order-detail">
                <span class="detail-label">Vikt</span>
                <span class="detail-value">${(o["Planerad Vikt"]||0).toFixed(1)} kg</span>
              </div>
              <div class="order-detail">
                <span class="detail-label">Arklängd</span>
                <span class="detail-value">${o["Arklängd"]||"?"} mm</span>
              </div>
              <div class="order-detail">
                <span class="detail-label">Hastighet</span>
                <span class="detail-value">${o.speed.toFixed(0)} m/min</span>
              </div>
              <div class="order-detail">
                <span class="detail-label">Tompallar</span>
                <span class="detail-value">${o["Tompallar"]||"?"}</span>
              </div>
              <div class="order-detail">
                <span class="detail-label">Rullar</span>
                <span class="detail-value">${o["Rullar"]||"?"}</span>
              </div>
              <div class="order-detail">
                <span class="detail-label">Tidsåtgång</span>
                <span class="detail-value">${timeDisplay}</span>
              </div>
            </div>
          </div>`;
          // Klick för att toggle order-card-content
        orderDiv.querySelector(".order-card-header").addEventListener("click", function(e) {
          e.stopPropagation();
          const content = orderDiv.querySelector(".order-card-content");
          const isVisible = content.style.display !== "none";
          content.style.display = isVisible ? "none" : "block";
        });
        list.appendChild(orderDiv);
        
        // Add manual stops for this order
        manualStops.forEach((st,si)=>{
          if(st.start>=o.startTime && st.start<o.endTime){
            const stopDiv=document.createElement("div");
            stopDiv.className="manual-stop";
            stopDiv.innerHTML=`Stopp ${formatTime(st.start)}-${formatTime(st.end)} <button data-i='${si}'>X</button>`;
            stopDiv.querySelector("button").onclick=()=>{manualStops.splice(si,1);recalcSchedule();renderPage();};
            list.appendChild(stopDiv);
          }
        });
      });
      
      section.appendChild(list);
        // Assemble the shift container
      shiftContainer.appendChild(shiftHeader);
      shiftContainer.appendChild(summary);
      shiftContainer.appendChild(section);
      
      // Add to shifts container instead of orders wrapper
      shiftsContainer.appendChild(shiftContainer);
    });
  }

  function renderShiftBar(shifts){
    const container=document.getElementById("shiftBarContainer");
    if(!container) return;
    container.innerHTML="";
    const totalKg=Object.keys(shifts).reduce((a,key)=>a+shifts[key].reduce((x,o)=>x+parseFloat(o["Planerad Vikt"]||0),0),0);
    if(totalKg===0) return;
    const barWrapper=document.createElement("div");
    barWrapper.className="shift-bar";
    
    // Colors for shift bar
    const shiftColors = {
      FM: "#2563eb",
      EM: "#60a5fa", 
      Natt: "#fbbf24"
    };
    const shiftNames = {
      FM: "FM-Skift",
      EM: "EM-Skift", 
      Natt: "Natt-Skift"
    };
    
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
      barWrapper.appendChild(seg);
    });
    container.appendChild(barWrapper);
    const legend=document.createElement("div");
    legend.className="shift-bar-legend-horizontal";
    legend.innerHTML=Object.keys(shifts).map(s=>`<span class="shift-bar-legend-item"><span class="shift-bar-legend-color" style="background:${shiftColors[s]}"></span>${shiftNames[s]}</span>`).join("");
    container.appendChild(legend);
  }  // Initialize page when DOM is loaded
  function initializePage() {
    populatePlanSelect();
    
    // Add event listeners
    const loadBtn = document.getElementById('loadPlanBtn');
    if (loadBtn) {
      loadBtn.addEventListener('click', loadOrders);
    }
    
    const manualStopBtn = document.getElementById('manualStopBtn');
    if (manualStopBtn) {
      manualStopBtn.addEventListener('click', addManualStop);
    }
    
    const planSelect = document.getElementById('planSelect');
    if (planSelect) {
      planSelect.addEventListener('change', loadOrders);
    }
    
    // Load orders after a short delay to ensure everything is ready
    setTimeout(() => {
      loadOrders();
    }, 100);
  }

  // Multiple initialization strategies to ensure it runs
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
  } else {
    // DOM already loaded
    initializePage();
  }
    // Fallback initialization
  window.addEventListener('load', function() {
    if (!window.pageInitialized) {
      initializePage();
      window.pageInitialized = true;
    }
  });
  
  // Overflow handling with sidebar support
  function checkAndHandleOverflow() {
    const starts = { FM: 6 * 60, EM: 14 * 60, Natt: 22.5 * 60 };
    const limits = { FM: 14 * 60, EM: 22.5 * 60, Natt: 30 * 60 };
    
    overflowOrders = []; // Reset overflow
    
    Object.keys(currentShifts).forEach(shift => {
      let currentTime = starts[shift];
      const shiftEndTime = limits[shift];
      const ordersToRemove = [];
      
      // Process orders and update their times
      for (let index = 0; index < currentShifts[shift].length; index++) {
        const order = currentShifts[shift][index];
        let orderStart = currentTime;
        let orderEnd = orderStart + order.productionTime;
        
        // Apply manual stops
        manualStops.forEach(st => {
          if(st.end <= orderStart || st.start >= orderEnd) return;
          if(st.start <= orderStart) { 
            orderStart = st.end; 
            orderEnd = orderStart + order.productionTime; 
          } else if(st.start < orderEnd) { 
            orderEnd += st.end - st.start; 
          }
        });
        
        // Check if this order exceeds shift capacity
        if (orderEnd > shiftEndTime) {
          // Mark for removal to overflow
          ordersToRemove.push(index);
          order._originalShift = shift; // Remember where it came from
          // Set overflow times (for display purposes)
          order.startTime = -1; // Special marker for overflow
          order.endTime = -1;
          order._exceedsCapacity = true;
          overflowOrders.push(order);
        } else {
          // Update times for valid orders
          if (shift === 'Natt') {
            order.startTime = orderStart % 1440;
            order.endTime = orderEnd % 1440;
          } else {
            order.startTime = orderStart;
            order.endTime = orderEnd;
          }
          order._exceedsCapacity = false;
          currentTime = orderEnd;
        }
      }
      
      // Remove overflow orders from shift (in reverse order to maintain indices)
      ordersToRemove.reverse().forEach(index => {
        currentShifts[shift].splice(index, 1);
      });
    });
    
    // Show notification if we have overflow
    if (overflowOrders.length > 0) {
      showNotification(
        `⚠️ ${overflowOrders.length} order(s) flyttade till overflow-zon (för långa för något skift)`, 
        'warning'
      );
    }
    
    // Update sidebar with overflow orders
    updateSidebarOverflow();
  }
  
  function updateSidebarOverflow() {
    const sidebar = document.querySelector('.sm-sidebar');
    if (!sidebar) return;
    
    // Remove existing overflow section
    const existingOverflow = sidebar.querySelector('.overflow-section');
    if (existingOverflow) {
      existingOverflow.remove();
    }
    
    // Add overflow section if we have overflow orders
    if (overflowOrders.length > 0) {
      const overflowSection = document.createElement('div');
      overflowSection.className = 'overflow-section';
      overflowSection.innerHTML = `
        <div class="overflow-header">
          <h4>⚠️ Overflow-ordrar (${overflowOrders.length})</h4>
          <p>Dessa ordrar passar inte i något skift</p>
        </div>
        <div class="overflow-list">
          ${overflowOrders.map((order, idx) => `
            <div class="overflow-order" data-index="${idx}">
              <span class="overflow-order-id">${order["Kundorder"] || "Okänd"}</span>
              <span class="overflow-order-weight">${(order["Planerad Vikt"] || 0).toFixed(1)} kg</span>
              <span class="overflow-order-time">${Math.round(order.productionTime/60)}h ${Math.round(order.productionTime%60)}m</span>
              <button class="overflow-return-btn" data-index="${idx}" data-shift="${order._originalShift || 'FM'}">
                → ${order._originalShift || 'FM'}
              </button>
            </div>
          `).join('')}
        </div>
        <button class="overflow-clear-btn">Rensa alla</button>
      `;
      
      // Insert after logo but before nav-buttons
      const logo = sidebar.querySelector('.sm-logo');
      if (logo) {
        logo.parentNode.insertBefore(overflowSection, logo.nextSibling);
      }
      
      // Add event listeners
      overflowSection.querySelectorAll('.overflow-return-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          const targetShift = e.target.dataset.shift;
          returnOverflowOrder(idx, targetShift);
        });
      });
      
      const clearBtn = overflowSection.querySelector('.overflow-clear-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          overflowOrders = [];
          updateSidebarOverflow();
          showNotification('Alla overflow-ordrar rensade', 'info');
        });
      }
    }
  }
  
  function returnOverflowOrder(overflowIndex, targetShift) {
    if (overflowIndex < 0 || overflowIndex >= overflowOrders.length) return;
    
    const order = overflowOrders[overflowIndex];
    overflowOrders.splice(overflowIndex, 1);
    
    // Add back to the specified shift
    currentShifts[targetShift] = currentShifts[targetShift] || [];
    currentShifts[targetShift].push(order);
    
    // Recalculate and re-render
    recalcSchedule();
    renderPage();
    updateSidebarOverflow();
    
    showNotification(`Order ${order["Kundorder"] || "okänd"} återförd till ${targetShift}`, 'success');
  }

  function showNotification(message, type = 'info') {
    // Try to use cross-machine transfer notification if available
    if (typeof showTransferMessage === 'function') {
      showTransferMessage(message, type);
      return;
    }
    
    // Fallback: create simple notification
    const notification = document.createElement('div');
    notification.className = `simple-notification simple-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'warning' ? '#fbbf24' : type === 'success' ? '#22c55e' : '#3b82f6'};
      color: ${type === 'warning' ? '#1e293b' : '#fff'};
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  }

  // Initialize page when DOM is loaded
})();
