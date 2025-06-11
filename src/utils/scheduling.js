/**
 * Shift Scheduler
 * Handles the core logic for distributing orders across shifts
 */

import { SHIFT_DEFINITIONS, SHIFT_ORDER } from '../config/shifts.js';

/**
 * Distribute orders to shifts based on time constraints
 * @param {Array} ordersToSchedule - Array of orders to schedule
 * @param {Function} getMachineSpeedFunc - Function to get machine speed
 * @param {string} machineId - Machine identifier
 * @returns {Object} Object with shifts and overflow orders
 */
export function distributeOrdersToShifts(ordersToSchedule, getMachineSpeedFunc, machineId) {
  const shifts = { FM: [], EM: [], Natt: [] };
  const overflowOrders = [];

  // Reset scheduling properties for all incoming orders
  ordersToSchedule.forEach(order => {
    delete order.shift;
    delete order.startTime;
    delete order.endTime;
    order._scheduled = false;
  });

  // Track the time at which the next order in a shift can start
  let nextAvailableTimeInShift = {
    FM: SHIFT_DEFINITIONS.FM.start,
    EM: SHIFT_DEFINITIONS.EM.start,
    Natt: SHIFT_DEFINITIONS.Natt.start
  };

  for (const order of ordersToSchedule) {
    let placedThisOrder = false;
    
    // Try to place the order in FM, then EM, then Natt
    for (const shiftKey of SHIFT_ORDER) {
      const currentShiftDef = SHIFT_DEFINITIONS[shiftKey];
      let orderProposedStartTime = nextAvailableTimeInShift[shiftKey];
      
      const time = order.productionTimeNormal || 
                  order.productionTimeSaxning || 
                  order.productionTime || 
                  order.adjustedTime || 0;

      // Ensure speed is calculated and set for every order
      if (getMachineSpeedFunc) {
        order.speed = getMachineSpeedFunc(machineId, parseFloat(order["Arklängd"]) || 0);
      }

      if (time === 0) {
        // Skip orders with no duration but mark as placed
        placedThisOrder = true;
        break; 
      }

      // If the shift is Natt, ensure start time is not before official start
      if (shiftKey === "Natt" && orderProposedStartTime < currentShiftDef.start) {
        orderProposedStartTime = currentShiftDef.start;
      }
      
      let orderProposedEndTime = orderProposedStartTime + time;

      // Check if the order fits within the current shift's boundaries
      if (orderProposedEndTime <= currentShiftDef.end) {
        order.startTime = orderProposedStartTime;
        order.endTime = orderProposedEndTime;
        order.shift = shiftKey;
        order.adjustedTime = time;

        shifts[shiftKey].push(order);
        nextAvailableTimeInShift[shiftKey] = order.endTime;
        order._scheduled = true;
        placedThisOrder = true;
        break;
      }
    }

    if (!placedThisOrder) {
      overflowOrders.push(order);
    }
  }

  return { shifts, overflowOrders };
}

/**
 * Calculate shift statistics
 * @param {Object} shifts - Object containing shift arrays
 * @returns {Object} Statistics for each shift
 */
export function calculateShiftStats(shifts) {
  const shiftStats = {};
  
  Object.keys(shifts).forEach(shiftKey => {
    const ordersInShift = shifts[shiftKey];
    const totalKg = ordersInShift.reduce((acc, o) => acc + parseFloat(o["Planerad Vikt"] || 0), 0);
    const totalOrders = ordersInShift.length;
    const totalTime = ordersInShift.reduce((acc, o) => acc + (o.adjustedTime || o.productionTime || 0), 0);
    const kgPerHour = totalTime > 0 ? (totalKg / (totalTime / 60)) : 0;
    
    shiftStats[shiftKey] = {
      totalKg,
      totalOrders,
      totalTime,
      kgPerHour,
      orders: ordersInShift
    };
  });

  return shiftStats;
}

// Backward compatibility - expose functions on window for legacy code
if (typeof window !== 'undefined') {
  window.ShiftScheduler = {
    distributeOrdersToShifts,
    calculateShiftStats,
    SHIFT_DEFINITIONS,
    SHIFT_ORDER
  };
}