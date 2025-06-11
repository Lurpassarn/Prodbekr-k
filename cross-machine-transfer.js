/**
 * Cross-Machine Order Transfer System - ES6 Module Version
 * Allows moving orders between machines via sidebar
 */

import { loadPendingTransfers, savePendingTransfers } from './src/utils/transfer-utils.js';
import { createTransferModeToggle, updateTransferModeToggle } from './src/utils/transfer-ui.js';

// State management
let pendingTransferOrders = {};
let isTransferMode = false;

// Initialize cross-machine functionality
export function initializeCrossMachineTransfer() {
  // Load pending transfers from localStorage
  pendingTransferOrders = loadPendingTransfers();
  
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

  const transferSection = createTransferModeToggle(isTransferMode);
  if (!transferSection) return;

  // Add toggle functionality
  const toggleBtn = document.getElementById('transferModeToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isTransferMode = !isTransferMode;
      updateTransferModeToggle(isTransferMode);
      updateMachineButtonsForTransfer();
      updateTransferStatus();
    });
  }
}

function addMachineDestinationButtons() {
  const sidebar = document.querySelector('.sm-sidebar');
  if (!sidebar) return;

  const machines = ['SM25', 'SM27', 'SM28'];
  const currentMachine = document.body.dataset.machine || 'SM25';
  
  const destinationsDiv = document.createElement('div');
  destinationsDiv.className = 'transfer-destinations';
  destinationsDiv.innerHTML = '<h4>📋 Flytta till maskin:</h4>';

  machines.forEach(machine => {
    if (machine === currentMachine) return;
    
    const btn = document.createElement('button');
    btn.className = 'machine-destination-btn';
    btn.dataset.machine = machine;
    btn.textContent = machine;
    btn.style.display = 'none'; // Hidden by default
    
    btn.addEventListener('click', () => transferSelectedOrders(machine));
    destinationsDiv.appendChild(btn);
  });

  // Insert before nav-buttons
  const navButtons = sidebar.querySelector('.nav-buttons');
  if (navButtons) {
    sidebar.insertBefore(destinationsDiv, navButtons);
  }
}

function updateMachineButtonsForTransfer() {
  const buttons = document.querySelectorAll('.machine-destination-btn');
  buttons.forEach(btn => {
    btn.style.display = isTransferMode ? 'block' : 'none';
  });
}

function updateTransferStatus() {
  // Update pending transfer display
  const count = Object.keys(pendingTransferOrders).length;
  const statusElement = document.getElementById('transferStatus');
  
  if (statusElement) {
    if (count > 0) {
      statusElement.textContent = `📦 ${count} order${count > 1 ? 's' : ''} väntar på flytt`;
      statusElement.style.display = 'block';
    } else {
      statusElement.style.display = 'none';
    }
  }
}

function setupSidebarDropZone() {
  const sidebar = document.querySelector('.sm-sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('dragover', (e) => {
    if (isTransferMode) {
      e.preventDefault();
      sidebar.classList.add('transfer-drop-zone');
    }
  });

  sidebar.addEventListener('dragleave', () => {
    sidebar.classList.remove('transfer-drop-zone');
  });

  sidebar.addEventListener('drop', (e) => {
    e.preventDefault();
    sidebar.classList.remove('transfer-drop-zone');
    
    if (!isTransferMode) return;
    
    const orderId = e.dataTransfer.getData('text/plain');
    if (orderId) {
      markOrderForTransfer(orderId);
    }
  });
}

function markOrderForTransfer(orderId) {
  // Find the order element and mark it for transfer
  const orderElement = document.querySelector(`[data-order-id="${orderId}"]`);
  if (!orderElement) return;

  orderElement.classList.add('marked-for-transfer');
  
  // Store order data for transfer
  const orderData = extractOrderData(orderElement);
  if (orderData) {
    pendingTransferOrders[orderId] = orderData;
    savePendingTransfers(pendingTransferOrders);
    updateTransferStatus();
  }
}

function transferSelectedOrders(targetMachine) {
  const markedOrders = document.querySelectorAll('.marked-for-transfer');
  let transferCount = 0;

  markedOrders.forEach(orderElement => {
    const orderId = orderElement.dataset.orderId;
    if (orderId && pendingTransferOrders[orderId]) {
      // Execute transfer
      executeTransfer(orderId, targetMachine);
      
      // Remove from DOM
      orderElement.remove();
      
      // Remove from pending transfers
      delete pendingTransferOrders[orderId];
      transferCount++;
    }
  });

  if (transferCount > 0) {
    savePendingTransfers(pendingTransferOrders);
    updateTransferStatus();
    
    // Show success message
    showTransferMessage(`✅ ${transferCount} order${transferCount > 1 ? 's' : ''} flyttad${transferCount > 1 ? 'e' : ''} till ${targetMachine}`);
    
    // Refresh the current page to update displays
    if (window.recalcSchedule) {
      window.recalcSchedule();
    }
  }
}

function executeTransfer(orderId, targetMachine) {
  // Implementation for actually moving order data between machines
  // This would typically involve updating JSON files or database
  console.log(`Transferring order ${orderId} to ${targetMachine}`);
}

function extractOrderData(orderElement) {
  // Extract order data from DOM element
  const orderId = orderElement.dataset.orderId;
  const orderData = {
    id: orderId,
    // Add other relevant order data extraction
  };
  
  return orderData;
}

function showTransferMessage(message) {
  // Show temporary success message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'transfer-message';
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 1000;
    font-weight: 500;
  `;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

// Make functions available globally for backward compatibility
window.initializeCrossMachineTransfer = initializeCrossMachineTransfer;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCrossMachineTransfer);
} else {
  initializeCrossMachineTransfer();
}