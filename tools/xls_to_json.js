const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

function convertXlsToJson(xlsFile, jsonFile) {
  const workbook = xlsx.readFile(xlsFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });
  fs.writeFileSync(jsonFile, JSON.stringify(data, null, 4), "utf8");
  console.log(`Converted ${xlsFile} -> ${jsonFile}`);
}

const files = [
  { xls: "sm25.xls", json: "SM25.json" },
  { xls: "sm27.xls", json: "SM27.json" },
  { xls: "sm28.xls", json: "SM28.json" }
];

for (const file of files) {
  if (fs.existsSync(file.xls)) {
    convertXlsToJson(file.xls, file.json);
  } else {
    console.warn(`File ${file.xls} not found, skipping.`);
  }
}
