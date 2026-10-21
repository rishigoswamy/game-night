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

// Phones: every card joins the game the host computer is running
fetch('/api/info').then(r => r.json()).then(info => {
  if (info.master !== false) return Leaderboard.mountAll(document.querySelector('footer'), Object.keys(Leaderboard.PARTY), 'party');
  document.querySelectorAll('a.game').forEach(a => {
    a.href = 'party-remote.html?g=' + new URL(a.href).searchParams.get('g');
    a.querySelector('.play').textContent = 'Join the game';
  });
}).catch(() => Leaderboard.mountAll(document.querySelector('footer'), Object.keys(Leaderboard.PARTY), 'party'));
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
