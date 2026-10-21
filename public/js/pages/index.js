// The QR code phones scan to join (only on the host computer)
function showJoinQr() {
  fetch('/api/info').then(r => r.json()).then(info => {
    if (info.master === false) return;
    const ip = (info.addresses || [])[0];
    if (!ip) return;
    document.getElementById('qrUrl').textContent = `http://${ip}:${info.port}`;
    const img = document.getElementById('qrImg');
    img.onload = () => document.getElementById('qrJoin').classList.add('on');
    img.src = '/api/qr.svg';
  }).catch(() => {});
}
showJoinQr();

// Mini roulette wheel for the Casino tile
(function () {
  const g = document.getElementById('miniWheel');
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const ORDER = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,37,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2];
  const seg = Math.PI * 2 / ORDER.length, R = 62, r = 30;
  ORDER.forEach((n, i) => {
    const a0 = i * seg - Math.PI / 2, a1 = a0 + seg;
    const p = (rad, a) => `${75 + Math.cos(a) * rad} ${75 + Math.sin(a) * rad}`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${p(r, a0)} L${p(R, a0)} A${R} ${R} 0 0 1 ${p(R, a1)} L${p(r, a1)} A${r} ${r} 0 0 0 ${p(r, a0)} Z`);
    path.setAttribute('fill', n === 0 || n === 37 ? '#0a8a45' : RED.has(n) ? '#c0262d' : '#151515');
    path.setAttribute('stroke', '#d4af37'); path.setAttribute('stroke-width', '.6');
    g.appendChild(path);
  });
})();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
let installPrompt = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; installBtn.hidden = false; });
installBtn.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt(); await installPrompt.userChoice;
  installPrompt = null; installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });
