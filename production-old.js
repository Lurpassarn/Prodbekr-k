// Förbättrade och exakta hastighetskurvor baserat på din feedback
const machineSpeedCurves = {
  SM25: [
    { size: 400, speed: 70 }, // Startpunkt
    { size: 500, speed: 100 }, // Ökning
    { size: 600, speed: 150 }, // Övergång
    { size: 700, speed: 230 }, // Nära topp
    { size: 750, speed: 300 }, // Maxhastighet uppnås
    { size: 900, speed: 300 }, // Håller max
    { size: 950, speed: 280 }, // Början av nedgång
    { size: 1000, speed: 250 }, // Fortsatt nedgång
    { size: 1100, speed: 225 }, // Vidare nedgång
    { size: 1400, speed: 200 }, // Stabiliserad minsta hastighet
    { size: 1600, speed: 200 } // Håller konstant till max arkstorlek
  ],
  SM27: [
    { size: 400, speed: 30 }, // Startpunkt (knappt 30 m/min)
    { size: 500, speed: 150 }, // Ökning
    { size: 600, speed: 200 }, // Övergång
    { size: 700, speed: 270 }, // Nära topp
    { size: 720, speed: 300 }, // Maxhastighet uppnås
    { size: 900, speed: 300 }, // Platå
    { size: 1200, speed: 300 }, // Håller konstant
    { size: 1800, speed: 300 } // Håller konstant till max arkstorlek
  ],
  SM28: [
    { size: 400, speed: 240 }, // Startpunkt
    { size: 450, speed: 270 }, // Ökning
    { size: 500, speed: 300 }, // Topphastighet
    { size: 650, speed: 300 }, // Håller 300 m/min
    { size: 700, speed: 280 }, // Början av nedgång
    { size: 800, speed: 260 }, // Fortsatt nedgång
    { size: 900, speed: 260 }, // Stabiliserad hastighet
    { size: 1200, speed: 260 }, // Håller konstant
    { size: 1800, speed: 260 } // Håller konstant till max arkstorlek
  ]
};

// Funktion för att interpolera hastighet baserat på arkstorlek med linjär interpolation
function getMachineSpeed (machineId, sheetLength) {
  const curve = machineSpeedCurves[machineId] || machineSpeedCurves["SM28"];
  if (!sheetLength || sheetLength < curve[0].size) return curve[0].speed;
  if (sheetLength >= curve[curve.length - 1].size)
    return curve[curve.length - 1].speed;

  for (let i = 0; i < curve.length - 1; i++) {
    if (sheetLength >= curve[i].size && sheetLength < curve[i + 1].size) {
      const x0 = curve[i].size,
        y0 = curve[i].speed;
      const x1 = curve[i + 1].size,
        y1 = curve[i + 1].speed;
      return y0 + ((y1 - y0) * (sheetLength - x0)) / (x1 - x0);
    }
  }
  return 200; // Fallback för SM25 vid över 1600 mm
}

// Funktion för att uppskatta antalet rullar med validering mot Planerad Vikt
function estimateRollCount (order) {
  const reservedWeight =
    parseFloat(order["Reserverad Vikt"] || "0")
      .toString()
      .replace(/\s/g, "") || 0;
  const plannedWeight =
    parseFloat(order["Planerad Vikt"] || "0")
      .toString()
      .replace(/\s/g, "") || 0;
  const gramvikt = parseFloat(order["Gramvikt"]) || 0;
  const rawRollWidthStr = order["RawRollWidth"] || "";
  const rawRollWidths = rawRollWidthStr
    .split(",")
    .map(x => parseFloat(x.trim()) || 0)
    .filter(w => w > 0);
  const numUniqueWidths = new Set(rawRollWidths).size;
  const maxRawRollWidth = Math.max(...rawRollWidths, 0);
  const sheetLength = parseFloat(order["Arklängd"]) || 0;
  const lanes = parseFloat(order["Antal banor"]) || 1;
  const expectedWidth = parseFloat(order["Arkbredd"]) || 0;

  // Parsa "Rullar" för både tillgängliga och allokerade rullar
  const rollsStr = order["Rullar"] || "";
  const [availableRollsStr, allocatedRollsStr] = rollsStr
    .split("(")
    .map(s => s.replace(")", ""));
  const availableRolls = parseInt(availableRollsStr) || 0;
  const allocatedRolls = parseInt(allocatedRollsStr) || 0;

  let rolls;
  if (reservedWeight > 0 && allocatedRolls > 0) {
    rolls = allocatedRolls; // Prioritera allokerade rullar om Reserverad Vikt finns
    const avgRollWeight = reservedWeight / rolls;
    console.log(
      `Snittvikt per rulle för ${
        order["Kundorder"] || "okänd"
      }: ${avgRollWeight} kg (baserat på Reserverad Vikt)`
    );
  } else if (plannedWeight > 0 && (availableRolls > 0 || allocatedRolls > 0)) {
    // Validera mot Planerad Vikt för att välja rätt antal rullar
    const adjustedPlannedWeight = plannedWeight * 1.1; // 10% ökning
    const avgWeightWithAvailable = adjustedPlannedWeight / availableRolls;
    const avgWeightWithAllocated =
      allocatedRolls > 0 ? adjustedPlannedWeight / allocatedRolls : Infinity;

    // Välj det värde som ger en rimlig snittvikt (t.ex. mellan 100 och 5000 kg)
    rolls =
      avgWeightWithAllocated >= 100 &&
      avgWeightWithAllocated <= 5000 &&
      allocatedRolls > availableRolls
        ? allocatedRolls
        : availableRolls;
    const avgRollWeight = adjustedPlannedWeight / rolls;
    console.log(
      `Uppskattad snittvikt per rulle för ${
        order["Kundorder"] || "okänd"
      }: ${avgRollWeight} kg (baserat på Planerad Vikt + 10%)`
    );
  } else if (plannedWeight > 0) {
    // Fallback vid 0 "Reserverad Vikt" och "Rullar"
    const adjustedPlannedWeight = plannedWeight * 1.1;
    if (adjustedPlannedWeight < 2000) {
      if (numUniqueWidths > 0) {
        rolls = numUniqueWidths; // Under 2 ton, prioritera antal bredder
      } else {
        rolls = 2; // Under 2 ton och en bredd = minst 2 rullar
      }
      if (numUniqueWidths === 5) rolls = 5; // Minst 5 rullar om 5 bredder
    } else {
      rolls = Math.max(2, numUniqueWidths); // Över 2 ton = minst 2, minst 1 per unik bredd
      if (numUniqueWidths === 5) rolls = 5; // Minst 5 rullar om 5 bredder
    }
    const avgRollWeight = adjustedPlannedWeight / rolls;
    console.log(
      `Uppskattad snittvikt per rulle för ${
        order["Kundorder"] || "okänd"
      }: ${avgRollWeight} kg (baserat på Planerad Vikt + 10% och vikt/breddregel)`
    );
  } else {
    // Fallback uppskattning om ingen viktdata finns
    const rollWeightPerMeter = (gramvikt * maxRawRollWidth) / 1000000; // kg/m
    const estimatedTotalLength = (plannedWeight * 1.1) / rollWeightPerMeter;
    rolls = Math.ceil(estimatedTotalLength / (sheetLength || 1)); // Uppskattat antal rullar
  }

  // Spillfaktor (om förväntad bredd inte matchar rullbredd)
  const spillFactor =
    expectedWidth > 0 && maxRawRollWidth > 0
      ? Math.max(0.5, 1 - (expectedWidth * lanes) / maxRawRollWidth)
      : 1;
  if (spillFactor < 0.5)
    console.warn(
      `Hög spillfaktor för order ${order["Kundorder"] || "okänd"}:`,
      spillFactor
    );

  return rolls; // Antal planerade rullar, oavsett rullställ
}

// Funktion för att beräkna stopptid för normal drift och saxning
function calculateStopTimes (order) {
  const machineId = order["Maskin id"] || "SM28";
  const rawRollWidth = parseFloat(order["RawRollWidth"].split(",")[0]) || 0;
  const rolls = estimateRollCount(order);

  // Normal drift: 15 minuter omställning + 90 sekunder per rulle
  const normalSetupTime = 15 * 60; // 900 sekunder
  const normalStopTime = normalSetupTime + rolls * 90;

  // Saxning för SM27 och SM28 vid rullar ≤ 1035 mm och minst 2 rullar
  // 10 minuter laddning per par rullar i drift (max 2 åt gången)
  const isSaxningEligible =
    (machineId === "SM27" || machineId === "SM28") &&
    rawRollWidth <= 1035 &&
    rolls >= 2;
  const saxningSetupTime = 25 * 60; // 1500 sekunder
  const numSaxningPairs = Math.ceil(rolls / 2); // Antal par rullar, avrundat upp
  const saxningStopTime = isSaxningEligible
    ? saxningSetupTime + numSaxningPairs * 10 * 60
    : 0; // 10 minuter per par

  return {
    normalStopTime: normalStopTime,
    saxningStopTime: saxningStopTime
  };
}

// Dynamisk funktion för att beräkna total produktionstid för båda alternativen
function calculateProductionTime (order) {
  const machineId = order["Maskin id"] || "SM28";
  const sheetLength = parseFloat(order["Arklängd"]) || 0;
  const speed = getMachineSpeed(machineId, sheetLength);

  const planeradVikt =
    parseFloat((order["Planerad Vikt"] || "0").toString().replace(/\s/g, "")) ||
    0;
  const gramvikt = parseFloat(order["Gramvikt"]) || 0;
  const rawRollWidthStr = order["RawRollWidth"] || "";
  const rawRollWidths = rawRollWidthStr
    .split(",")
    .map(x => parseFloat(x.trim()) || 0);
  const maxRawRollWidth = Math.max(...rawRollWidths, 0);
  const lanes = parseFloat(order["Antal banor"]) || 1;
  const expectedWidth = parseFloat(order["Arkbredd"]) || 0;

  if (gramvikt <= 0 || maxRawRollWidth <= 0 || speed <= 0) {
    console.warn(
      `Ogiltiga värden för order ${order["Kundorder"] || "okänd"}:`,
      { gramvikt, maxRawRollWidth, speed }
    );
    return { normalTime: 0, saxningTime: 0 };
  }

  // Beräkna längden L (i meter)
  const L = (planeradVikt * 1000000) / (gramvikt * maxRawRollWidth);
  // Justerad produktionstid baserat på spillfaktor
  const spillFactor =
    expectedWidth > 0 && maxRawRollWidth > 0
      ? Math.max(0.5, 1 - (expectedWidth * lanes) / maxRawRollWidth)
      : 1;
  const productionTimeMinutes = L / speed / spillFactor;
  const productionTimeSeconds = productionTimeMinutes * 60;

  // Stopptider för båda alternativen
  const { normalStopTime, saxningStopTime } = calculateStopTimes(order);

  // Total tid i minuter för båda alternativen
  const normalTime = (productionTimeSeconds + normalStopTime) / 60;
  const saxningTime = (productionTimeSeconds + saxningStopTime) / 60;

  return {
    normalTime: normalTime,
    saxningTime: saxningTime
  };
}

// Dynamisk funktion för att beräkna produktionstider för alla order
function calculateAllProductionTimes (orders) {
  return orders.map(order => {
    const { normalTime, saxningTime } = calculateProductionTime(order);
    return {
      ...order,
      productionTimeNormal: normalTime,
      productionTimeSaxning: saxningTime
    };
  });
}

// Dynamisk laddning och bearbetning av JSON-data
async function processOrdersFromJson (jsonFile) {
  try {
    const response = await fetch(jsonFile);
    const orders = await response.json();
    const ordersWithTimes = calculateAllProductionTimes(orders);
    console.log(`Produktionstider för ${jsonFile}:`, ordersWithTimes);
    return ordersWithTimes;
  } catch (error) {
    console.error(`Fel vid laddning av ${jsonFile}:`, error);
    return [];
  }
}

// Exempel på användning
// (async () => {
//     const files = ['SM25.json', 'SM27.json', 'SM28.json'];
//     for (const file of files) {
//         await processOrdersFromJson(file);
//     }
// })();

// Export for Node.js environments
if (typeof module !== "undefined" && module.exports) {
  module.exports.processOrdersFromJson = processOrdersFromJson;
}
