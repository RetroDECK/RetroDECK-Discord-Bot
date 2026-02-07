const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const TOKEN_PATH = path.join(DATA_DIR, 'oc-token.json');

function getAccessToken() {
  try {
    const raw = fs.readFileSync(TOKEN_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return data.access_token || null;
  } catch {
    return null;
  }
}

function saveToken(tokenData) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
}

module.exports = { getAccessToken, saveToken, TOKEN_PATH };
