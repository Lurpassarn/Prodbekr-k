/**
 * Cross-Machine Transfer UI Management
 * Handles all UI-related functionality for cross-machine transfers
 */

/**
 * Create and insert transfer mode toggle section
 * @param {boolean} isTransferMode - Current transfer mode state
 */
export function createTransferModeToggle(isTransferMode) {
  const sidebar = document.querySelector('.sm-sidebar');
  if (!sidebar) return null;

  const config = window.CrossMachineTransferConfig;
  const CSS_CLASSES = config?.CSS_CLASSES || {};
  
  const transferSection = document.createElement('div');
  transferSection.className = CSS_CLASSES.TRANSFER_SECTION || 'transfer-section';
  
  transferSection.innerHTML = `
    <div class="${CSS_CLASSES.TRANSFER_HEADER || 'transfer-header'}">
      <h4>📦 Flytta ordrar</h4>
      <button id="transferModeToggle" class="${CSS_CLASSES.TRANSFER_TOGGLE || 'transfer-toggle'} ${isTransferMode ? (CSS_CLASSES.TRANSFER_ACTIVE || 'active') : ''}">
        ${isTransferMode ? '✅ Aktivt' : '🔄 Aktivera'}
      </button>
    </div>
    <p class="transfer-description">
      ${isTransferMode ? 'Dra ordrar till maskinknapparna nedan för att flytta dem' : 'Aktivera för att flytta ordrar mellan maskiner'}
    </p>
  `;

  // Insert before nav-buttons
  const navButtons = sidebar.querySelector('.nav-buttons');
  if (navButtons) {
    sidebar.insertBefore(transferSection, navButtons);
  }
  
  return transferSection;
}

/**
 * Update transfer mode toggle appearance
 * @param {boolean} isTransferMode - Current transfer mode state
 */
export function updateTransferModeToggle(isTransferMode) {
  const toggleBtn = document.getElementById('transferModeToggle');
  const description = document.querySelector('.transfer-description');
  const config = window.CrossMachineTransferConfig;
  const CSS_CLASSES = config?.CSS_CLASSES || {};
  
  if (toggleBtn) {
    toggleBtn.textContent = isTransferMode ? '✅ Aktivt' : '🔄 Aktivera';
    toggleBtn.classList.toggle(CSS_CLASSES.TRANSFER_ACTIVE || 'active', isTransferMode);
  }
  
  if (description) {
    description.textContent = isTransferMode ? 
      'Dra ordrar till maskinknapparna nedan för att flytta dem' : 
      'Aktivera för att flytta ordrar mellan maskiner';
  }
}

/**
 * Update machine buttons for transfer mode
 * @param {boolean} isTransferMode - Current transfer mode state
 */
export function updateMachineButtonsForTransfer(isTransferMode) {
  const utils = window.CrossMachineTransferUtils;
  const config = window.CrossMachineTransferConfig;
  const CSS_CLASSES = config?.CSS_CLASSES || {};
  
  if (!utils) return;
  
  const otherMachines = utils.getOtherMachines();
  
  otherMachines.forEach(machine => {
    const btn = document.querySelector(`[href$="${machine}.html"]`);
    if (!btn) return;

    // Remove existing transfer indicators
    const existingIndicator = btn.querySelector(`.${CSS_CLASSES.TRANSFER_INDICATOR || 'transfer-indicator'}`);
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Update styling and behavior based on transfer mode
    if (isTransferMode) {
      btn.classList.add(CSS_CLASSES.TRANSFER_MODE_ACTIVE || 'transfer-mode-active');
      btn.title = `Dra ordrar hit för att flytta till ${machine}`;
      
      // Add drop zone indicator
      const indicator = document.createElement('span');
      indicator.className = CSS_CLASSES.TRANSFER_INDICATOR || 'transfer-indicator';
      indicator.innerHTML = config?.HTML_TEMPLATES?.TRANSFER_INDICATOR || '📦';
      btn.appendChild(indicator);
    } else {
      btn.classList.remove(CSS_CLASSES.TRANSFER_MODE_ACTIVE || 'transfer-mode-active');
      btn.title = `Gå till ${machine}`;
    }
  });
}

/**
 * Create transfer status section showing pending transfers
 * @param {Array} incomingTransfers - Array of incoming transfer objects
 */
export function createTransferStatusSection(incomingTransfers) {
  if (incomingTransfers.length === 0) return null;
  
  const config = window.CrossMachineTransferConfig;
  const CSS_CLASSES = config?.CSS_CLASSES || {};
  const HTML_TEMPLATES = config?.HTML_TEMPLATES || {};
  
  const statusDiv = document.createElement('div');
  statusDiv.className = CSS_CLASSES.TRANSFER_STATUS || 'transfer-status';
  
  statusDiv.innerHTML = `
    ${HTML_TEMPLATES.TRANSFER_STATUS_HEADER ? 
      HTML_TEMPLATES.TRANSFER_STATUS_HEADER(incomingTransfers.length) :
      `<div class="transfer-status-header">
        <h4>📥 Inkommande ordrar (${incomingTransfers.length})</h4>
        <button id="acceptAllTransfers" class="transfer-accept-btn">Acceptera alla</button>
      </div>`
    }
    <div class="transfer-list">
      ${incomingTransfers.map((transfer, idx) => 
        HTML_TEMPLATES.TRANSFER_ITEM ? 
          HTML_TEMPLATES.TRANSFER_ITEM(transfer, idx) :
          `<div class="transfer-item" data-index="${idx}">
            <span class="transfer-order">${transfer.order["Kundorder"] || "Okänd"}</span>
            <span class="transfer-from">från ${transfer.fromMachine}</span>
            <button class="transfer-accept-single" data-index="${idx}">✓</button>
            <button class="transfer-reject-single" data-index="${idx}">✗</button>
          </div>`
      ).join('')}
    </div>
  `;
  
  return statusDiv;
}

/**
 * Update transfer status display
 * @param {Array} incomingTransfers - Array of incoming transfer objects
 */
export function updateTransferStatusDisplay(incomingTransfers) {
  const sidebar = document.querySelector('.sm-sidebar');
  const config = window.CrossMachineTransferConfig;
  const CSS_CLASSES = config?.CSS_CLASSES || {};
  
  if (!sidebar) return;
  
  // Remove existing status
  const existingStatus = sidebar.querySelector(`.${CSS_CLASSES.TRANSFER_STATUS || 'transfer-status'}`);
  if (existingStatus) {
    existingStatus.remove();
  }
  
  // Create new status section if there are transfers
  if (incomingTransfers.length > 0) {
    const statusDiv = createTransferStatusSection(incomingTransfers);
    
    if (statusDiv) {
      // Insert at the top of sidebar after logo
      const logo = sidebar.querySelector('.sm-logo');
      if (logo) {
        logo.parentNode.insertBefore(statusDiv, logo.nextSibling);
      }
    }
  }
}

/**
 * Add transfer status event listeners
 * @param {Function} acceptAllCallback - Callback for accept all button
 * @param {Function} acceptSingleCallback - Callback for accept single button
 * @param {Function} rejectSingleCallback - Callback for reject single button
 */
export function addTransferStatusEventListeners(acceptAllCallback, acceptSingleCallback, rejectSingleCallback) {
  // Accept all transfers
  const acceptAllBtn = document.getElementById('acceptAllTransfers');
  if (acceptAllBtn && acceptAllCallback) {
    acceptAllBtn.addEventListener('click', acceptAllCallback);
  }

  // Single transfer actions
  const statusSection = document.querySelector('.transfer-status');
  if (statusSection) {
    statusSection.querySelectorAll('.transfer-accept-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        if (!isNaN(idx) && acceptSingleCallback) {
          acceptSingleCallback(idx);
        }
      });
    });

    statusSection.querySelectorAll('.transfer-reject-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        if (!isNaN(idx) && rejectSingleCallback) {
          rejectSingleCallback(idx);
        }
      });
    });
  }
}

/**
 * Show transfer message to user
 * @param {string} message - Message text
 * @param {string} type - Message type (success, warning, error, info)
 */
export function showTransferMessage(message, type = 'info') {
  const config = window.CrossMachineTransferConfig;
  const CSS_CLASSES = config?.CSS_CLASSES || {};
  const TRANSFER_CONFIG = config?.TRANSFER_CONFIG || {};
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `${CSS_CLASSES.TRANSFER_MESSAGE || 'transfer-message'} transfer-message-${type}`;
  messageDiv.textContent = message;
  
  // Style the message
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${getMessageColor(type)};
    color: ${type === 'warning' ? '#1e293b' : '#fff'};
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideInRight 0.3s ease;
  `;
  
  document.body.appendChild(messageDiv);
  
  // Auto-remove after specified duration
  const duration = TRANSFER_CONFIG.MESSAGE_DURATION || 3000;
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 300);
    }
  }, duration);
}

/**
 * Get message background color based on type
 * @param {string} type - Message type
 * @returns {string} CSS color value
 */
function getMessageColor(type) {
  const colors = {
    success: '#22c55e',
    warning: '#fbbf24',
    error: '#ef4444',
    info: '#3b82f6'
  };
  return colors[type] || colors.info;
}

/**
 * Add drag and drop visual feedback to machine buttons
 * @param {HTMLElement} button - Machine button element
 * @param {string} targetMachine - Target machine ID
 */
export function setupMachineButtonDropZone(button, targetMachine) {
  const config = window.CrossMachineTransferConfig;
  const CSS_CLASSES = config?.CSS_CLASSES || {};
  
  button.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    button.classList.add(CSS_CLASSES.TRANSFER_DROP_TARGET || 'transfer-drop-target');
  });

  button.addEventListener('dragleave', (e) => {
    if (!button.contains(e.relatedTarget)) {
      button.classList.remove(CSS_CLASSES.TRANSFER_DROP_TARGET || 'transfer-drop-target');
    }
  });

  return {
  cleanup: () => {
      button.classList.remove(CSS_CLASSES.TRANSFER_DROP_TARGET || 'transfer-drop-target');
    }
  };
}

// Backward compatibility - expose functions on window
if (typeof window !== 'undefined') {
  window.CrossMachineTransferUI = {
    createTransferModeToggle,
    updateTransferModeToggle,
    updateMachineButtonsForTransfer,
    createTransferStatusSection,
    updateTransferStatusDisplay,
    addTransferStatusEventListeners,
    showTransferMessage,
    setupMachineButtonDropZone
  };
}
