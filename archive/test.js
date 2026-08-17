const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
dom.window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.log("Error: " + msg + " at " + lineNo + ":" + columnNo);
};
