/**
 * services/image_generator.js
 * @napi-rs/canvas ile profesyonel Mersin Manşet haber kartı üretir.
 * 1080x1080 px (Instagram kare formatı)
 * Her haber farklı bir temada gösterilir.
 */
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs   = require('fs');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Arial-Regular.ttf'), 'ArialCustom');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Arial-Bold.ttf'), 'ArialCustomBold');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Tema Paleti ─────────────────────────────────────────────────────────────
// Her haber bu listeden sırayla (veya rastgele) bir tema alır.
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

/**
 * Haber ID'sinden deterministik tema seçer.
 * Aynı haber her seferinde aynı temayı alır.
 */
function pickTheme(newsId) {
  // newsId MD5 hash'i — son karakterin char kodunu mod ile temaya çevir
  const idx = newsId ? (newsId.charCodeAt(newsId.length - 1) % THEMES.length) : 0;
  return THEMES[idx];
}

/**
 * Haber başlığı kelimelerine göre dinamik renk teması seçer.
 * Eşleşme olmazsa ID tabanlı deterministik seçime döner.
 */
function pickThemeByTitle(title, newsId) {
  const lowerTitle = (title || '').toLowerCase();
  
  // Sports Theme (yesil)
  if (lowerTitle.includes('spor') || lowerTitle.includes('futbol') || lowerTitle.includes('idman') || lowerTitle.includes('maç') || lowerTitle.includes('stadyum') || lowerTitle.includes('yenildi') || lowerTitle.includes('yendi') || lowerTitle.includes('galibiyet')) {
    return THEMES.find(t => t.name === 'yesil') || THEMES[3];
  }
  
  // Accidents / Emergency / Crime Theme (kirmizi)
  if (lowerTitle.includes('kaza') || lowerTitle.includes('feci') || lowerTitle.includes('cinayet') || lowerTitle.includes('öldü') || lowerTitle.includes('yaralandı') || lowerTitle.includes('yangın') || lowerTitle.includes('tutuklandı') || lowerTitle.includes('gözaltı') || lowerTitle.includes('operasyon')) {
    return THEMES.find(t => t.name === 'kirmizi') || THEMES[0];
  }
  
  // Politics / Official / Government Theme (mavi)
  if (lowerTitle.includes('belediye') || lowerTitle.includes('başkan') || lowerTitle.includes('bakan') || lowerTitle.includes('vali') || lowerTitle.includes('seçim') || lowerTitle.includes('parti') || lowerTitle.includes('meclis')) {
    return THEMES.find(t => t.name === 'mavi') || THEMES[1];
  }

  // Culture / Life / Festivities Theme (mor)
  if (lowerTitle.includes('festival') || lowerTitle.includes('konser') || lowerTitle.includes('etkinlik') || lowerTitle.includes('sergi') || lowerTitle.includes('tiyatro') || lowerTitle.includes('sanat') || lowerTitle.includes('müzik')) {
    return THEMES.find(t => t.name === 'mor') || THEMES[4];
  }

  // Business / Economy / Gold Theme (altin)
  if (lowerTitle.includes('altın') || lowerTitle.includes('dolar') || lowerTitle.includes('fiyat') || lowerTitle.includes('zam') || lowerTitle.includes('enflasyon') || lowerTitle.includes('ihracat') || lowerTitle.includes('esnaf')) {
    return THEMES.find(t => t.name === 'altin') || THEMES[2];
  }
  
  return pickTheme(newsId);
}

// Yardımcı: hex → rgba
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

const COLORS = {
  white:     '#FFFFFF',
  lightGray: '#F1FAEE',
};

// Metni satırlara böl
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

// Yuvarlak köşeli dikdörtgen
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

/**
 * Haber kartı PNG dosyası oluşturur.
 */
async function generateNewsCard(news, outputPath, theme) {
  const SIZE  = 1080;
  // theme verilmezse haber başlığına göre dinamik seç
  const T     = theme || pickThemeByTitle(news.title || '', news.id || '');
  const ACCENT = T.accent;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // settings.json dosyasından tasarım ayarlarını yükle
  const settingsPath = path.join(__dirname, '..', 'settings.json');
  let settings = {
    badgeText: 'SON DAKİKA',
    watermarkText: 'www.mersinmanset.tr',
    logoUrl: 'assets/logo.png'
  };
  if (fs.existsSync(settingsPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      settings = { ...settings, ...saved };
    } catch (_) {}
  }

  // 1. ARKA PLAN GÖRSELİ (KAPLAMA)
  let bgImg = null;
  let bgProps = { x:0, y:0, w:SIZE, h:SIZE };

  if (news.imageUrl) {
    try {
      bgImg = await loadImage(news.imageUrl);
      const scale = Math.max(SIZE / bgImg.width, SIZE / bgImg.height);
      bgProps.w = bgImg.width * scale;
      bgProps.h = bgImg.height * scale;
      bgProps.x = (SIZE - bgProps.w) / 2;
      bgProps.y = (SIZE - bgProps.h) / 2;
      
      ctx.drawImage(bgImg, bgProps.x, bgProps.y, bgProps.w, bgProps.h);
      
      // Koyu gradyan overlay (yukarıdan aşağıya karararak)
      const overlayGrad = ctx.createLinearGradient(0, 0, 0, SIZE);
      overlayGrad.addColorStop(0, 'rgba(0,0,0,0.1)');
      overlayGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, SIZE, SIZE);
    } catch (e) {
      console.warn('⚠️ Görsel çizilemedi:', e.message);
      bgImg = null;
    }
  }

  // Yedek Arka Plan — temaya özel koyu gradyan
  if (!bgImg) {
    const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    bgGrad.addColorStop(0, T.bg0);
    bgGrad.addColorStop(1, T.bg1);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Accent renk orb (alt sol)
    const orb = ctx.createRadialGradient(180, SIZE - 180, 0, 180, SIZE - 180, 350);
    orb.addColorStop(0, hexToRgba(ACCENT, 0.18));
    orb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // 2. LOGO (ÜST SOL)
  try {
    let logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (settings.logoUrl && settings.logoUrl.includes('custom_logo')) {
      const customPath = path.join(__dirname, '..', 'dashboard', settings.logoUrl);
      if (fs.existsSync(customPath)) {
        logoPath = customPath;
      }
    }
    const logoImg = await loadImage(logoPath);
    const logoSize = 120;
    // Arka plana koyu bir damla gölge ekle ki logoyu her fotoda belli etsin
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.drawImage(logoImg, 40, 40, logoSize, logoSize);
    ctx.shadowColor = 'transparent';
  } catch(e) {
    console.warn('⚠️ Logo çizilemedi:', e.message);
  }

  // "SON DAKİKA" rozeti (Üst Sağ)
  const badgeText = settings.badgeText || 'SON DAKİKA';
  ctx.font = 'bold 21px ArialCustomBold';
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
  // Daire şeklinde beyaz bildirim noktası çiz
  ctx.beginPath();
  ctx.arc(bdgX + 25, bdgY + bdgH / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  // Yazıyı dikey ortalı çiz
  ctx.fillText(badgeText, bdgX + 42, bdgY + bdgH / 2);
  ctx.textBaseline = 'alphabetic'; // baseline geri yükle

  // 3. GLASSMORPHISM PANEL (ALT KISIM)
  const panelH = 460;
  const panelY = SIZE - panelH - 40;
  const panelX = 40;
  const panelW = SIZE - 80;

  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, 30);
  ctx.clip(); // Panelin içini kırp

  // Arka planı bulanık çiz
  if (bgImg) {
    ctx.filter = 'blur(35px)';
    // Resmi 1.1x büyüt ki blur kenarları taşmasın
    ctx.drawImage(bgImg, bgProps.x - 50, bgProps.y - 50, bgProps.w + 100, bgProps.h + 100);
    ctx.filter = 'none';
  }

  // Yarı şeffaf siyah overlay
  ctx.fillStyle = 'rgba(15, 20, 25, 0.65)';
  ctx.fill();

  // Şık ince cam kenarlık
  ctx.lineWidth = 2;
  ctx.strokeStyle = hexToRgba(ACCENT, 0.35);
  ctx.stroke();
  ctx.restore();

  // Panel üst kenarı — accent rengi
  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, 4, 0);
  ctx.fillStyle   = ACCENT;
  ctx.shadowColor = hexToRgba(ACCENT, 0.7);
  ctx.shadowBlur  = 14;
  ctx.fill();
  ctx.restore();

  // 4. METİNLER (PANELİN İÇİ)
  const innerX = panelX + 40;
  
  // Tarih (Üst bilgi)
  ctx.fillStyle = T.muted;
  ctx.font = 'bold 21px ArialCustom';
  ctx.fillText('MERSİN • ' + (news.date || new Date().toLocaleDateString('tr-TR')), innerX, panelY + 60);

  // Accent ayırıcı
  ctx.save();
  ctx.fillStyle   = ACCENT;
  ctx.shadowColor = hexToRgba(ACCENT, 0.5);
  ctx.shadowBlur  = 10;
  roundRect(ctx, innerX, panelY + 90, 80, 6, 3);
  ctx.fill();
  ctx.restore();

  // Başlık
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

  // Özet
  if (news.snippet) {
    ctx.fillStyle = COLORS.lightGray;
    ctx.font = '28px ArialCustom';
    const snippetLines = wrapText(ctx, news.snippet, panelW - 80);
    snippetLines.slice(0, 3).forEach((line, i) => {
      const isLast = i === 2 && snippetLines.length > 3;
      ctx.fillText(isLast ? line + '...' : line, innerX, titleEndY + 20 + (i * 42));
    });
  }

  // Footer: Web sitesi + tema renk noktası
  const watermarkText = settings.watermarkText || 'www.mersinmanset.tr';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '22px ArialCustom';
  ctx.fillText(watermarkText, innerX, panelY + panelH - 30);

  // Accent nokta
  ctx.save();
  ctx.fillStyle   = ACCENT;
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur  = 10;
  ctx.beginPath();
  ctx.arc(innerX - 14, panelY + panelH - 36, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── PNG OLARAK KAYDET ─────────────────────────────────────
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`🖼️  Görsel oluşturuldu: ${outputPath}`);

  // ── JPEG OLARAK DA KAYDET (TikTok için) ────────────────────
  if (outputPath.endsWith('.png')) {
    const jpegPath = outputPath.replace(/\.png$/, '.jpg');
    const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
    fs.writeFileSync(jpegPath, jpegBuffer);
    console.log(`🖼️  JPEG Görsel de oluşturuldu: ${jpegPath}`);
  }

  return outputPath;
}

function cleanupImage(filePath) {
  try { fs.unlinkSync(filePath); } catch (e) {}
  if (filePath.endsWith('.png')) {
    try { fs.unlinkSync(filePath.replace(/\.png$/, '.jpg')); } catch (e) {}
  }
}

module.exports = { generateNewsCard, cleanupImage, OUTPUT_DIR, THEMES, pickTheme, pickThemeByTitle };
