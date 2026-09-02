const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/const dateInput = document\.getElementById\('forecast-start-date'\);\n  if \(dateInput\) {\n    \n  const endDateInput[\s\S]*?\\n    dateInput\.addEventListener/g, \`
  const dateInputStart = document.getElementById('forecast-start-date');
  if (dateInputStart) {
    const endDateInput = document.getElementById('forecast-end-date');
    if (endDateInput) {
      endDateInput.addEventListener('change', (e) => {
        document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
        const start = document.getElementById('forecast-start-date').value;
        const end = e.target.value;
        if (start && end) {
          const diffTime = Math.abs(new Date(end) - new Date(start));
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
          renderPlotlyForecastingChart(diffDays > 0 ? diffDays : 1);
        }
      });
    }
    dateInputStart.addEventListener\`);

fs.writeFileSync('app.js', code);
