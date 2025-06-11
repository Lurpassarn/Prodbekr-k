// Functional test script for the refactored production system
// This script tests all major modules and functions

console.log('=== TESTING REFACTORED PRODUCTION SYSTEM ===');

// Test 1: Check if all modules are loaded
console.log('\n1. Testing module loading...');

const modules = [
  'MachineSpeedsModule',
  'ShiftsConfig', 
  'CrossMachineTransferConfig',
  'TimeUtilsModule',
  'SpeedCalculatorModule',
  'RollEstimatorModule',
  'ProductionCalculatorModule',
  'SchedulingModule',
  'CrossMachineTransferUtils',
  'CrossMachineTransferUI'
];

modules.forEach(module => {
  if (typeof window !== 'undefined' && window[module]) {
    console.log(`✅ ${module} loaded successfully`);
  } else {
    console.log(`❌ ${module} not found`);
  }
});

// Test 2: Test production calculations
console.log('\n2. Testing production calculations...');

if (typeof window !== 'undefined' && window.ProductionCalculatorModule) {
  const { calculateAllProductionTimes } = window.ProductionCalculatorModule;
  
  // Test order
  const testOrder = {
    "Kundorder": "TEST001",
    "Planerad Vikt": "1000",
    "Gramvikt": "200",
    "Arklängd": "500",
    "RawRollWidth": "1000",
    "Antal banor": "1",
    "Arkbredd": "800",
    "Maskin id": "SM25"
  };
  
  try {
    const result = calculateAllProductionTimes([testOrder]);
    if (result && result.length > 0 && result[0].productionTimeNormal > 0) {
      console.log(`✅ Production calculation works: ${result[0].productionTimeNormal.toFixed(2)} minutes`);
    } else {
      console.log('❌ Production calculation failed');
    }
  } catch (error) {
    console.log('❌ Production calculation error:', error.message);
  }
} else {
  console.log('❌ ProductionCalculatorModule not available');
}

// Test 3: Test time utilities
console.log('\n3. Testing time utilities...');

if (typeof window !== 'undefined' && window.TimeUtilsModule) {
  const { formatTime, parseTime } = window.TimeUtilsModule;
  
  try {
    const formatted = formatTime(150); // 2:30
    const parsed = parseTime("14:30"); // 870 minutes
    
    if (formatted === "02:30" && parsed === 870) {
      console.log('✅ Time utilities work correctly');
    } else {
      console.log(`❌ Time utilities failed: ${formatted}, ${parsed}`);
    }
  } catch (error) {
    console.log('❌ Time utilities error:', error.message);
  }
} else {
  console.log('❌ TimeUtilsModule not available');
}

// Test 4: Test shift configuration
console.log('\n4. Testing shift configuration...');

if (typeof window !== 'undefined' && window.ShiftsConfig) {
  const config = window.ShiftsConfig;
  
  if (config.SHIFT_TIMES && config.SHIFT_TIMES.FM && config.SHIFT_COLORS) {
    console.log('✅ Shift configuration loaded correctly');
    console.log(`  FM shift: ${config.SHIFT_TIMES.FM.START} - ${config.SHIFT_TIMES.FM.END} minutes`);
  } else {
    console.log('❌ Shift configuration incomplete');
  }
} else {
  console.log('❌ ShiftsConfig not available');
}

// Test 5: Test speed calculation
console.log('\n5. Testing speed calculation...');

if (typeof window !== 'undefined' && window.SpeedCalculatorModule) {
  const { getMachineSpeed } = window.SpeedCalculatorModule;
  
  try {
    const speed = getMachineSpeed('SM25', 600);
    if (speed > 0) {
      console.log(`✅ Speed calculation works: ${speed} m/min for 600mm on SM25`);
    } else {
      console.log('❌ Speed calculation returned invalid value');
    }
  } catch (error) {
    console.log('❌ Speed calculation error:', error.message);
  }
} else {
  console.log('❌ SpeedCalculatorModule not available');
}

// Test 6: Test transfer utilities
console.log('\n6. Testing transfer utilities...');

if (typeof window !== 'undefined' && window.CrossMachineTransferUtils) {
  const utils = window.CrossMachineTransferUtils;
  
  try {
    const currentMachine = utils.getCurrentMachine();
    const otherMachines = utils.getOtherMachines();
    
    if (currentMachine && otherMachines && otherMachines.length > 0) {
      console.log(`✅ Transfer utilities work: Current=${currentMachine}, Others=[${otherMachines.join(', ')}]`);
    } else {
      console.log('❌ Transfer utilities returned invalid values');
    }
  } catch (error) {
    console.log('❌ Transfer utilities error:', error.message);
  }
} else {
  console.log('❌ CrossMachineTransferUtils not available');
}

console.log('\n=== TEST COMPLETE ===');
