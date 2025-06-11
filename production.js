/**
 * Production Utilities - ES6 Module Version
 * Handles machine speed calculations and production time estimations
 */

import { getMachineSpeed } from './src/utils/speed-calculator.js';
import { estimateRollCount } from './src/utils/roll-estimator.js';
import { calculateAllProductionTimes } from './src/utils/production-calculator.js';

// Re-export commonly used functions to maintain compatibility
export {
  getMachineSpeed,
  estimateRollCount,
  calculateAllProductionTimes
};

/**
 * Load and process orders from JSON file
 * @param {string} jsonFile - Path to JSON file
 * @returns {Promise<Object[]>} Orders with calculated production times
 */
export async function processOrdersFromJson(jsonFile) {  try {
    const response = await fetch(jsonFile);
    const orders = await response.json();
    const ordersWithTimes = calculateAllProductionTimes(orders, getMachineSpeed);
    console.log(`Produktionstider för ${jsonFile}:`, ordersWithTimes);
    return ordersWithTimes;
  } catch (error) {
    console.error(`Fel vid laddning av ${jsonFile}:`, error);
    return [];
  }
}

// Make functions available globally for backward compatibility
window.getMachineSpeed = getMachineSpeed;
window.estimateRollCount = estimateRollCount;
window.calculateAllProductionTimes = (orders) => calculateAllProductionTimes(orders, getMachineSpeed);
window.processOrdersFromJson = processOrdersFromJson;