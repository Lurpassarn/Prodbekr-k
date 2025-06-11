/**
 * Roll Count Estimation Utilities
 * Functions for estimating number of rolls needed for production
 */

/**
 * Parse numeric value from string, removing spaces
 * @param {string|number} value - Value to parse
 * @returns {number} Parsed number or 0
 */
function parseNumeric(value) {
  return parseFloat(String(value || 0).replace(/\s/g, '')) || 0;
}

/**
 * Parse raw roll widths from comma-separated string
 * @param {string} rawRollWidthStr - Comma-separated widths
 * @returns {number[]} Array of widths
 */
function parseRawRollWidths(rawRollWidthStr) {
  return String(rawRollWidthStr || '')
    .split(',')
    .map(x => parseFloat(x.trim()) || 0)
    .filter(w => w > 0);
}

/**
 * Parse roll information from "Rullar" field
 * @param {string} rollsStr - String in format "available(allocated)"
 * @returns {Object} Object with availableRolls and allocatedRolls
 */
function parseRollsString(rollsStr) {
  const [availableRollsStr, allocatedRollsStr] = String(rollsStr || '')
    .split('(')
    .map(s => s.replace(')', ''));
  
  return {
    availableRolls: parseInt(availableRollsStr) || 0,
    allocatedRolls: parseInt(allocatedRollsStr) || 0
  };
}

/**
 * Estimate number of rolls needed for an order
 * @param {Object} order - Order object with production details
 * @returns {number} Estimated number of rolls
 */
export function estimateRollCount(order) {
  const reservedWeight = parseNumeric(order['Reserverad Vikt']);
  const plannedWeight = parseNumeric(order['Planerad Vikt']);
  const gramvikt = parseFloat(order['Gramvikt']) || 0;
  const rawRollWidths = parseRawRollWidths(order['RawRollWidth']);
  const numUniqueWidths = new Set(rawRollWidths).size;
  const maxRawRollWidth = Math.max(...rawRollWidths, 0);
  const sheetLength = parseFloat(order['Arklängd']) || 0;
  const lanes = parseFloat(order['Antal banor']) || 1;
  const expectedWidth = parseFloat(order['Arkbredd']) || 0;

  const { availableRolls, allocatedRolls } = parseRollsString(order['Rullar']);

  let rolls;

  // Priority 1: Use allocated rolls if reserved weight exists
  if (reservedWeight > 0 && allocatedRolls > 0) {
    rolls = allocatedRolls;
    const avgRollWeight = reservedWeight / rolls;
    console.log(`Snittvikt per rulle för ${order['Kundorder'] || 'okänd'}: ${avgRollWeight} kg (baserat på Reserverad Vikt)`);
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
    console.log(`Uppskattad snittvikt per rulle för ${order['Kundorder'] || 'okänd'}: ${avgRollWeight} kg (baserat på Planerad Vikt + 10%)`);
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
    console.log(`Uppskattad snittvikt per rulle för ${order['Kundorder'] || 'okänd'}: ${avgRollWeight} kg (baserat på Planerad Vikt + 10% och vikt/breddregel)`);
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
    console.warn(`Hög spillfaktor för order ${order['Kundorder'] || 'okänd'}:`, spillFactor);
  }

  return rolls;
}
