// Cross-Machine Order Transfer System (Refactored)
// Allows moving orders between machines via sidebar
// Now uses modular utilities for better maintainability

(function() {
  // State management using transfer utilities
  let pendingTransferOrders = {};
  let isTransferMode = false;

  // Get references to utility modules with fallbacks
  const transferUtils = window.CrossMachineTransferUtils;
  const transferUI = window.CrossMachineTransferUI;
  const transferConfig = window.CrossMachineTransferConfig;

  // Initialize cross-machine functionality
  function initializeCrossMachineTransfer() {
    // Load pending transfers from localStorage
    if (transferUtils) {
      pendingTransferOrders = transferUtils.loadPendingTransfers();
    } else {
      // Fallback to direct localStorage access
      pendingTransferOrders = JSON.parse(localStorage.getItem('pendingTransferOrders') || '{}');
    }

    // Add machine destination buttons to sidebar
    addMachineDestinationButtons();
    
    // Add transfer mode toggle
    addTransferModeToggle();
    
    // Show pending transfers if any
    updateTransferStatus();
    
    // Listen for orders being dragged to sidebar
    setupSidebarDropZone();
  }

  function addTransferModeToggle() {
    const sidebar = document.querySelector('.sm-sidebar');
    if (!sidebar) return;

    // Use modular UI function if available, otherwise fallback
    let transferSection;
    if (transferUI && transferUI.createTransferModeToggle) {
      transferSection = transferUI.createTransferModeToggle(isTransferMode);
    } else {
      // Fallback implementation
      transferSection = createTransferModeToggleLocal();
    }

    if (!transferSection) return;

    // Add toggle functionality
    const toggleBtn = document.getElementById('transferModeToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        isTransferMode = !isTransferMode;
        
        // Use modular UI update if available
        if (transferUI && transferUI.updateTransferModeToggle) {
          transferUI.updateTransferModeToggle(isTransferMode);
        } else {
          // Fallback implementation
          updateTransferModeToggleLocal(isTransferMode);
        }
        
        updateMachineButtonsForTransfer();
        updateTransferStatus();
      });
    }
  }

  function createTransferModeToggleLocal() {
    // Fallback implementation for creating transfer mode toggle
    const sidebar = document.querySelector('.sm-sidebar');
    if (!sidebar) return null;

    const transferSection = document.createElement('div');
    transferSection.className = 'transfer-section';
    transferSection.innerHTML = `
      <div class="transfer-header">
        <h4>📦 Flytta ordrar</h4>
        <button id="transferModeToggle" class="transfer-toggle ${isTransferMode ? 'active' : ''}">
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

  function updateTransferModeToggleLocal(isActive) {
    // Fallback implementation for updating transfer mode toggle
    const toggleBtn = document.getElementById('transferModeToggle');
    const description = document.querySelector('.transfer-description');
    
    if (toggleBtn) {
      toggleBtn.textContent = isActive ? '✅ Aktivt' : '🔄 Aktivera';
      toggleBtn.classList.toggle('active', isActive);
    }
    
    if (description) {
      description.textContent = isActive ? 
        'Dra ordrar till maskinknapparna nedan för att flytta dem' : 
        'Aktivera för att flytta ordrar mellan maskiner';
    }
  }

  function addMachineDestinationButtons() {
    const navButtons = document.querySelector('.nav-buttons');
    if (!navButtons) return;

    // Use transfer utils to get machine info if available
    let currentMachine, otherMachines;
    if (transferUtils) {
      currentMachine = transferUtils.getCurrentMachine();
      otherMachines = transferUtils.getOtherMachines();
    } else {
      // Fallback implementation
      currentMachine = document.body.dataset.machine || 'SM25';
      const allMachines = ['SM25', 'SM27', 'SM28'];
      otherMachines = allMachines.filter(machine => machine !== currentMachine);
    }
    
    // Add transfer destination section
    otherMachines.forEach(machine => {
      const machineBtn = navButtons.querySelector(`[href$="${machine}.html"]`);
      if (machineBtn) {
        machineBtn.classList.add('machine-transfer-target');
        machineBtn.dataset.targetMachine = machine;
        
        // Make it a drop zone when transfer mode is active
        setupMachineButtonAsDropZone(machineBtn, machine);
      }
    });
  }

  function setupMachineButtonAsDropZone(button, targetMachine) {
    const cssClasses = transferConfig?.CSS_CLASSES || {};
    const dropTargetClass = cssClasses.TRANSFER_DROP_TARGET || 'transfer-drop-target';

    button.addEventListener('dragover', (e) => {
      if (!isTransferMode) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      button.classList.add(dropTargetClass);
    });

    button.addEventListener('dragleave', (e) => {
      if (!isTransferMode) return;
      if (!button.contains(e.relatedTarget)) {
        button.classList.remove(dropTargetClass);
      }
    });

    button.addEventListener('drop', (e) => {
      if (!isTransferMode) return;
      e.preventDefault();
      e.stopPropagation();
      button.classList.remove(dropTargetClass);

      const fromShift = e.dataTransfer.getData('shift');
      const fromIdx = parseInt(e.dataTransfer.getData('index'), 10);
      const orderData = e.dataTransfer.getData('orderData');
      
      if (fromShift && !isNaN(fromIdx) && orderData) {
        const order = JSON.parse(orderData);
        transferOrderToMachine(order, fromShift, fromIdx, targetMachine);
      }
    });
  }

  function setupSidebarDropZone() {
    const sidebar = document.querySelector('.sm-sidebar');
    if (!sidebar) return;

    sidebar.addEventListener('dragover', (e) => {
      if (!isTransferMode) return;
      if (e.target.classList.contains('machine-transfer-target')) {
        return; // Let machine buttons handle their own drop
      }
      e.preventDefault();
    });
  }

  function transferOrderToMachine(order, fromShift, fromIdx, targetMachine) {
    // Use transfer utils if available
    if (transferUtils) {
      const currentMachine = transferUtils.getCurrentMachine();
      const transfer = transferUtils.createTransfer(order, currentMachine, fromShift);
      pendingTransferOrders = transferUtils.addPendingTransfer(targetMachine, transfer, pendingTransferOrders);
      transferUtils.savePendingTransfers(pendingTransferOrders);
    } else {
      // Fallback implementation
      const currentMachine = document.body.dataset.machine || 'SM25';
      
      if (!pendingTransferOrders[targetMachine]) {
        pendingTransferOrders[targetMachine] = [];
      }
      
      pendingTransferOrders[targetMachine].push({
        order: order,
        fromMachine: currentMachine,
        fromShift: fromShift,
        timestamp: Date.now()
      });
      
      localStorage.setItem('pendingTransferOrders', JSON.stringify(pendingTransferOrders));
    }
    
    // Remove from current machine's order list
    if (window.currentShifts && window.currentShifts[fromShift]) {
      window.currentShifts[fromShift].splice(fromIdx, 1);
      
      // Trigger recalculation and re-render
      if (typeof window.recalcSchedule === 'function') {
        window.recalcSchedule();
      }
      if (typeof window.renderPage === 'function') {
        window.renderPage();
      }
    }
    
    // Show success message using UI module or fallback
    const orderName = order["Kundorder"] || "okänd";
    if (transferUI && transferUI.showTransferMessage) {
      transferUI.showTransferMessage(`Order ${orderName} flyttad till ${targetMachine}`, 'success');
    } else {
      showTransferMessageLocal(`Order ${orderName} flyttad till ${targetMachine}`, 'success');
    }
    
    // Update transfer status
    updateTransferStatus();
  }

  function updateTransferStatus() {
    // Get current machine
    const currentMachine = transferUtils ? 
      transferUtils.getCurrentMachine() : 
      (document.body.dataset.machine || 'SM25');
    
    const sidebar = document.querySelector('.sm-sidebar');
    
    // Remove existing status
    const existingStatus = sidebar.querySelector('.transfer-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    // Check for incoming transfers
    const incomingTransfers = transferUtils ?
      transferUtils.getPendingTransfersForMachine(currentMachine, pendingTransferOrders) :
      (pendingTransferOrders[currentMachine] || []);
    
    if (incomingTransfers.length > 0) {
      // Use modular UI function if available
      if (transferUI && transferUI.createTransferStatusSection) {
        const statusDiv = transferUI.createTransferStatusSection(incomingTransfers);
        if (statusDiv) {
          // Insert at the top of sidebar
          const logo = sidebar.querySelector('.sm-logo');
          if (logo) {
            logo.parentNode.insertBefore(statusDiv, logo.nextSibling);
          }
        }
      } else {
        // Fallback implementation
        createTransferStatusSectionLocal(incomingTransfers, sidebar);
      }

      // Add event listeners for accept/reject buttons
      setupTransferStatusEventListeners();
    }

    // Update machine buttons with pending count
    updateMachineButtonsForTransfer();
  }

  function createTransferStatusSectionLocal(incomingTransfers, sidebar) {
    // Fallback implementation for creating transfer status section
    const statusDiv = document.createElement('div');
    statusDiv.className = 'transfer-status';
    statusDiv.innerHTML = `
      <div class="transfer-status-header">
        <h4>📥 Inkommande ordrar (${incomingTransfers.length})</h4>
        <button id="acceptAllTransfers" class="transfer-accept-btn">Acceptera alla</button>
      </div>
      <div class="transfer-list">
        ${incomingTransfers.map((transfer, idx) => `
          <div class="transfer-item" data-index="${idx}">
            <span class="transfer-order">${transfer.order["Kundorder"] || "Okänd"}</span>
            <span class="transfer-from">från ${transfer.fromMachine}</span>
            <button class="transfer-accept-single" data-index="${idx}">✓</button>
            <button class="transfer-reject-single" data-index="${idx}">✗</button>
          </div>
        `).join('')}
      </div>
    `;

    // Insert at the top of sidebar
    const logo = sidebar.querySelector('.sm-logo');
    if (logo) {
      logo.parentNode.insertBefore(statusDiv, logo.nextSibling);
    }
  }

  function setupTransferStatusEventListeners() {
    // Add event listeners for accept/reject functionality
    const acceptAllBtn = document.getElementById('acceptAllTransfers');
    if (acceptAllBtn) {
      acceptAllBtn.addEventListener('click', acceptAllTransfers);
    }

    document.querySelectorAll('.transfer-accept-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        acceptSingleTransfer(idx);
      });
    });

    document.querySelectorAll('.transfer-reject-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        rejectSingleTransfer(idx);
      });
    });
  }

  function updateMachineButtonsForTransfer() {
    // Use modular UI function if available
    if (transferUI && transferUI.updateMachineButtonsForTransfer) {
      transferUI.updateMachineButtonsForTransfer(isTransferMode);
    } else {
      // Fallback implementation
      updateMachineButtonsForTransferLocal();
    }
  }

  function updateMachineButtonsForTransferLocal() {
    // Fallback implementation for updating machine buttons
    const machines = ['SM25', 'SM27', 'SM28'];
    const currentMachine = document.body.dataset.machine || 'SM25';
    
    machines.forEach(machine => {
      if (machine === currentMachine) return;
      
      const btn = document.querySelector(`[href$="${machine}.html"]`);
      if (!btn) return;

      // Remove existing transfer indicators
      const existingIndicator = btn.querySelector('.transfer-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }

      // Add transfer mode styling
      if (isTransferMode) {
        btn.classList.add('transfer-mode-active');
        btn.title = `Dra ordrar hit för att flytta till ${machine}`;
        
        // Add drop zone indicator
        const indicator = document.createElement('span');
        indicator.className = 'transfer-indicator';
        indicator.innerHTML = '📦';
        btn.appendChild(indicator);
      } else {
        btn.classList.remove('transfer-mode-active');
        btn.title = `Gå till ${machine}`;
      }
    });
  }

  function acceptAllTransfers() {
    const currentMachine = transferUtils ? 
      transferUtils.getCurrentMachine() : 
      (document.body.dataset.machine || 'SM25');
    
    const transfers = transferUtils ?
      transferUtils.getPendingTransfersForMachine(currentMachine, pendingTransferOrders) :
      (pendingTransferOrders[currentMachine] || []);
    
    if (transfers.length === 0) return;

    // Add all transfers to the current machine's order list
    transfers.forEach(transfer => {
      addOrderToCurrentMachine(transfer.order, transfer.fromShift);
    });

    // Clear pending transfers for this machine using utils or fallback
    if (transferUtils) {
      pendingTransferOrders = transferUtils.clearPendingTransfersForMachine(currentMachine, pendingTransferOrders);
      transferUtils.savePendingTransfers(pendingTransferOrders);
    } else {
      delete pendingTransferOrders[currentMachine];
      localStorage.setItem('pendingTransferOrders', JSON.stringify(pendingTransferOrders));
    }

    // Show success message
    if (transferUI && transferUI.showTransferMessage) {
      transferUI.showTransferMessage(`${transfers.length} ordrar accepterade`, 'success');
    } else {
      showTransferMessageLocal(`${transfers.length} ordrar accepterade`, 'success');
    }

    // Update UI
    updateTransferStatus();
    
    // Refresh the page display
    if (typeof window.loadOrders === 'function') {
      window.loadOrders();
    }
  }

  function acceptSingleTransfer(index) {
    const currentMachine = transferUtils ? 
      transferUtils.getCurrentMachine() : 
      (document.body.dataset.machine || 'SM25');
    
    const transfers = transferUtils ?
      transferUtils.getPendingTransfersForMachine(currentMachine, pendingTransferOrders) :
      (pendingTransferOrders[currentMachine] || []);
    
    if (index < 0 || index >= transfers.length) return;

    const transfer = transfers[index];
    
    // Add to current machine
    addOrderToCurrentMachine(transfer.order, transfer.fromShift);
    
    // Remove from pending using utils or fallback
    if (transferUtils) {
      pendingTransferOrders = transferUtils.removePendingTransfer(currentMachine, index, pendingTransferOrders);
      transferUtils.savePendingTransfers(pendingTransferOrders);
    } else {
      transfers.splice(index, 1);
      if (transfers.length === 0) {
        delete pendingTransferOrders[currentMachine];
      }
      localStorage.setItem('pendingTransferOrders', JSON.stringify(pendingTransferOrders));
    }

    // Show success message
    const orderName = transfer.order["Kundorder"] || "okänd";
    if (transferUI && transferUI.showTransferMessage) {
      transferUI.showTransferMessage(`Order ${orderName} accepterad`, 'success');
    } else {
      showTransferMessageLocal(`Order ${orderName} accepterad`, 'success');
    }

    // Update UI
    updateTransferStatus();
    
    // Refresh the page display
    if (typeof window.loadOrders === 'function') {
      window.loadOrders();
    }
  }

  function rejectSingleTransfer(index) {
    const currentMachine = transferUtils ? 
      transferUtils.getCurrentMachine() : 
      (document.body.dataset.machine || 'SM25');
    
    const transfers = transferUtils ?
      transferUtils.getPendingTransfersForMachine(currentMachine, pendingTransferOrders) :
      (pendingTransferOrders[currentMachine] || []);
    
    if (index < 0 || index >= transfers.length) return;

    const transfer = transfers[index];
    
    // Remove from pending using utils or fallback
    if (transferUtils) {
      pendingTransferOrders = transferUtils.removePendingTransfer(currentMachine, index, pendingTransferOrders);
      transferUtils.savePendingTransfers(pendingTransferOrders);
    } else {
      transfers.splice(index, 1);
      if (transfers.length === 0) {
        delete pendingTransferOrders[currentMachine];
      }
      localStorage.setItem('pendingTransferOrders', JSON.stringify(pendingTransferOrders));
    }

    // Show message
    const orderName = transfer.order["Kundorder"] || "okänd";
    if (transferUI && transferUI.showTransferMessage) {
      transferUI.showTransferMessage(`Order ${orderName} avvisad`, 'warning');
    } else {
      showTransferMessageLocal(`Order ${orderName} avvisad`, 'warning');
    }

    // Update UI
    updateTransferStatus();
  }

  function addOrderToCurrentMachine(order, preferredShift = 'FM') {
    // This would integrate with the existing order management system
    // For now, we'll just add it to the appropriate shift
    if (window.currentShifts && window.currentShifts[preferredShift]) {
      window.currentShifts[preferredShift].push(order);
      
      // Trigger recalculation
      if (typeof window.recalcSchedule === 'function') {
        window.recalcSchedule();
      }
      if (typeof window.renderPage === 'function') {
        window.renderPage();
      }
    }
  }

  function showTransferMessageLocal(message, type = 'info') {
    // Fallback implementation for showing transfer messages
    const messageDiv = document.createElement('div');
    messageDiv.className = `transfer-message transfer-message-${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 3000);
  }

  // Enhance existing drag functionality to include order data
  function enhanceDragFunctionality() {
    // Override the existing dragstart event to include order data
    const originalAddEventListener = Element.prototype.addEventListener;
    Element.prototype.addEventListener = function(type, listener, options) {
      if (type === 'dragstart' && this.classList.contains('order-row')) {
        const enhancedListener = function(e) {
          // Call original listener
          listener.call(this, e);
          
          // Add order data for cross-machine transfer
          if (isTransferMode && window.currentShifts) {
            const shift = e.dataTransfer.getData('shift');
            const index = parseInt(e.dataTransfer.getData('index'), 10);
            
            if (shift && !isNaN(index) && window.currentShifts[shift] && window.currentShifts[shift][index]) {
              const orderData = JSON.stringify(window.currentShifts[shift][index]);
              e.dataTransfer.setData('orderData', orderData);
            }
          }
        };
        
        return originalAddEventListener.call(this, type, enhancedListener, options);
      }
      
      return originalAddEventListener.call(this, type, listener, options);
    };
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initializeCrossMachineTransfer();
    enhanceDragFunctionality();
  });

  // Export functions for use by other modules
  window.CrossMachineTransfer = {
    init: initializeCrossMachineTransfer,
    updateStatus: updateTransferStatus,
    isTransferMode: () => isTransferMode,
    getPendingTransfers: () => pendingTransferOrders
  };
})();
