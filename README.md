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

## Order Reordering

Each machine page now lets you reorder the planned orders directly. Drag and drop
orders between shifts or within a shift to update the schedule. Any custom
sequences you save are still available in the plan selector on the machine pages.

Saved plans appear in a selector on each machine page so you can view the generated schedule or one of your custom plans.

## Running Tests

Run `npm test` to execute the Jest test suite located in the `tests/` directory.
