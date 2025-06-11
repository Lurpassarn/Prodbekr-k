/**
 * Cross-Machine Transfer Configuration and Constants
 * Contains configuration and constants for cross-machine order transfers
 */

// Transfer mode states
const TRANSFER_MODES = {
  INACTIVE: 'inactive',
  ACTIVE: 'active'
};

// Transfer message types
const TRANSFER_MESSAGE_TYPES = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  INFO: 'info'
};

// Machine configurations
const MACHINE_CONFIG = {
  SM25: {
    name: 'SM25',
    displayName: 'SM25',
    color: '#2563eb'
  },
  SM27: {
    name: 'SM27', 
    displayName: 'SM27',
    color: '#10b981'
  },
  SM28: {
    name: 'SM28',
    displayName: 'SM28', 
    color: '#f59e0b'
  }
};

// Default transfer settings
const TRANSFER_CONFIG = {
  DEFAULT_SHIFT: 'FM',
  MESSAGE_DURATION: 3000,
  STORAGE_KEY: 'pendingTransferOrders',
  AUTO_SAVE: true,
  MAX_PENDING_TRANSFERS: 50
};

// CSS class names for consistency
const CSS_CLASSES = {
  TRANSFER_SECTION: 'transfer-section',
  TRANSFER_HEADER: 'transfer-header',
  TRANSFER_TOGGLE: 'transfer-toggle',
  TRANSFER_ACTIVE: 'active',
  TRANSFER_MODE_ACTIVE: 'transfer-mode-active',
  TRANSFER_DROP_TARGET: 'transfer-drop-target',
  TRANSFER_INDICATOR: 'transfer-indicator',
  TRANSFER_STATUS: 'transfer-status',
  TRANSFER_MESSAGE: 'transfer-message',
  MACHINE_TRANSFER_TARGET: 'machine-transfer-target'
};

// HTML templates
const HTML_TEMPLATES = {
  TRANSFER_TOGGLE_SECTION: `
    <div class="transfer-header">
      <h4>📦 Flytta ordrar</h4>
      <button id="transferModeToggle" class="transfer-toggle">
        🔄 Aktivera
      </button>
    </div>
    <p class="transfer-description">
      Aktivera för att flytta ordrar mellan maskiner
    </p>
  `,
  
  TRANSFER_STATUS_HEADER: (count) => `
    <div class="transfer-status-header">
      <h4>📥 Inkommande ordrar (${count})</h4>
      <button id="acceptAllTransfers" class="transfer-accept-btn">Acceptera alla</button>
    </div>
  `,
  
  TRANSFER_ITEM: (transfer, index) => `
    <div class="transfer-item" data-index="${index}">
      <span class="transfer-order">${transfer.order["Kundorder"] || "Okänd"}</span>
      <span class="transfer-from">från ${transfer.fromMachine}</span>
      <button class="transfer-accept-single" data-index="${index}">✓</button>
      <button class="transfer-reject-single" data-index="${index}">✗</button>
    </div>
  `,
  
  TRANSFER_INDICATOR: '📦'
};

// Export for browser environment
if (typeof window !== 'undefined') {
  window.CrossMachineTransferConfig = {
    TRANSFER_MODES,
    TRANSFER_MESSAGE_TYPES,
    MACHINE_CONFIG,
    TRANSFER_CONFIG,
    CSS_CLASSES,
    HTML_TEMPLATES
  };
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRANSFER_MODES,
    TRANSFER_MESSAGE_TYPES,
    MACHINE_CONFIG,
    TRANSFER_CONFIG,
    CSS_CLASSES,
    HTML_TEMPLATES
  };
}
