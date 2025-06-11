// Test ES6 module imports in Node.js environment
import { distributeOrdersToShifts, calculateShiftStats } from './src/utils/scheduling.js';
import { createTransferModeToggle, updateTransferModeToggle } from './src/utils/transfer-ui.js';

console.log('✅ ES6 imports successful');
console.log('scheduling functions:', typeof distributeOrdersToShifts, typeof calculateShiftStats);
console.log('transfer-ui functions:', typeof createTransferModeToggle, typeof updateTransferModeToggle);

// Test if functions are callable
if (typeof calculateShiftStats === 'function') {
    const testResult = calculateShiftStats({ FM: [], EM: [], Natt: [] });
    console.log('✅ calculateShiftStats works:', Object.keys(testResult));
}

console.log('All ES6 module tests passed!');
