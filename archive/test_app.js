const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const window = dom.window;
global.window = window;
global.document = window.document;
global.fetch = async () => ({ ok: true, json: async () => ({}) });
global.Plotly = { newPlot: () => {} };
global.Date = window.Date;

try {
  window.eval(script);
  // Trigger DOMContentLoaded
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  console.log("JSDOM execution successful, no fatal errors.");
} catch (e) {
  console.error("JSDOM Error:", e);
}
