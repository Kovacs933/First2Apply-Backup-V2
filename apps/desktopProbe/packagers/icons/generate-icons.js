// Generates every app icon from foundation.svg / foundation-mono.svg.
// Run from apps/desktopProbe:  npx electron packagers/icons/generate-icons.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const iconsDir = __dirname;
const imagesDir = path.join(__dirname, '..', '..', 'images');

/** Render an svg file to PNG buffers of the given sizes using Chromium's canvas. */
async function renderSizes(win, svgFile, sizes) {
  const svg = fs.readFileSync(path.join(iconsDir, svgFile), 'utf8');
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const pngs = await win.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(dataUrl)};
    await img.decode();
    return ${JSON.stringify(sizes)}.map((size) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png');
    });
  })()`);
  return Object.fromEntries(sizes.map((size, i) => [size, Buffer.from(pngs[i].split(',')[1], 'base64')]));
}

/** Windows .ico holding PNG images. */
function buildIco(pngsBySize) {
  const sizes = Object.keys(pngsBySize).map(Number);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  const entries = [];
  let offset = 6 + 16 * sizes.length;
  for (const size of sizes) {
    const png = pngsBySize[size];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...sizes.map((s) => pngsBySize[s])]);
}

/** macOS .icns holding PNG images. */
function buildIcns(pngsBySize) {
  const types = { 16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };
  const chunks = Object.entries(types)
    .filter(([size]) => pngsBySize[size])
    .map(([size, type]) => {
      const head = Buffer.alloc(8);
      head.write(type, 0, 'ascii');
      head.writeUInt32BE(8 + pngsBySize[size].length, 4);
      return Buffer.concat([head, pngsBySize[size]]);
    });
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(8 + chunks.reduce((n, c) => n + c.length, 0), 4);
  return Buffer.concat([head, ...chunks]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<html><body></body></html>');

  const color = await renderSizes(win, 'foundation.svg', [16, 24, 32, 44, 48, 50, 64, 128, 150, 256, 310, 512, 1024]);
  const mono = await renderSizes(win, 'foundation-mono.svg', [16, 32]);

  // app + installer icons
  fs.writeFileSync(path.join(iconsDir, 'foundation.png'), color[512]);
  fs.writeFileSync(path.join(iconsDir, 'foundation@2x.png'), color[1024]);
  fs.writeFileSync(path.join(iconsDir, 'foundation.ico'), buildIco({ 16: color[16], 24: color[24], 32: color[32], 48: color[48], 64: color[64], 128: color[128], 256: color[256] }));
  fs.writeFileSync(path.join(iconsDir, 'foundation.icns'), buildIcns(color));

  // tray icons
  fs.writeFileSync(path.join(imagesDir, 'trayIcon.ico'), buildIco({ 16: color[16], 24: color[24], 32: color[32], 48: color[48] }));
  fs.writeFileSync(path.join(imagesDir, 'trayIcon.png'), color[32]);
  fs.writeFileSync(path.join(imagesDir, 'trayIconTemplate.png'), mono[16]);
  fs.writeFileSync(path.join(imagesDir, 'trayIconTemplate@2x.png'), mono[32]);

  console.log('icons generated');
  app.quit();
});
