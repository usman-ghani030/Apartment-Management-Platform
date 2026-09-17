// Render UI icons (lucide via react-icons) to PNG for the deck.
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const lu = require('react-icons/lu');

const ACCENT = '#2563eb';
const OUT = path.join(__dirname, 'assets', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const names = {
  'megaphone': 'LuMegaphone', 'wrench': 'LuWrench', 'credit-card': 'LuCreditCard',
  'calendar-check': 'LuCalendarCheck', 'scan-line': 'LuScanLine', 'vote': 'LuVote',
  'file-text': 'LuFileText', 'package': 'LuPackage', 'bell-ring': 'LuBellRing',
  'users': 'LuUsers', 'shield-check': 'LuShieldCheck', 'star': 'LuStar',
  'scroll-text': 'LuScrollText', 'lock': 'LuLock', 'key-round': 'LuKeyRound',
  'list-checks': 'LuListChecks', 'layers': 'LuLayers', 'database': 'LuDatabase',
  'cloud': 'LuCloud', 'zap': 'LuZap', 'arrow-right': 'LuArrowRight', 'building': 'LuBuilding2',
  'refresh': 'LuRefreshCcw', 'alert': 'LuCircleAlert', 'clipboard-check': 'LuClipboardCheck',
  'target': 'LuTarget', 'history': 'LuHistory', 'link': 'LuLink2', 'fingerprint': 'LuFingerprint',
  'badge-check': 'LuBadgeCheck', 'sparkles': 'LuSparkles', 'messages': 'LuMessagesSquare',
};
const icons = {};
for (const [k, n] of Object.entries(names)) {
  if (!lu[n]) { console.log('MISSING', n); continue; }
  icons[k] = lu[n];
}

(async () => {
  for (const [name, Icon] of Object.entries(icons)) {
    const svg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Icon, { color: ACCENT, size: 128, strokeWidth: 1.75 })
    );
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.writeFileSync(path.join(OUT, `ic-${name}.png`), buf);
  }
  // neutral-dark variants for a few uses
  for (const name of ['lock', 'shield-check']) {
    const svg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(icons[name], { color: '#1c1917', size: 128, strokeWidth: 1.75 })
    );
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.writeFileSync(path.join(OUT, `icd-${name}.png`), buf);
  }
  console.log('icons rendered:', Object.keys(icons).length);
})().catch(e => { console.error(e); process.exit(1); });
