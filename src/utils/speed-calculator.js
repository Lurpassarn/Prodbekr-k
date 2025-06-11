/**
 * Machine Speed Utilities
 * Functions for calculating machine speeds based on sheet length
 */

import { MACHINE_SPEED_CURVES, DEFAULT_MACHINE } from '../config/machine-speeds.js';

/**
 * Linear interpolation between two points
 * @param {number} x0 - First x coordinate
 * @param {number} y0 - First y coordinate  
 * @param {number} x1 - Second x coordinate
 * @param {number} y1 - Second y coordinate
 * @param {number} x - Target x coordinate
 * @returns {number} Interpolated y value
 */
function linearInterpolate(x0, y0, x1, y1, x) {
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/**
 * Get machine speed based on sheet length using linear interpolation
 * @param {string} machineId - Machine identifier (SM25, SM27, SM28)
 * @param {number} sheetLength - Sheet length in mm
 * @returns {number} Speed in m/min
 */
export function getMachineSpeed(machineId, sheetLength) {
  const curve = MACHINE_SPEED_CURVES[machineId] || MACHINE_SPEED_CURVES[DEFAULT_MACHINE];
  
  if (!sheetLength || sheetLength < curve[0].size) {
    return curve[0].speed;
  }
  
  if (sheetLength >= curve[curve.length - 1].size) {
    return curve[curve.length - 1].speed;
  }

  // Find the two points to interpolate between
  for (let i = 0; i < curve.length - 1; i++) {
    if (sheetLength >= curve[i].size && sheetLength < curve[i + 1].size) {
      return linearInterpolate(
        curve[i].size, curve[i].speed,
        curve[i + 1].size, curve[i + 1].speed,
        sheetLength
      );
    }
  }
  
  // Fallback
  return 200;
}
