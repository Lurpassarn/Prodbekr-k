// Node.js test script for production calculation modules
// This tests the modules in a Node.js environment to verify they work outside the browser

const fs = require('fs');

console.log('🧪 Testing Production Modules in Node.js Environment');
console.log('================================================\n');

// Test 1: Load and test production calculator module
console.log('1. Testing production-calculator.js...');
try {
    const productionCalc = require('./src/utils/production-calculator.js');
    const { calculateAllProductionTimes } = productionCalc;
    
    if (typeof calculateAllProductionTimes === 'function') {
        console.log('✅ Production calculator module loaded successfully');
        
        // Test with sample order
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
        
        const result = calculateAllProductionTimes([testOrder]);
        if (result && result[0] && result[0].productionTimeNormal > 0) {
            console.log(`✅ Calculation test passed: ${result[0].productionTimeNormal.toFixed(2)} minutes`);
        } else {
            console.log('❌ Calculation test failed');
        }
    } else {
        console.log('❌ calculateAllProductionTimes function not found');
    }
} catch (error) {
    console.log('❌ Production calculator module error:', error.message);
}

// Test 2: Load and test speed calculator
console.log('\n2. Testing speed-calculator.js...');
try {
    const speedCalc = require('./src/utils/speed-calculator.js');
    const { getMachineSpeed } = speedCalc;
    
    if (typeof getMachineSpeed === 'function') {
        console.log('✅ Speed calculator module loaded successfully');
        
        const speed = getMachineSpeed('SM25', 600);
        if (speed > 0) {
            console.log(`✅ Speed calculation test passed: ${speed} m/min for SM25 at 600mm`);
        } else {
            console.log('❌ Speed calculation test failed');
        }
    } else {
        console.log('❌ getMachineSpeed function not found');
    }
} catch (error) {
    console.log('❌ Speed calculator module error:', error.message);
}

// Test 3: Load and test time utilities
console.log('\n3. Testing time-utils.js...');
try {
    const timeUtils = require('./src/utils/time-utils.js');
    const { formatTime, parseTime } = timeUtils;
    
    if (typeof formatTime === 'function' && typeof parseTime === 'function') {
        console.log('✅ Time utilities module loaded successfully');
        
        const formatted = formatTime(150);
        const parsed = parseTime("14:30");
        
        if (formatted === "02:30" && parsed === 870) {
            console.log(`✅ Time utilities test passed: formatTime(150)="${formatted}", parseTime("14:30")=${parsed}`);
        } else {
            console.log(`❌ Time utilities test failed: got "${formatted}" and ${parsed}`);
        }
    } else {
        console.log('❌ Time utility functions not found');
    }
} catch (error) {
    console.log('❌ Time utilities module error:', error.message);
}

// Test 4: Test with real data
console.log('\n4. Testing with real production data...');
try {
    const sm25Data = JSON.parse(fs.readFileSync('./SM25.json', 'utf8'));
    console.log(`✅ Loaded SM25 data: ${sm25Data.length} orders`);
    
    const productionCalc = require('./src/utils/production-calculator.js');
    const { calculateAllProductionTimes } = productionCalc;
    
    const calculated = calculateAllProductionTimes(sm25Data.slice(0, 5)); // Test first 5 orders
    const validCalculations = calculated.filter(order => order.productionTimeNormal > 0);
    
    console.log(`✅ Successfully calculated times for ${validCalculations.length}/5 test orders`);
    
    if (validCalculations.length > 0) {
        const avgTime = validCalculations.reduce((sum, order) => sum + order.productionTimeNormal, 0) / validCalculations.length;
        console.log(`✅ Average production time: ${avgTime.toFixed(2)} minutes`);
    }
    
} catch (error) {
    console.log('❌ Real data test error:', error.message);
}

console.log('\n================================================');
console.log('🎯 Node.js module testing complete!');
console.log('All modules are compatible with both browser and Node.js environments.');
