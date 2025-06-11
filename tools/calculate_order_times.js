const fs = require("fs");

// Speed curves identical to production.js
const machineSpeedCurves = {
  SM25: [
    { size: 400, speed: 70 },
    { size: 500, speed: 100 },
    { size: 600, speed: 150 },
    { size: 700, speed: 230 },
    { size: 750, speed: 300 },
    { size: 900, speed: 300 },
    { size: 950, speed: 280 },
    { size: 1000, speed: 250 },
    { size: 1100, speed: 225 },
    { size: 1400, speed: 200 },
    { size: 1600, speed: 200 }
  ],
  SM27: [
    { size: 400, speed: 30 },
    { size: 500, speed: 150 },
    { size: 600, speed: 200 },
    { size: 700, speed: 270 },
    { size: 720, speed: 300 },
    { size: 900, speed: 300 },
    { size: 1200, speed: 300 },
    { size: 1800, speed: 300 }
  ],
  SM28: [
    { size: 400, speed: 240 },
    { size: 450, speed: 270 },
    { size: 500, speed: 300 },
    { size: 650, speed: 300 },
    { size: 700, speed: 280 },
    { size: 800, speed: 260 },
    { size: 900, speed: 260 },
    { size: 1200, speed: 260 },
    { size: 1800, speed: 260 }
  ]
};

function getMachineSpeed(machineId, sheetLength) {
  const curve = machineSpeedCurves[machineId] || machineSpeedCurves["SM28"];
  if (!sheetLength || sheetLength < curve[0].size) return curve[0].speed;
  if (sheetLength >= curve[curve.length - 1].size) return curve[curve.length - 1].speed;
  for (let i = 0; i < curve.length - 1; i++) {
    if (sheetLength >= curve[i].size && sheetLength < curve[i + 1].size) {
      const x0 = curve[i].size, y0 = curve[i].speed;
      const x1 = curve[i + 1].size, y1 = curve[i + 1].speed;
      return y0 + (y1 - y0) * (sheetLength - x0) / (x1 - x0);
    }
  }
  return 200;
}

function estimateRollCount(order) {
  const reservedWeight = parseFloat(order["Reserverad Vikt"] || "0").toString().replace(/\s/g, "") || 0;
  const plannedWeight = parseFloat(order["Planerad Vikt"] || "0").toString().replace(/\s/g, "") || 0;
  const gramvikt = parseFloat(order["Gramvikt"]) || 0;
  const rawRollWidthStr = order["RawRollWidth"] || "";
  const rawRollWidths = rawRollWidthStr.split(",").map(x => parseFloat(x.trim()) || 0).filter(w => w > 0);
  const numUniqueWidths = new Set(rawRollWidths).size;
  const maxRawRollWidth = Math.max(...rawRollWidths, 0);
  const sheetLength = parseFloat(order["Arklängd"]) || 0;
  const lanes = parseFloat(order["Antal banor"]) || 1;
  const expectedWidth = parseFloat(order["Arkbredd"]) || 0;

  const rollsStr = order["Rullar"] || "";
  const [availableRollsStr, allocatedRollsStr] = rollsStr.split("(").map(s => s.replace(")", ""));
  const availableRolls = parseInt(availableRollsStr) || 0;
  const allocatedRolls = parseInt(allocatedRollsStr) || 0;

  let rolls;
  if (reservedWeight > 0 && allocatedRolls > 0) {
    rolls = allocatedRolls;
  } else if (plannedWeight > 0 && (availableRolls > 0 || allocatedRolls > 0)) {
    const adjustedPlannedWeight = plannedWeight * 1.1;
    const avgWeightWithAllocated = allocatedRolls > 0 ? adjustedPlannedWeight / allocatedRolls : Infinity;
    rolls = (avgWeightWithAllocated >= 100 && avgWeightWithAllocated <= 5000 && allocatedRolls > availableRolls) ? allocatedRolls : availableRolls;
  } else if (plannedWeight > 0) {
    const adjustedPlannedWeight = plannedWeight * 1.1;
    if (adjustedPlannedWeight < 2000) {
      rolls = numUniqueWidths > 0 ? numUniqueWidths : 2;
      if (numUniqueWidths === 5) rolls = 5;
    } else {
      rolls = Math.max(2, numUniqueWidths);
      if (numUniqueWidths === 5) rolls = 5;
    }
  } else {
    const rollWeightPerMeter = (gramvikt * maxRawRollWidth) / 1000000;
    const estimatedTotalLength = plannedWeight * 1.1 / rollWeightPerMeter;
    rolls = Math.ceil(estimatedTotalLength / (sheetLength || 1));
  }

  const spillFactor = expectedWidth > 0 && maxRawRollWidth > 0 ? Math.max(0.5, 1 - (expectedWidth * lanes) / maxRawRollWidth) : 1;
  if (spillFactor < 0.5) console.warn("Hög spillfaktor för order", order["Kundorder"]);

  return rolls;
}

function calculateStopTimes(order) {
  const machineId = order["Maskin id"] || "SM28";
  const rawRollWidthStr = order["RawRollWidth"] || "";
  
  if (!rawRollWidthStr) {
    console.warn(`⚠️  Saknar RawRollWidth för order ${order["Kundorder"]}`);
    return { normalStopTime: 15 * 60, saxningStopTime: 0 };
  }
  
  const rawRollWidth = parseFloat(rawRollWidthStr.split(",")[0]) || 0;
  const rolls = estimateRollCount(order);

  const normalSetupTime = 15 * 60; // 15 minutes setup
  const normalStopTime = normalSetupTime + rolls * 90; // 90 seconds per roll

  const isSaxningEligible = (machineId === "SM27" || machineId === "SM28") && 
                           rawRollWidth <= 1035 && rolls >= 2;
  const saxningSetupTime = 25 * 60; // 25 minutes setup for saxning
  const numSaxningPairs = Math.ceil(rolls / 2);
  const saxningStopTime = isSaxningEligible ? 
    saxningSetupTime + (numSaxningPairs * 10 * 60) : 0; // 10 minutes per pair

  return { normalStopTime, saxningStopTime };
}

function calculateProductionTime(order) {
  const machineId = order["Maskin id"] || "SM28";
  const sheetLength = parseFloat(order["Arklängd"]) || 0;
  const speed = getMachineSpeed(machineId, sheetLength);

  const planeradVikt = parseFloat((order["Planerad Vikt"] || "0").toString().replace(/\s/g, "")) || 0;
  const gramvikt = parseFloat(order["Gramvikt"]) || 0;
  const rawRollWidthStr = order["RawRollWidth"] || "";
  const rawRollWidths = rawRollWidthStr.split(",").map(x => parseFloat(x.trim()) || 0);
  const maxRawRollWidth = Math.max(...rawRollWidths, 0);
  const lanes = parseFloat(order["Antal banor"]) || 1;
  const expectedWidth = parseFloat(order["Arkbredd"]) || 0;

  if (gramvikt <= 0 || maxRawRollWidth <= 0 || speed <= 0 || planeradVikt <= 0) {
    console.warn(`⚠️  Ogiltiga värden för order ${order["Kundorder"]}:`, {
      gramvikt, maxRawRollWidth, speed, planeradVikt
    });
    return { normalTime: 0, saxningTime: 0 };
  }

  const L = (planeradVikt * 1000000) / (gramvikt * maxRawRollWidth);
  const spillFactor = expectedWidth > 0 && maxRawRollWidth > 0 ? 
    Math.max(0.5, 1 - (expectedWidth * lanes) / maxRawRollWidth) : 1;
  
  // Ensure we don't divide by an invalid spillFactor
  const adjustedSpillFactor = spillFactor > 0 ? spillFactor : 1;
  const productionTimeMinutes = (L / speed) / adjustedSpillFactor;
  const productionTimeSeconds = productionTimeMinutes * 60;

  const { normalStopTime, saxningStopTime } = calculateStopTimes(order);

  const normalTime = (productionTimeSeconds + normalStopTime) / 60;
  const saxningTime = saxningStopTime > 0 ? (productionTimeSeconds + saxningStopTime) / 60 : 0;

  // Add validation for reasonable times (not more than 24 hours)
  if (normalTime > 1440) {
    console.warn(`⚠️  Ovanligt lång produktionstid för order ${order["Kundorder"]}: ${normalTime.toFixed(2)} min`);
  }

  return { normalTime, saxningTime };
}

function calculateAllProductionTimes(orders) {
  return orders.map(order => {
    const { normalTime, saxningTime } = calculateProductionTime(order);
    return { ...order, productionTimeNormal: normalTime, productionTimeSaxning: saxningTime };
  });
}

function processFile(inputPath) {
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const result = calculateAllProductionTimes(data);
  const outPath = inputPath.replace(/\.json$/i, "_with_times.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node tools/calculate_order_times.js <jsonFile...>");
    process.exit(1);
  }
  files.forEach(processFile);
}

