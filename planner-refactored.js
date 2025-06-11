// Production Planner - Refactored version
// Updated to use modular utilities for better maintainability

(function() {
  // Import modular utilities with fallbacks
  const shiftsConfig = window.ShiftsConfig;
  const { calculateAllProductionTimes } = window.ProductionCalculatorModule || {};
  const { formatTime: formatTimeModule, parseTime } = window.TimeUtilsModule || {};

  // Storage configuration
  const STORAGE_KEY = "savedPlans";

  // Use modular shift configuration or fallback
  const getShiftTimings = () => {
    if (shiftsConfig && shiftsConfig.SHIFT_TIMES) {
      return {
        FM: { 
          start: shiftsConfig.SHIFT_TIMES.FM.START, 
          end: shiftsConfig.SHIFT_TIMES.FM.END 
        },
        EM: { 
          start: shiftsConfig.SHIFT_TIMES.EM.START, 
          end: shiftsConfig.SHIFT_TIMES.EM.END 
        },
        Natt: { 
          start: shiftsConfig.SHIFT_TIMES.NATT.START, 
          end: shiftsConfig.SHIFT_TIMES.NATT.END 
        }
      };
    }
    // Fallback to hardcoded values
    return {
      FM: { start: 6 * 60, end: 14 * 60 },
      EM: { start: 14 * 60, end: 22.5 * 60 },
      Natt: { start: 22.5 * 60, end: 30 * 60 }
    };
  };

  const shiftTimings = getShiftTimings();

  const schedule = {
    FM: { nextStart: shiftTimings.FM.start, orders: [] },
    EM: { nextStart: shiftTimings.EM.start, orders: [] },
    Natt: { nextStart: shiftTimings.Natt.start, orders: [] }
  };

  let availableOrders = [];
  let plannedSequence = [];

  // Utility functions
  function nextShift(shift) {
    return shift === "FM" ? "EM" : shift === "EM" ? "Natt" : "FM";
  }

  // Use modular time formatting or fallback
  function formatTime(mins) {
    if (formatTimeModule) {
      return formatTimeModule(mins);
    }
    // Fallback implementation
    const totalMinutes = Math.round(mins);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function formatDuration(mins) {
    const h = Math.floor(mins / 60); 
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // Storage management functions
  function getSaved(machine) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return data[machine] || {};
    } catch (error) {
      console.error('Error loading saved plans:', error);
      return {};
    }
  }

  function savePlan(machine, name, sequence) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (!data[machine]) data[machine] = {};
      data[machine][name] = sequence;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving plan:', error);
      return false;
    }
  }

  function loadSavedNames(machine) {
    const sel = document.getElementById("savedPlans");
    if (!sel) return;
    
    const plans = getSaved(machine);
    sel.innerHTML = "<option value=\"\">Välj plan</option>";
    
    Object.keys(plans).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name; 
      opt.textContent = name; 
      sel.appendChild(opt);
    });
  }

  // Rendering functions
  function renderOrderList() {
    const list = document.getElementById("orderList");
    if (!list) return;
    
    list.innerHTML = "";
    availableOrders.forEach((order, idx) => {
      const div = document.createElement("div");
      div.className = "order-entry-modern";
      div.innerHTML = `
        <span class="order-btns">
          <button data-idx="${idx}" class="small-btn icon-btn add">+</button>
        </span>
        <span class="order-id">${order["Kundorder"] || "Okänd"}</span>
        <span class="weight">${(parseFloat(order["Planerad Vikt"]) || 0).toFixed(1)} kg</span>
        <span class="duration">${formatDuration(order.productionTimeNormal || 0)}</span>
      `;
      
      const addBtn = div.querySelector(".add");
      if (addBtn) {
        addBtn.onclick = () => addToSequence(idx);
      }
      
      list.appendChild(div);
    });
  }

  function renderSequence() {
    const seq = document.getElementById("sequenceList");
    if (!seq) return;
    
    seq.innerHTML = "";
    plannedSequence.forEach((order, idx) => {
      const div = document.createElement("div");
      div.className = "order-entry-modern";
      div.draggable = true;
      div.innerHTML = `
        <span class="order-btns">
          <button data-idx="${idx}" class="small-btn icon-btn up">&#8679;</button>
          <button data-idx="${idx}" class="small-btn icon-btn down">&#8681;</button>
          <button data-idx="${idx}" class="small-btn icon-btn remove">X</button>
        </span>
        <span class="order-id">${order["Kundorder"] || "Okänd"}</span>
        <span class="weight">${(parseFloat(order["Planerad Vikt"]) || 0).toFixed(1)} kg</span>
        <span class="duration">${formatDuration(order.productionTimeNormal || 0)}</span>
      `;
      
      // Add event listeners
      div.querySelector(".up").onclick = () => moveSequence(idx, -1);
      div.querySelector(".down").onclick = () => moveSequence(idx, 1);
      div.querySelector(".remove").onclick = () => removeFromSequence(idx);
      
      // Drag and drop functionality
      setupDragAndDrop(div, idx);
      
      seq.appendChild(div);
    });
  }

  function setupDragAndDrop(div, idx) {
    div.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", idx);
      div.classList.add("drag-over");
    });
    
    div.addEventListener("dragend", e => {
      div.classList.remove("drag-over");
    });
    
    div.addEventListener("dragover", e => {
      e.preventDefault();
      div.classList.add("drag-over");
    });
    
    div.addEventListener("dragleave", e => {
      div.classList.remove("drag-over");
    });
    
    div.addEventListener("drop", e => {
      e.preventDefault();
      div.classList.remove("drag-over");
      const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (fromIdx === idx) return;
      
      const item = plannedSequence.splice(fromIdx, 1)[0];
      plannedSequence.splice(idx, 0, item);
      renderSequence();
      generateSchedule();
    });
  }

  function renderSchedule() {
    const container = document.getElementById("scheduleContainer");
    if (!container) return;
    
    container.innerHTML = "";
    Object.keys(schedule).forEach(shift => {
      const shiftData = schedule[shift];
      const h = document.createElement("h3");
      h.textContent = shift + "-skift";
      container.appendChild(h);
      
      const ul = document.createElement("ul");
      shiftData.orders.forEach(order => {
        const li = document.createElement("li");
        li.textContent = `${order.orderId} ${formatTime(order.start)} - ${formatTime(order.end)} (${order.weight.toFixed(1)} kg)`;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    });
  }

  // Sequence management functions
  function addToSequence(idx) {
    if (idx < 0 || idx >= availableOrders.length) return;
    
    const order = availableOrders.splice(idx, 1)[0];
    plannedSequence.push(order);
    renderOrderList();
    renderSequence();
    generateSchedule();
  }

  function moveSequence(idx, direction) {
    const newIndex = idx + direction;
    if (newIndex < 0 || newIndex >= plannedSequence.length) return;
    
    const temp = plannedSequence[idx];
    plannedSequence[idx] = plannedSequence[newIndex];
    plannedSequence[newIndex] = temp;
    renderSequence();
    generateSchedule();
  }

  function removeFromSequence(idx) {
    if (idx < 0 || idx >= plannedSequence.length) return;
    
    const order = plannedSequence.splice(idx, 1)[0];
    availableOrders.push(order);
    renderOrderList();
    renderSequence();
    generateSchedule();
  }

  // Schedule management
  function resetSchedule() {
    ["FM", "EM", "Natt"].forEach(shift => {
      schedule[shift].orders = [];
      schedule[shift].nextStart = shiftTimings[shift].start;
    });
  }

  function scheduleOrder(order, shift) {
    let timeLeft = order.productionTimeNormal || 0;
    let weightLeft = parseFloat(order["Planerad Vikt"]) || 0;
    
    if (timeLeft <= 0 || weightLeft <= 0) return shift;
    
    const rate = weightLeft / timeLeft;
    
    while (timeLeft > 0) {
      if (schedule[shift].nextStart < shiftTimings[shift].start) {
        schedule[shift].nextStart = shiftTimings[shift].start;
      }
      
      if (schedule[shift].nextStart >= shiftTimings[shift].end) {
        shift = nextShift(shift);
        continue;
      }
      
      const start = schedule[shift].nextStart;
      const available = shiftTimings[shift].end - start;
      const run = Math.min(timeLeft, available);
      const weight = rate * run;
      
      schedule[shift].orders.push({
        orderId: order["Kundorder"] || "Okänd",
        start,
        end: start + run,
        weight
      });
      
      schedule[shift].nextStart = start + run;
      timeLeft -= run;
      weightLeft -= weight;
      
      if (timeLeft > 0) {
        shift = nextShift(shift);
      }
    }
    
    return shift;
  }

  function generateSchedule() {
    resetSchedule();
    let currentShift = "FM";
    
    plannedSequence.forEach(order => {
      currentShift = scheduleOrder(order, currentShift) || currentShift;
    });
    
    renderSchedule();
  }

  // Custom order creation
  function addCustomOrder(e) {
    if (e) e.preventDefault();
    
    const orderId = document.getElementById("coId")?.value?.trim();
    if (!orderId) return;
    
    const weight = parseFloat(document.getElementById("coWeight")?.value) || 0;
    const gram = parseFloat(document.getElementById("coGram")?.value) || 0;
    const length = parseFloat(document.getElementById("coLen")?.value) || 0;
    const width = document.getElementById("coWidth")?.value || "";
    const lanes = parseFloat(document.getElementById("coLanes")?.value) || 1;
    const sheetW = parseFloat(document.getElementById("coSheet")?.value) || 0;
    const machine = document.getElementById("machineSelect")?.value;
    
    const order = {
      "Kundorder": orderId,
      "Planerad Vikt": weight,
      "Gramvikt": gram,
      "Arklängd": length,
      "RawRollWidth": width,
      "Antal banor": lanes,
      "Arkbredd": sheetW,
      "Maskin id": machine
    };
    
    // Use modular production calculation or fallback
    if (calculateAllProductionTimes) {
      const ordersWithTimes = calculateAllProductionTimes([order]);
      if (ordersWithTimes.length > 0) {
        Object.assign(order, ordersWithTimes[0]);
      }
    } else {
      // Fallback calculation
      console.warn('Production calculator module not available, using basic fallback');
      order.productionTimeNormal = 60; // Default 1 hour
      order.productionTimeSaxning = 0;
    }
    
    availableOrders.push(order);
    renderOrderList();
    
    if (e?.target) {
      e.target.reset();
    }
    
    generateSchedule();
  }

  // Order loading
  async function loadOrders(machine) {
    try {
      const response = await fetch(machine + ".json");
      const data = await response.json();
      
      // Use modular production calculation or fallback
      if (calculateAllProductionTimes) {
        availableOrders = calculateAllProductionTimes(data);
      } else {
        console.warn('Production calculator module not available');
        availableOrders = data.map(order => ({
          ...order,
          productionTimeNormal: 60, // Default fallback
          productionTimeSaxning: 0
        }));
      }
      
      // Sort by planned start time
      availableOrders.sort((a, b) => {
        const aStart = parseFloat(a["Planerad start"] || 0);
        const bStart = parseFloat(b["Planerad start"] || 0);
        return aStart - bStart;
      });
      
    } catch (error) {
      console.error("Could not load orders:", error);
      availableOrders = [];
    }
    
    plannedSequence = [];
    resetSchedule();
    renderOrderList();
    renderSequence();
    generateSchedule();
  }

  // Plan management
  async function loadSelectedPlan() {
    const sel = document.getElementById("savedPlans");
    const name = sel?.value;
    
    if (!name) {
      plannedSequence = [];
      renderSequence();
      renderOrderList();
      return;
    }
    
    const machine = document.getElementById("machineSelect")?.value;
    if (!machine) return;
    
    const plan = getSaved(machine)[name];
    if (!plan) return;
    
    await loadOrders(machine);
    document.getElementById("savedPlans").value = name;
    
    // Move orders from available to planned sequence based on plan
    plan.forEach(plannedOrder => {
      const idx = availableOrders.findIndex(order => 
        order["Kundorder"] === plannedOrder["Kundorder"]
      );
      if (idx > -1) {
        availableOrders.splice(idx, 1);
      }
    });
    
    plannedSequence = plan.slice();
    renderOrderList();
    renderSequence();
    generateSchedule();
  }

  // Initialization
  document.addEventListener("DOMContentLoaded", async () => {
    const machineSelect = document.getElementById("machineSelect");
    if (!machineSelect) {
      console.error('Machine select element not found');
      return;
    }
    
    // Load initial orders
    await loadOrders(machineSelect.value);
    loadSavedNames(machineSelect.value);
    
    // Event listeners
    machineSelect.addEventListener("change", () => {
      loadOrders(machineSelect.value);
      loadSavedNames(machineSelect.value);
    });
    
    // Save plan button
    const savePlanBtn = document.getElementById("savePlanBtn");
    if (savePlanBtn) {
      savePlanBtn.onclick = () => {
        const planNameInput = document.getElementById("planName");
        const name = planNameInput?.value?.trim();
        
        if (!name) {
          alert("Ange namn för planen");
          return;
        }
        
        const machine = machineSelect.value;
        if (savePlan(machine, name, plannedSequence)) {
          loadSavedNames(machine);
          alert("Plan sparad");
          if (planNameInput) planNameInput.value = "";
        } else {
          alert("Fel vid sparande av plan");
        }
      };
    }
    
    // Load plan button
    const loadPlanBtn = document.getElementById("loadPlanBtn");
    if (loadPlanBtn) {
      loadPlanBtn.onclick = loadSelectedPlan;
    }
    
    // Custom order form
    const customOrderForm = document.getElementById("customOrderForm");
    if (customOrderForm) {
      customOrderForm.addEventListener("submit", addCustomOrder);
    }
    
    // Generate schedule button
    const generateScheduleBtn = document.getElementById("generateScheduleBtn");
    if (generateScheduleBtn) {
      generateScheduleBtn.onclick = generateSchedule;
    }
  });

  // Export for other modules if needed
  window.ProductionPlanner = {
    loadOrders,
    generateSchedule,
    addCustomOrder,
    getSaved,
    savePlan
  };

})();
