// Settings shared by the end-to-end tests
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');

// The computer's Wi-Fi/LAN address. Tests open pages through it to act as phones
// (with DC_LOOPBACK_ONLY=1 the server treats anything but localhost as a phone).
function lanAddress() {
  const a = Object.values(os.networkInterfaces()).flat().find(x => x && x.family === 'IPv4' && !x.internal);
  if (!a) throw new Error('No Wi-Fi/LAN address found. The tests need one to simulate phones (or set PHONE_HOST).');
  return a.address;
}

module.exports = {
  ROOT,
  SERVER: path.join(ROOT, 'server', 'server.js'),
  CHROME: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  PHONE_HOST: process.env.PHONE_HOST || lanAddress(),
  PORT: 8091,                                   // tests never use the real game night's port (8080)
};
