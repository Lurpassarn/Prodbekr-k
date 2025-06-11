/**
 * Time utility functions for the production system
 * Provides formatting and parsing functions for time values
 */

/**
 * Format minutes to HH:MM string with "kl" prefix
 * @param {number} minutes - Time in minutes since midnight
 * @returns {string} Formatted time string like "kl 06:30"
 */
function formatTime(minutes) {
  if (!minutes && minutes !== 0) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `kl ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 * @param {string} str - Time string in format "HH:MM"
 * @returns {number} Minutes since midnight, or NaN if invalid
 */
function parseTime(str) {
  const [h, m] = str.split(":").map(n => parseInt(n, 10));
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

/**
 * Format duration in minutes to human readable format
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration like "2h 30min"
 */
function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ES6 Exports
export { formatTime, parseTime, formatDuration };

// Export for browser environment (backward compatibility)
if (typeof window !== 'undefined') {
  window.TimeUtilsModule = {
    formatTime,
    parseTime,
    formatDuration
  };
}

// Export for Node.js environment (backward compatibility)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatTime,
    parseTime,
    formatDuration
  };
}