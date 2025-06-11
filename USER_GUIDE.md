# 🚀 PRODUKTIONSÖVERSIKT - ANVÄNDARGUIDE

## Nya Funktioner & Förbättringar

### 📦 Cross-Machine Order Transfer (NYT!)

**Så här flyttar du ordrar mellan maskiner:**

1. **Aktivera Transfer-läge**
   - Klicka på "🔄 Aktivera" knappen i sidebar
   - Knappen blir grön: "✅ Aktivt"

2. **Flytta en order**
   - Dra en order från ett skift
   - Släpp på en maskinknapp (SM25/SM27/SM28)
   - Ordern försvinner och skickas till målmaskinen

3. **Hantera inkommande ordrar**
   - Gå till målmaskinen (t.ex. SM27)
   - Se "📥 Inkommande ordrar (X)" i toppen av sidebar
   - Klicka "Acceptera alla" eller använd ✓/✗ för enskilda ordrar

### 🎯 Förbättrade Drag & Drop

- **Snyggare förhandsvisning**: Bara order-kortet följer musen
- **Glassmorphism-effekt**: Genomskinlig glaseffekt på dragged orders
- **Bättre drop-zoner**: Tydligare visuell feedback

### ⏰ Korrekt Tidsvisning

- **Fixat tidsbugg**: Inga mer "21:60" - visar nu "22:00"
- **Korrekt formatering**: Alla tider visas rätt

### 📋 Förbättrat Tompallar-fält

- **Renare visning**: Visar "12" istället för "12(12)"
- **Automatisk extraktion**: Tar värdet inom parenteser

## Snabbguide

### Grundläggande Användning
1. **Visa ordrar**: Alla skift visas alltid (FM, EM, Natt)
2. **Omordna**: Dra ordrar inom eller mellan skift
3. **Beräkningar**: Klicka "📊" för att se produktionsuträkning
4. **Planer**: Välj från "Välj Orderlista" dropdown

### Cross-Machine Workflow
```
SM25 [Order] --drag--> SM27 knapp ---> SM27 inbox ---> Acceptera
```

### Keyboard Shortcuts
- **Tab**: Navigera mellan element
- **Enter**: Aktivera knappar
- **Esc**: Avbryt drag operation

## Maskinspecifika Färger

- **SM25**: 🟡 Gul/Orange tema
- **SM27**: 🔵 Blå tema  
- **SM28**: 🟠 Orange tema

## Felsökning

### Om drag inte fungerar:
1. Kontrollera att du drar från order-kortet
2. Se till att drop-zonen markeras (färg ändras)
3. Försök ladda om sidan

### Om cross-machine transfer inte fungerar:
1. Kontrollera att transfer-läge är aktiverat (grön knapp)
2. Se till att du drar till en annan maskins knapp
3. Kontrollera localStorage i browser (F12 → Application → Local Storage)

### Om ordrar inte visas:
1. Kontrollera att JSON-filer finns (SM25.json, SM27.json, SM28.json)
2. Ladda om sidan
3. Kontrollera browser console för fel (F12)

## Tips & Tricks

- **Snabb överblick**: Skiftbararna visar viktfördelning mellan skift
- **Effektiv planering**: Använd cross-machine transfer för optimal kapacitetsutnyttjande
- **Responsiv design**: Fungerar lika bra på tablet/mobile
- **Persistent data**: Transfer-köer sparas automatiskt i browser

---
*För teknisk support eller bugrapporter, se FINAL_IMPROVEMENTS_SUMMARY.md*
