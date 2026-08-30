const fs = require('fs');

const dashData = JSON.parse(fs.readFileSync('clover_api/analytics/dashboard_payload.json', 'utf8'));
const histData = JSON.parse(fs.readFileSync('clover_api/analytics/historical_payload.json', 'utf8'));

let records = dashData.forecast.forecast_records;
if (histData && histData.historical_records) {
  records = [...histData.historical_records, ...records];
  records.sort((a, b) => new Date(a.date) - new Date(b.date));
  records = Array.from(new Map(records.map(item => [item.date, item])).values());
}

console.log("Total records:", records.length);
let matchedRecord = records.find(r => r.date === "2026-08-01");
console.log("Matched 08-01:", matchedRecord ? "Found" : "Not Found");

// What about finding a record and then slicing it?
let targetDateInput = "2026-08-01";
let validStartIndex = records.findIndex(r => r.date === targetDateInput);
console.log("Valid start index:", validStartIndex);
if (validStartIndex === -1) {
    console.log("Fallback logic triggered");
} else {
    let slicedRecords = records.slice(validStartIndex, validStartIndex + 14);
    console.log("Sliced length:", slicedRecords.length);
    console.log("Sliced end:", slicedRecords[slicedRecords.length-1].date);
}

