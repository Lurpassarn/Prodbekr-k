// Cross-Machine Order Transfer System
// Allows moving orders between machines via sidebar

(function() {
  let pendingTransferOrders = JSON.parse(localStorage.getItem('pendingTransferOrders') || '{}');
  let isTransferMode = false;

  // Initialize cross-machine functionality
  function initializeCrossMachineTransfer() {
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

    // Add toggle functionality
    const toggleBtn = document.getElementById('transferModeToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        isTransferMode = !isTransferMode;
        toggleBtn.textContent = isTransferMode ? '✅ Aktivt' : '🔄 Aktivera';
        toggleBtn.classList.toggle('active', isTransferMode);
        
        const description = transferSection.querySelector('.transfer-description');
        description.textContent = isTransferMode ? 
          'Dra ordrar till maskinknapparna nedan för att flytta dem' : 
          'Aktivera för att flytta ordrar mellan maskiner';
        
        updateMachineButtonsForTransfer();
        updateTransferStatus();
      });
    }
  }

  function addMachineDestinationButtons() {
    const navButtons = document.querySelector('.nav-buttons');
    if (!navButtons) return;

    const currentMachine = document.body.dataset.machine || 'SM25';
    const machines = ['SM25', 'SM27', 'SM28'];
    
    // Add transfer destination section
    machines.forEach(machine => {
      if (machine === currentMachine) return;

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
    button.addEventListener('dragover', (e) => {
      if (!isTransferMode) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      button.classList.add('transfer-drop-target');
    });

    button.addEventListener('dragleave', (e) => {
      if (!isTransferMode) return;
      if (!button.contains(e.relatedTarget)) {
        button.classList.remove('transfer-drop-target');
      }
    });

    button.addEventListener('drop', (e) => {
      if (!isTransferMode) return;
      e.preventDefault();
      e.stopPropagation();
      button.classList.remove('transfer-drop-target');

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
    const currentMachine = document.body.dataset.machine || 'SM25';
    
    // Save to pending transfers
    if (!pendingTransferOrders[targetMachine]) {
      pendingTransferOrders[targetMachine] = [];
    }
    
    pendingTransferOrders[targetMachine].push({
      order: order,
      fromMachine: currentMachine,
      fromShift: fromShift,
      timestamp: Date.now()
    });
    
    // Save to localStorage
    localStorage.setItem('pendingTransferOrders', JSON.stringify(pendingTransferOrders));
    
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
    
    // Show success message
    showTransferMessage(`Order ${order["Kundorder"] || "okänd"} flyttad till ${targetMachine}`, 'success');
    
    // Update transfer status
    updateTransferStatus();
  }

  function updateTransferStatus() {
    const currentMachine = document.body.dataset.machine || 'SM25';
    const sidebar = document.querySelector('.sm-sidebar');
    
    // Remove existing status
    const existingStatus = sidebar.querySelector('.transfer-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    // Check for incoming transfers
    const incomingTransfers = pendingTransferOrders[currentMachine] || [];
    
    if (incomingTransfers.length > 0) {
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

      // Add event listeners
      const acceptAllBtn = document.getElementById('acceptAllTransfers');
      if (acceptAllBtn) {
        acceptAllBtn.addEventListener('click', acceptAllTransfers);
      }

      statusDiv.querySelectorAll('.transfer-accept-single').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          acceptSingleTransfer(idx);
        });
      });

      statusDiv.querySelectorAll('.transfer-reject-single').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          rejectSingleTransfer(idx);
        });
      });
    }

    // Update machine buttons with pending count
    updateMachineButtonsForTransfer();
  }

  function updateMachineButtonsForTransfer() {
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
    const currentMachine = document.body.dataset.machine || 'SM25';
    const transfers = pendingTransferOrders[currentMachine] || [];
    
    if (transfers.length === 0) return;

    // Add all transfers to the current machine's order list
    transfers.forEach(transfer => {
      addOrderToCurrentMachine(transfer.order, transfer.fromShift);
    });

    // Clear pending transfers for this machine
    delete pendingTransferOrders[currentMachine];
    localStorage.setItem('pendingTransferOrders', JSON.stringify(pendingTransferOrders));

    // Show success message
    showTransferMessage(`${transfers.length} ordrar accepterade`, 'success');

    // Update UI
    updateTransferStatus();
    
    // Refresh the page display
    if (typeof window.loadOrders === 'function') {
      window.loadOrders();
    }
  }

  function acceptSingleTransfer(index) {
    const currentMachine = document.body.dataset.machine || 'SM25';
    const transfers = pendingTransferOrders[currentMachine] || [];
    
    if (index < 0 || index >= transfers.length) return;

    const transfer = transfers[index];
    
    // Add to current machine
    addOrderToCurrentMachine(transfer.order, transfer.fromShift);
    
    // Remove from pending
    transfers.splice(index, 1);
    if (transfers.length === 0) {
      delete pendingTransferOrders[currentMachine];
    }
    localStorage.setItem('pendingTransferOrders', JSON.stringify(pendingTransferOrders));

    // Show success message
    showTransferMessage(`Order ${transfer.order["Kundorder"] || "okänd"} accepterad`, 'success');

    // Update UI
    updateTransferStatus();
    
    // Refresh the page display
    if (typeof window.loadOrders === 'function') {
      window.loadOrders();
    }
  }

  function rejectSingleTransfer(index) {
    const currentMachine = document.body.dataset.machine || 'SM25';
    const transfers = pendingTransferOrders[currentMachine] || [];
    
    if (index < 0 || index >= transfers.length) return;

    const transfer = transfers[index];
    
    // Remove from pending
    transfers.splice(index, 1);
    if (transfers.length === 0) {
      delete pendingTransferOrders[currentMachine];
    }
    localStorage.setItem('pendingTransferOrders', JSON.stringify(pendingTransferOrders));

    // Show message
    showTransferMessage(`Order ${transfer.order["Kundorder"] || "okänd"} avvisad`, 'warning');

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

  function showTransferMessage(message, type = 'info') {
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
