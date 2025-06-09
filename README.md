# Prodbekr-k

## XLS to JSON Conversion

Use the Node script `tools/xls_to_json.js` to convert production planning Excel files into the JSON format used by the web app. The script requires the `xlsx` package which is listed in `package.json`.

### Usage

1. Place `sm25.xls`, `sm27.xls` and `sm28.xls` in the project root.
2. Run `node tools/xls_to_json.js`.
3. The script will generate `SM25.json`, `SM27.json` and `SM28.json` in the same directory.

Each JSON file follows the existing structure used by the application.
