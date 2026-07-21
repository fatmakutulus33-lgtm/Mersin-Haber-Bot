const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs   = require('fs');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Arial-Regular.ttf'), 'ArialCustom');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Arial-Bold.ttf'), 'ArialCustomBold');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const THEMES = [
  { name: 'kirmizi',  accent: '#E63946', bg0: '#1a0005', bg1: '#0d0003', muted: '#A8DADC' },
  { name: 'mavi',     accent: '#2563EB', bg0: '#00051a', bg1: '#00030d', muted: '#93C5FD' },
  { name: 'altin',    accent: '#D97706', bg0: '#1a0f00', bg1: '#0d0800', muted: '#FCD34D' },
  { name: 'yesil',    accent: '#059669', bg0: '#001a0d', bg1: '#000d06', muted: '#6EE7B7' },
  { name: 'mor',      accent: '#7C3AED', bg0: '#0d001a', bg1: '#07000d', muted: '#C4B5FD' },
  { name: 'gul',      accent: '#E11D48', bg0: '#1a0008', bg1: '#0d0004', muted: '#FDA4AF' },
  { name: 'turuncu',  accent: '#EA580C', bg0: '#1a0800', bg1: '#0d0400', muted: '#FDBA74' },
  { name: 'siyan',    accent: '#0891B2', bg0: '#00131a', bg1: '#000a0d', muted: '#67E8F9' },
];

function pickTheme(newsId) {
  const idx = newsId ? (newsId.charCodeAt(newsId.length - 1) % THEMES.length) : 0;
  return THEMES[idx];
}

function pickThemeByTitle(title, newsId) {
  const lowerTitle = (title || '').toLowerCase();
  if (lowerTitle.includes('spor') || lowerTitle.includes('futbol') || lowerTitle.includes('maç') || lowerTitle.includes('yendi') || lowerTitle.includes('galibiyet')) {
    return THEMES.find(t => t.name === 'yesil') || THEMES[3];
  }
  if (lowerTitle.includes('kaza') || lowerTitle.includes('cinayet') || lowerTitle.includes('öldü') || lowerTitle.includes('yaralandı') || lowerTitle.includes('yangın') || lowerTitle.includes('operasyon')) {
    return THEMES.find(t => t.name === 'kirmizi') || THEMES[0];
  }
  if (lowerTitle.includes('belediye') || lowerTitle.includes('başkan') || lowerTitle.includes('vali') || lowerTitle.includes('meclis')) {
    return THEMES.find(t => t.name === 'mavi') || THEMES[1];
  }
  if (lowerTitle.includes('festival') || lowerTitle.includes('konser') || lowerTitle.includes('etkinlik') || lowerTitle.includes('sanat') || lowerTitle.includes('tiyatro')) {
    return THEMES.find(t => t.name === 'mor') || THEMES[4];
  }
  if (lowerTitle.includes('altın') || lowerTitle.includes('dolar') || lowerTitle.includes('fiyat') || lowerTitle.includes('zam') || lowerTitle.includes('ekonomi')) {
    return THEMES.find(t => t.name === 'altin') || THEMES[2];
  }
  return pickTheme(newsId);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const COLORS = {
  white:     '#FFFFFF',
  lightGray: '#F1FAEE',
};

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const { width } = ctx.measureText(test);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateNewsCard(news, outputPath, theme) {
  const SIZE = 1080;
  const T = theme || pickThemeByTitle(news.title || '', news.id || '');
  const ACCENT = T.accent;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  let bgImg = null;
  let bgProps = { x: 0, y: 0, w: SIZE, h: SIZE };

  if (news.imageUrl) {
    try {
      bgImg = await loadImage(news.imageUrl);
      const scale = Math.max(SIZE / bgImg.width, SIZE / bgImg.height);
      bgProps.w = bgImg.width * scale;
      bgProps.h = bgImg.height * scale;
      bgProps.x = (SIZE - bgProps.w) / 2;
      bgProps.y = (SIZE - bgProps.h) / 2;
      
      ctx.drawImage(bgImg, bgProps.x, bgProps.y, bgProps.w, bgProps.h);
      const overlayGrad = ctx.createLinearGradient(0, 0, 0, SIZE);
      overlayGrad.addColorStop(0, 'rgba(0,0,0,0.1)');
      overlayGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, SIZE, SIZE);
    } catch (e) {
      bgImg = null;
    }
  }

  if (!bgImg) {
    const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    bgGrad.addColorStop(0, T.bg0);
    bgGrad.addColorStop(1, T.bg1);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const orb = ctx.createRadialGradient(180, SIZE - 180, 0, 180, SIZE - 180, 350);
    orb.addColorStop(0, hexToRgba(ACCENT, 0.18));
    orb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // Draw Logo
  try {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoImg = await loadImage(logoPath);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 15;
      ctx.drawImage(logoImg, 40, 40, 120, 120);
      ctx.shadowColor = 'transparent';
    }
  } catch(_) {}

  // SON DAKİKA Badge
  ctx.font = 'bold 21px ArialCustomBold';
  const badgeText = 'SON DAKİKA';
  const textWidth = ctx.measureText(badgeText).width;
  const bdgW = Math.max(200, textWidth + 60);
  const bdgH = 50;
  const bdgX = SIZE - bdgW - 40;
  const bdgY = 50;

  ctx.save();
  roundRect(ctx, bdgX, bdgY, bdgW, bdgH, 25);
  ctx.fillStyle   = ACCENT;
  ctx.shadowColor = hexToRgba(ACCENT, 0.6);
  ctx.shadowBlur  = 18;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = COLORS.white;
  ctx.textBaseline = 'middle';
  ctx.beginPath();
  ctx.arc(bdgX + 25, bdgY + bdgH / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(badgeText, bdgX + 42, bdgY + bdgH / 2);
  ctx.textBaseline = 'alphabetic';

  // Glassmorphism Panel
  const panelH = 460;
  const panelY = SIZE - panelH - 40;
  const panelX = 40;
  const panelW = SIZE - 80;

  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, 30);
  ctx.clip();

  if (bgImg) {
    ctx.filter = 'blur(35px)';
    ctx.drawImage(bgImg, bgProps.x - 50, bgProps.y - 50, bgProps.w + 100, bgProps.h + 100);
    ctx.filter = 'none';
  }

  ctx.fillStyle = 'rgba(15, 20, 25, 0.65)';
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = hexToRgba(ACCENT, 0.35);
  ctx.stroke();
  ctx.restore();

  // Top border line
  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, 4, 0);
  ctx.fillStyle   = ACCENT;
  ctx.shadowColor = hexToRgba(ACCENT, 0.7);
  ctx.shadowBlur  = 14;
  ctx.fill();
  ctx.restore();

  // Content
  const innerX = panelX + 40;
  ctx.fillStyle = T.muted;
  ctx.font = 'bold 21px ArialCustom';
  ctx.fillText('MERSİN • ' + (news.date || new Date().toLocaleDateString('tr-TR')), innerX, panelY + 60);

  ctx.save();
  ctx.fillStyle   = ACCENT;
  ctx.shadowColor = hexToRgba(ACCENT, 0.5);
  ctx.shadowBlur  = 10;
  roundRect(ctx, innerX, panelY + 90, 80, 6, 3);
  ctx.fill();
  ctx.restore();

  // News Title
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 50px ArialCustomBold';
  const titleLines = wrapText(ctx, news.title, panelW - 80);
  const maxTitleLines = 3;
  let titleEndY = panelY + 160;

  titleLines.slice(0, maxTitleLines).forEach((line, i) => {
    const isLast = i === maxTitleLines - 1 && titleLines.length > maxTitleLines;
    ctx.fillText(isLast ? line + '...' : line, innerX, titleEndY + (i * 65));
  });

  titleEndY += Math.min(titleLines.length, maxTitleLines) * 65;

  // News Snippet
  if (news.snippet) {
    ctx.fillStyle = COLORS.lightGray;
    ctx.font = '28px ArialCustom';
    const snippetLines = wrapText(ctx, news.snippet, panelW - 80);
    snippetLines.slice(0, 3).forEach((line, i) => {
      const isLast = i === 2 && snippetLines.length > 3;
      ctx.fillText(isLast ? line + '...' : line, innerX, titleEndY + 20 + (i * 42));
    });
  }

  // Footer Watermark
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '22px ArialCustom';
  ctx.fillText('www.mersinmanset.tr', innerX, panelY + panelH - 30);

  ctx.save();
  ctx.fillStyle   = ACCENT;
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur  = 10;
  ctx.beginPath();
  ctx.arc(innerX - 14, panelY + panelH - 36, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Save to PNG and JPEG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  const jpegPath = outputPath.replace(/\.png$/, '.jpg');
  const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(jpegPath, jpegBuffer);

  return outputPath;
}

function cleanupImage(filePath) {
  try { fs.unlinkSync(filePath); } catch (e) {}
  if (filePath.endsWith('.png')) {
    try { fs.unlinkSync(filePath.replace(/\.png$/, '.jpg')); } catch (e) {}
  }
}

module.exports = { generateNewsCard, cleanupImage, OUTPUT_DIR };
