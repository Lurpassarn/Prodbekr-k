/**
 * Cross-Machine Transfer Utilities
 * Utility functions for handling cross-machine order transfers
 */

/**
 * Get current machine ID from the page
 * @returns {string} Machine ID (SM25, SM27, or SM28)
 */
function getCurrentMachine() {
  return document.body.dataset.machine || 'SM25';
}

/**
 * Get all machine IDs except the current one
 * @returns {string[]} Array of other machine IDs
 */
function getOtherMachines() {
  const currentMachine = getCurrentMachine();
  const allMachines = ['SM25', 'SM27', 'SM28'];
  return allMachines.filter(machine => machine !== currentMachine);
}

/**
 * Save pending transfers to localStorage
 * @param {Object} pendingTransfers - Object containing pending transfers by machine
 */
function savePendingTransfers(pendingTransfers) {
  try {
    const config = window.CrossMachineTransferConfig?.TRANSFER_CONFIG;
    const storageKey = config?.STORAGE_KEY || 'pendingTransferOrders';
    localStorage.setItem(storageKey, JSON.stringify(pendingTransfers));
  } catch (error) {
    console.error('Failed to save pending transfers:', error);
  }
}

/**
 * Load pending transfers from localStorage
 * @returns {Object} Object containing pending transfers by machine
 */
function loadPendingTransfers() {
  try {
    const config = window.CrossMachineTransferConfig?.TRANSFER_CONFIG;
    const storageKey = config?.STORAGE_KEY || 'pendingTransferOrders';
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load pending transfers:', error);
    return {};
  }
}

/**
 * Create a transfer object
 * @param {Object} order - The order to transfer
 * @param {string} fromMachine - Source machine ID
 * @param {string} fromShift - Source shift (FM, EM, Natt)
 * @returns {Object} Transfer object
 */
function createTransfer(order, fromMachine, fromShift) {
  return {
    order: order,
    fromMachine: fromMachine,
    fromShift: fromShift,
    timestamp: Date.now(),
    id: `${fromMachine}_${order["Kundorder"] || 'unknown'}_${Date.now()}`
  };
}

/**
 * Add a transfer to the pending transfers
 * @param {string} targetMachine - Target machine ID
 * @param {Object} transfer - Transfer object
 * @param {Object} pendingTransfers - Current pending transfers object
 * @returns {Object} Updated pending transfers object
 */
function addPendingTransfer(targetMachine, transfer, pendingTransfers) {
  const updated = { ...pendingTransfers };
  
  if (!updated[targetMachine]) {
    updated[targetMachine] = [];
  }
  
  // Check for duplicates
  const isDuplicate = updated[targetMachine].some(existing => 
    existing.id === transfer.id || 
    (existing.order["Kundorder"] === transfer.order["Kundorder"] && 
     existing.fromMachine === transfer.fromMachine)
  );
  
  if (!isDuplicate) {
    updated[targetMachine].push(transfer);
    
    // Limit number of pending transfers
    const config = window.CrossMachineTransferConfig?.TRANSFER_CONFIG;
    const maxTransfers = config?.MAX_PENDING_TRANSFERS || 50;
    
    if (updated[targetMachine].length > maxTransfers) {
      updated[targetMachine] = updated[targetMachine].slice(-maxTransfers);
    }
  }
  
  return updated;
}

/**
 * Remove a transfer from pending transfers
 * @param {string} machine - Machine ID
 * @param {number} index - Index of transfer to remove
 * @param {Object} pendingTransfers - Current pending transfers object
 * @returns {Object} Updated pending transfers object
 */
function removePendingTransfer(machine, index, pendingTransfers) {
  const updated = { ...pendingTransfers };
  
  if (updated[machine] && Array.isArray(updated[machine])) {
    updated[machine].splice(index, 1);
    
    // Clean up empty arrays
    if (updated[machine].length === 0) {
      delete updated[machine];
    }
  }
  
  return updated;
}

/**
 * Get pending transfers for a specific machine
 * @param {string} machine - Machine ID
 * @param {Object} pendingTransfers - Pending transfers object
 * @returns {Array} Array of pending transfers for the machine
 */
function getPendingTransfersForMachine(machine, pendingTransfers) {
  return pendingTransfers[machine] || [];
}

/**
 * Clear all pending transfers for a machine
 * @param {string} machine - Machine ID
 * @param {Object} pendingTransfers - Current pending transfers object
 * @returns {Object} Updated pending transfers object
 */
function clearPendingTransfersForMachine(machine, pendingTransfers) {
  const updated = { ...pendingTransfers };
  delete updated[machine];
  return updated;
}

/**
 * Validate if an order can be transferred
 * @param {Object} order - Order object to validate
 * @returns {boolean} True if order can be transferred
 */
function validateOrderForTransfer(order) {
  if (!order) return false;
  
  // Check if order has required properties
  const hasValidId = order["Kundorder"] || order["OrderID"];
  const hasValidWeight = parseFloat(order["Planerad Vikt"] || 0) > 0;
  
  return hasValidId && hasValidWeight;
}

/**
 * Get order display name
 * @param {Object} order - Order object
 * @returns {string} Display name for the order
 */
function getOrderDisplayName(order) {
  return order["Kundorder"] || order["OrderID"] || "Okänd order";
}

/**
 * Format transfer timestamp
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time string
 */
function formatTransferTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Okänd tid';
  }
}

// ES6 Exports
export {
  getCurrentMachine,
  getOtherMachines,
  savePendingTransfers,
  loadPendingTransfers,
  createTransfer,
  addPendingTransfer,
  removePendingTransfer,
  getPendingTransfersForMachine,
  clearPendingTransfersForMachine,
  validateOrderForTransfer,
  getOrderDisplayName,
  formatTransferTime
};

// Export for browser environment (backward compatibility)
if (typeof window !== 'undefined') {
  window.CrossMachineTransferUtils = {
    getCurrentMachine,
    getOtherMachines,
    savePendingTransfers,
    loadPendingTransfers,
    createTransfer,
    addPendingTransfer,
    removePendingTransfer,
    getPendingTransfersForMachine,
    clearPendingTransfersForMachine,
    validateOrderForTransfer,
    getOrderDisplayName,
    formatTransferTime
  };
}

// Export for Node.js environment (backward compatibility)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCurrentMachine,
    getOtherMachines,
    savePendingTransfers,
    loadPendingTransfers,
    createTransfer,
    addPendingTransfer,
    removePendingTransfer,
    getPendingTransfersForMachine,
    clearPendingTransfersForMachine,
    validateOrderForTransfer,
    getOrderDisplayName,
    formatTransferTime
  };
}
