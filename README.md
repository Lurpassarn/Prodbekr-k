# Prodbekr-k

## XLS to JSON Conversion

Use the Node script `tools/xls_to_json.js` to convert production planning Excel files into the JSON format used by the web app. The script requires the `xlsx` package which is listed in `package.json`.

### Usage

1. Place `sm25.xls`, `sm27.xls` and `sm28.xls` in the project root.
2. Run `node tools/xls_to_json.js`.
3. The script will generate `SM25.json`, `SM27.json` and `SM28.json` in the same directory.

Each JSON file follows the existing structure used by the application.

## Calculate Order Times

The script `tools/calculate_order_times.js` reads one or more order JSON files and appends production times to each order.

### Example

```bash
node tools/calculate_order_times.js SM25.json SM27.json SM28.json
```

The script creates `SM25_with_times.json`, `SM27_with_times.json` and `SM28_with_times.json` with additional fields `productionTimeNormal` and `productionTimeSaxning`.

## Manual Planner

Open `planner.html` in a browser to manually plan orders. The page lets you pick orders for a machine and assign them to FM, EM or Natt shift. The planner calculates start and end times using the same production formulas as the machine pages and splits orders across shifts when necessary.
