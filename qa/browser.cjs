// Use Playwright's installed Chromium by default; one override supports existing local browsers.
const path = require('node:path');
const fs = require('node:fs');
function browserOptions() {
  const executablePath = process.env.SOBER_BROWSER_PATH || process.env.BINGO_BROWSER_PATH || process.env.STEPS_BROWSER_PATH;
  return executablePath ? { executablePath } : {};
}
function artifactPath(name) {
  const directory = path.resolve(__dirname, '..', 'test-results');
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, name);
}
module.exports = { browserOptions, artifactPath };
