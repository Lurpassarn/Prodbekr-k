/**
 * Production Time Calculator
 * Calculates stop times and production times for orders
 */

import { estimateRollCount } from './roll-estimator.js';

/**
 * Calculate stop times for normal operation and saxning
 * @param {Object} order - Order object
 * @returns {Object} Object with normalStopTime and saxningStopTime in seconds
 */
export function calculateStopTimes(order) {
  const machineId = order['Maskin id'] || 'SM28';
  const rawRollWidth = parseFloat(String(order['RawRollWidth']).split(',')[0]) || 0;
  const rolls = estimateRollCount(order);

  // Normal operation: 15 minutes setup + 90 seconds per roll
  const normalSetupTime = 15 * 60; // 900 seconds
  const normalStopTime = normalSetupTime + rolls * 90;

  // Saxning for SM27 and SM28 with rolls ≤ 1035 mm and at least 2 rolls
  // 10 minutes loading per pair of rolls in operation (max 2 at a time)
  const isSaxningEligible = (machineId === 'SM27' || machineId === 'SM28') && 
                           rawRollWidth <= 1035 && 
                           rolls >= 2;
  
  const saxningSetupTime = 25 * 60; // 1500 seconds
  const numSaxningPairs = Math.ceil(rolls / 2); // Number of roll pairs, rounded up
  const saxningStopTime = isSaxningEligible 
    ? saxningSetupTime + numSaxningPairs * 10 * 60 // 10 minutes per pair
    : 0;

  return {
    normalStopTime,
    saxningStopTime
  };
}

/**
 * Calculate production time for an order (both normal and saxning variants)
 * @param {Object} order - Order object
 * @returns {Object} Object with normalTime and saxningTime in minutes
 */
export function calculateProductionTime(order, getMachineSpeedFunc) {
  const machineId = order['Maskin id'] || 'SM28';
  const sheetLength = parseFloat(order['Arklängd']) || 0;
  const speed = getMachineSpeedFunc(machineId, sheetLength);

  const plannedWeight = parseFloat(String(order['Planerad Vikt'] || 0).replace(/\s/g, '')) || 0;
  const gramvikt = parseFloat(order['Gramvikt']) || 0;
  const rawRollWidthStr = order['RawRollWidth'] || '';
  const rawRollWidths = rawRollWidthStr.split(',').map(x => parseFloat(x.trim()) || 0);
  const maxRawRollWidth = Math.max(...rawRollWidths, 0);
  const lanes = parseFloat(order['Antal banor']) || 1;
  const expectedWidth = parseFloat(order['Arkbredd']) || 0;

  if (gramvikt <= 0 || maxRawRollWidth <= 0 || speed <= 0) {
    console.warn(`Ogiltiga värden för order ${order['Kundorder'] || 'okänd'}:`, { gramvikt, maxRawRollWidth, speed });
    return { normalTime: 0, saxningTime: 0 };
  }

  // Calculate length L (in meters)
  const L = (plannedWeight * 1000000) / (gramvikt * maxRawRollWidth);
  
  // Adjusted production time based on waste factor
  const spillFactor = (expectedWidth > 0 && maxRawRollWidth > 0) 
    ? Math.max(0.5, 1 - (expectedWidth * lanes) / maxRawRollWidth) 
    : 1;
  
  const productionTimeMinutes = L / speed / spillFactor;
  const productionTimeSeconds = productionTimeMinutes * 60;

  // Stop times for both alternatives
  const { normalStopTime, saxningStopTime } = calculateStopTimes(order);

  // Total time in minutes for both alternatives
  const normalTime = (productionTimeSeconds + normalStopTime) / 60;
  const saxningTime = (productionTimeSeconds + saxningStopTime) / 60;

  return {
    normalTime,
    saxningTime
  };
}

/**
 * Calculate production times for all orders in an array
 * @param {Object[]} orders - Array of order objects
 * @param {Function} getMachineSpeedFunc - Function to get machine speed
 * @returns {Object[]} Orders with added productionTimeNormal and productionTimeSaxning properties
 */
export function calculateAllProductionTimes(orders, getMachineSpeedFunc) {
  return orders.map(order => {
    const { normalTime, saxningTime } = calculateProductionTime(order, getMachineSpeedFunc);
    return {
      ...order,
      productionTimeNormal: normalTime,
      productionTimeSaxning: saxningTime
    };
  });
}
