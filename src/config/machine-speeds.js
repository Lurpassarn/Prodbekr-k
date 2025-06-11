/**
 * Machine Speed Configuration
 * Defines speed curves for different sheet lengths for each machine
 */

export const MACHINE_SPEED_CURVES = {
  SM25: [
    { size: 400, speed: 70 },   // Startpunkt
    { size: 500, speed: 100 },  // Ökning
    { size: 600, speed: 150 },  // Övergång
    { size: 700, speed: 230 },  // Nära topp
    { size: 750, speed: 300 },  // Maxhastighet uppnås
    { size: 900, speed: 300 },  // Håller max
    { size: 950, speed: 280 },  // Början av nedgång
    { size: 1000, speed: 250 }, // Fortsatt nedgång
    { size: 1100, speed: 225 }, // Vidare nedgång
    { size: 1400, speed: 200 }, // Stabiliserad minsta hastighet
    { size: 1600, speed: 200 }  // Håller konstant till max arkstorlek
  ],
  SM27: [
    { size: 400, speed: 30 },   // Startpunkt (knappt 30 m/min)
    { size: 500, speed: 150 },  // Ökning
    { size: 600, speed: 200 },  // Övergång
    { size: 700, speed: 270 },  // Nära topp
    { size: 720, speed: 300 },  // Maxhastighet uppnås
    { size: 900, speed: 300 },  // Platå
    { size: 1200, speed: 300 }, // Håller konstant
    { size: 1800, speed: 300 }  // Håller konstant till max arkstorlek
  ],
  SM28: [
    { size: 400, speed: 240 },  // Startpunkt
    { size: 450, speed: 270 },  // Ökning
    { size: 500, speed: 300 },  // Topphastighet
    { size: 650, speed: 300 },  // Håller 300 m/min
    { size: 700, speed: 280 },  // Början av nedgång
    { size: 800, speed: 260 },  // Fortsatt nedgång
    { size: 900, speed: 260 },  // Stabiliserad hastighet
    { size: 1200, speed: 260 }, // Håller konstant
    { size: 1800, speed: 260 }  // Håller konstant till max arkstorlek
  ]
};

export const DEFAULT_MACHINE = 'SM28';
