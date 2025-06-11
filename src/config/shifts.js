/**
 * Shift Configuration
 * Defines working hours and limits for each shift
 */

export const SHIFT_DEFINITIONS = {
  FM: { 
    name: "FM", 
    start: 6 * 60,    // 06:00
    end: 14 * 60,     // 14:00
    displayName: "🌅 FM-Skift (06:00-14:00)"
  },
  EM: { 
    name: "EM", 
    start: 14 * 60,   // 14:00
    end: 22.5 * 60,   // 22:30
    displayName: "🌇 EM-Skift (14:00-22:30)"
  },
  Natt: { 
    name: "Natt", 
    start: 22.5 * 60, // 22:30
    end: 30 * 60,     // 06:00 (next day)
    displayName: "🌙 Natt-Skift (22:30-06:00)"
  }
};

export const SHIFT_ORDER = ["FM", "EM", "Natt"];

export const SHIFT_COLORS = {
  FM: "#2563eb",
  EM: "#60a5fa", 
  Natt: "#fbbf24"
};
