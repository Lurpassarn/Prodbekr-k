/**
 * Production Utilities - Refactored
 * Handles machine speed calculations and production time estimations
 * Organized into cleaner, more maintainable code structure
 */

// Machine speed curves configuration
const MACHINE_SPEED_CURVES = {
  SM25: [
    { size: 400, speed: 70 }, { size: 500, speed: 100 }, { size: 600, speed: 150 },
    { size: 700, speed: 230 }, { size: 750, speed: 300 }, { size: 900, speed: 300 },
    { size: 950, speed: 280 }, { size: 1000, speed: 250 }, { size: 1100, speed: 225 },
    { size: 1400, speed: 200 }, { size: 1600, speed: 200 }
  ],
  SM27: [
    { size: 400, speed: 30 }, { size: 500, speed: 150 }, { size: 600, speed: 200 },
    { size: 700, speed: 270 }, { size: 720, speed: 300 }, { size: 900, speed: 300 },
    { size: 1200, speed: 300 }, { size: 1800, speed: 300 }
  ],
  SM28: [
    { size: 400, speed: 240 }, { size: 450, speed: 270 }, { size: 500, speed: 300 },
    { size: 650, speed: 300 }, { size: 700, speed: 280 }, { size: 800, speed: 260 },
    { size: 900, speed: 260 }, { size: 1200, speed: 260 }, { size: 1800, speed: 260 }
  ]
};

const DEFAULT_MACHINE = 'SM28';

/**
 * Utility Functions
 */
const utils = {
  /**
   * Parse numeric value from string, removing spaces
   */
  parseNumeric(value) {
    return parseFloat(String(value || 0).replace(/\s/g, '')) || 0;
  },

  /**
   * Parse raw roll widths from comma-separated string
   */
  parseRawRollWidths(rawRollWidthStr) {
    return String(rawRollWidthStr || '')
      .split(',')
      .map(x => parseFloat(x.trim()) || 0)
      .filter(w => w > 0);
  },

  /**
   * Parse roll information from "Rullar" field
   */
  parseRollsString(rollsStr) {
    const [availableRollsStr, allocatedRollsStr] = String(rollsStr || '')
      .split('(')
      .map(s => s.replace(')', ''));
    
    return {
      availableRolls: parseInt(availableRollsStr) || 0,
      allocatedRolls: parseInt(allocatedRollsStr) || 0
    };
  },

  /**
   * Linear interpolation between two points
   */
  linearInterpolate(x0, y0, x1, y1, x) {
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
};

/**
 * Calculate machine speed based on sheet length using linear interpolation
 * @param {string} machineId - Machine identifier (SM25, SM27, SM28)
 * @param {number} sheetLength - Sheet length in mm
 * @returns {number} Speed in m/min
 */
function getMachineSpeed(machineId, sheetLength) {
  const curve = MACHINE_SPEED_CURVES[machineId] || MACHINE_SPEED_CURVES[DEFAULT_MACHINE];
  
  if (!sheetLength || sheetLength < curve[0].size) {
    return curve[0].speed;
  }
  
  if (sheetLength >= curve[curve.length - 1].size) {
    return curve[curve.length - 1].speed;
  }

  // Linear interpolation between curve points
  for (let i = 0; i < curve.length - 1; i++) {
    if (sheetLength >= curve[i].size && sheetLength < curve[i + 1].size) {
      return utils.linearInterpolate(
        curve[i].size, curve[i].speed,
        curve[i + 1].size, curve[i + 1].speed,
        sheetLength
      );
    }
  }
  
  return 200; // Fallback
}

/**
 * Estimate number of rolls needed for an order
 * @param {Object} order - Order object with production details
 * @returns {number} Estimated number of rolls
 */
function estimateRollCount(order) {
  const reservedWeight = utils.parseNumeric(order['Reserverad Vikt']);
  const plannedWeight = utils.parseNumeric(order['Planerad Vikt']);
  const gramvikt = parseFloat(order['Gramvikt']) || 0;
  const rawRollWidths = utils.parseRawRollWidths(order['RawRollWidth']);
  const numUniqueWidths = new Set(rawRollWidths).size;
  const maxRawRollWidth = Math.max(...rawRollWidths, 0);
  const sheetLength = parseFloat(order['Arklängd']) || 0;
  const lanes = parseFloat(order['Antal banor']) || 1;
  const expectedWidth = parseFloat(order['Arkbredd']) || 0;

  const { availableRolls, allocatedRolls } = utils.parseRollsString(order['Rullar']);

  let rolls;
  const orderId = order['Kundorder'] || 'okänd';

  // Priority 1: Use allocated rolls if reserved weight exists
  if (reservedWeight > 0 && allocatedRolls > 0) {
    rolls = allocatedRolls;
    const avgRollWeight = reservedWeight / rolls;
    console.log(`Snittvikt per rulle för ${orderId}: ${avgRollWeight} kg (baserat på Reserverad Vikt)`);
  }
  // Priority 2: Validate against planned weight
  else if (plannedWeight > 0 && (availableRolls > 0 || allocatedRolls > 0)) {
    const adjustedPlannedWeight = plannedWeight * 1.1; // 10% increase
    const avgWeightWithAvailable = adjustedPlannedWeight / availableRolls;
    const avgWeightWithAllocated = allocatedRolls > 0 ? adjustedPlannedWeight / allocatedRolls : Infinity;

    // Choose value that gives reasonable average weight (100-5000 kg)
    rolls = (avgWeightWithAllocated >= 100 && 
             avgWeightWithAllocated <= 5000 && 
             allocatedRolls > availableRolls) 
             ? allocatedRolls 
             : availableRolls;
    
    const avgRollWeight = adjustedPlannedWeight / rolls;
    console.log(`Uppskattad snittvikt per rulle för ${orderId}: ${avgRollWeight} kg (baserat på Planerad Vikt + 10%)`);
  }
  // Priority 3: Fallback estimation based on weight and width rules
  else if (plannedWeight > 0) {
    const adjustedPlannedWeight = plannedWeight * 1.1;
    
    if (adjustedPlannedWeight < 2000) {
      rolls = numUniqueWidths > 0 ? numUniqueWidths : 2; // Under 2 tons, prioritize number of widths
      if (numUniqueWidths === 5) rolls = 5; // Minimum 5 rolls for 5 widths
    } else {
      rolls = Math.max(2, numUniqueWidths); // Over 2 tons = minimum 2, at least 1 per unique width
      if (numUniqueWidths === 5) rolls = 5; // Minimum 5 rolls for 5 widths
    }
    
    const avgRollWeight = adjustedPlannedWeight / rolls;
    console.log(`Uppskattad snittvikt per rulle för ${orderId}: ${avgRollWeight} kg (baserat på Planerad Vikt + 10% och vikt/breddregel)`);
  }
  // Priority 4: Last resort estimation
  else {
    const rollWeightPerMeter = (gramvikt * maxRawRollWidth) / 1000000; // kg/m
    const estimatedTotalLength = (plannedWeight * 1.1) / rollWeightPerMeter;
    rolls = Math.ceil(estimatedTotalLength / (sheetLength || 1));
  }

  // Calculate waste factor if expected width doesn't match roll width
  const spillFactor = (expectedWidth > 0 && maxRawRollWidth > 0) 
    ? Math.max(0.5, 1 - (expectedWidth * lanes) / maxRawRollWidth) 
    : 1;
    
  if (spillFactor < 0.5) {
    console.warn(`Hög spillfaktor för order ${orderId}:`, spillFactor);
  }

  return rolls;
}

/**
 * Calculate stop times for normal operation and saxning
 * @param {Object} order - Order object
 * @returns {Object} Object with normalStopTime and saxningStopTime in seconds
 */
function calculateStopTimes(order) {
  const machineId = order['Maskin id'] || DEFAULT_MACHINE;
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
function calculateProductionTime(order) {
  const machineId = order['Maskin id'] || DEFAULT_MACHINE;
  const sheetLength = parseFloat(order['Arklängd']) || 0;
  const speed = getMachineSpeed(machineId, sheetLength);

  const plannedWeight = utils.parseNumeric(order['Planerad Vikt']);
  const gramvikt = parseFloat(order['Gramvikt']) || 0;
  const rawRollWidths = utils.parseRawRollWidths(order['RawRollWidth']);
  const maxRawRollWidth = Math.max(...rawRollWidths, 0);
  const lanes = parseFloat(order['Antal banor']) || 1;
  const expectedWidth = parseFloat(order['Arkbredd']) || 0;

  const orderId = order['Kundorder'] || 'okänd';

  if (gramvikt <= 0 || maxRawRollWidth <= 0 || speed <= 0) {
    console.warn(`Ogiltiga värden för order ${orderId}:`, { gramvikt, maxRawRollWidth, speed });
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
 * @returns {Object[]} Orders with added productionTimeNormal and productionTimeSaxning properties
 */
function calculateAllProductionTimes(orders) {
  return orders.map(order => {
    const { normalTime, saxningTime } = calculateProductionTime(order);
    return {
      ...order,
      productionTimeNormal: normalTime,
      productionTimeSaxning: saxningTime
    };
  });
}

/**
 * Load and process orders from JSON file
 * @param {string} jsonFile - Path to JSON file
 * @returns {Promise<Object[]>} Orders with calculated production times
 */
async function processOrdersFromJson(jsonFile) {
  try {
    const response = await fetch(jsonFile);
    const orders = await response.json();
    const ordersWithTimes = calculateAllProductionTimes(orders);
    console.log(`Produktionstider för ${jsonFile}:`, ordersWithTimes);
    return ordersWithTimes;
  } catch (error) {
    console.error(`Fel vid laddning av ${jsonFile}:`, error);
    return [];
  }
}

// Export for Node.js environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getMachineSpeed,
    estimateRollCount,
    calculateStopTimes,
    calculateProductionTime,
    calculateAllProductionTimes,
    processOrdersFromJson
  };
}
