/**
 * Mersin Manşet Dashboard v6 — app.js
 * Kaynak gösterme seçeneği kaldırıldı.
 */

'use strict';

// ── Globals ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('newsCanvas');
const ctx    = canvas.getContext('2d');
const SIZE   = 1080;

let currentTheme = { accent: '#DC2626', name: 'default' };
let zoomScale    = 'auto';

// ── DOM Refs ─────────────────────────────────────────────────────────────────
const inputs = {
  title:   document.getElementById('newsTitle'),
  snippet: document.getElementById('newsSnippet'),
  date:    document.getElementById('newsDate'),
  bgUrl:   document.getElementById('bgImage'),
  badgeText: document.getElementById('badgeText'),
  watermarkText: document.getElementById('watermarkText'),
};

const els = {
  btnDownload:     document.getElementById('btnDownload'),
  btnCopy:         document.getElementById('btnCopy'),
  btnClearBg:      document.getElementById('btnClearBg'),
  btnToggleToken:  document.getElementById('btnToggleToken'),
  oracleToken:     document.getElementById('oracleToken'),
  cronInterval:    document.getElementById('cronInterval'),
  btnSaveInterval: document.getElementById('btnSaveInterval'),
  btnTriggerBot:   document.getElementById('btnTriggerBot'),
  botStatus:       document.getElementById('botStatus'),
  canvasLoader:    document.getElementById('canvasLoader'),
  titleCounter:    document.getElementById('titleCounter'),
  statusDot:       document.getElementById('statusDot'),
  statusText:      document.getElementById('statusText'),
  statusPulse:     document.getElementById('statusPulse'),
  zoomIn:          document.getElementById('btnZoomIn'),
  zoomOut:         document.getElementById('btnZoomOut'),
  zoomLevel:       document.getElementById('zoomLevel'),
  statPosted:      document.getElementById('statPosted'),
  statRejected:    document.getElementById('statRejected'),
  statTotal:       document.getElementById('statTotal'),
  recentList:      document.getElementById('recentList'),
  btnSaveDesign:   document.getElementById('btnSaveDesign'),
  customLogo:      document.getElementById('customLogo'),
  logoUploadStatus: document.getElementById('logoUploadStatus'),
};

// ── Tab System ────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'stats') loadStats();
  });
});

// ── Accent Swatches ────────────────────────────────────────────────────────────
const THEMES = {
  default: '#DC2626',
  blue:    '#2563EB',
  gold:    '#D97706',
  emerald: '#059669',
  purple:  '#7C3AED',
  rose:    '#E11D48',
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function applyAccent(hex) {
  document.documentElement.style.setProperty('--accent',      hex);
  document.documentElement.style.setProperty('--accent-dim',  hexToRgba(hex, 0.12));
  document.documentElement.style.setProperty('--accent-glow', hexToRgba(hex, 0.30));
}

document.querySelectorAll('.swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    currentTheme.accent = THEMES[sw.dataset.theme] || '#DC2626';
    currentTheme.name   = sw.dataset.theme;
    applyAccent(currentTheme.accent);
    drawCanvas();
  });
});

// ── Status Helpers ─────────────────────────────────────────────────────────────
function setStatus(text, type) {
  type = type || 'idle';
  els.statusText.textContent = text;
  const color = type === 'ok'   ? 'var(--green)' :
                type === 'err'  ? 'var(--red)'   :
                type === 'busy' ? 'var(--amber)'  : 'var(--green)';
  els.statusDot.style.background = color;
  if (els.statusPulse) {
    els.statusPulse.style.background = color.replace('var(--green)', 'rgba(22,163,74,0.2)')
                                             .replace('var(--red)',   'rgba(220,38,38,0.2)')
                                             .replace('var(--amber)', 'rgba(217,119,6,0.2)');
  }
}

function showToast(msg, isError) {
  const el = els.botStatus;
  el.textContent = msg;
  el.className   = isError ? 'toast error' : 'toast';
  setTimeout(function() { el.className = 'toast hidden'; }, 5000);
}

// ── Char Counter ───────────────────────────────────────────────────────────────
function updateCounter() {
  els.titleCounter.textContent = inputs.title.value.length;
}
inputs.title.addEventListener('input', updateCounter);
updateCounter();

// ── UI Controls ───────────────────────────────────────────────────────────────
els.btnClearBg.addEventListener('click', () => {
  inputs.bgUrl.value = '';
  drawCanvas();
});

els.btnToggleToken.addEventListener('click', () => {
  els.oracleToken.type = els.oracleToken.type === 'password' ? 'text' : 'password';
});

if (localStorage.getItem('oracleToken')) els.oracleToken.value = localStorage.getItem('oracleToken');
els.oracleToken.addEventListener('change', () => localStorage.setItem('oracleToken', els.oracleToken.value));

// ── Zoom ──────────────────────────────────────────────────────────────────────
const ZOOM_STEPS = ['auto', 0.35, 0.45, 0.55, 0.65, 0.75, 0.9, 1.0];
let zoomIdx = 0;

function applyZoom() {
  if (zoomScale === 'auto') {
    canvas.style.maxWidth  = '100%';
    canvas.style.maxHeight = 'calc(100vh - 200px)';
    canvas.style.width     = 'auto';
    canvas.style.height    = 'auto';
    els.zoomLevel.textContent = 'Otomatik';
  } else {
    const px = Math.round(SIZE * zoomScale);
    canvas.style.width     = px + 'px';
    canvas.style.height    = px + 'px';
    canvas.style.maxWidth  = 'none';
    canvas.style.maxHeight = 'none';
    els.zoomLevel.textContent = Math.round(zoomScale * 100) + '%';
  }
}

els.zoomIn.addEventListener('click', () => {
  zoomIdx = Math.min(zoomIdx + 1, ZOOM_STEPS.length - 1);
  zoomScale = ZOOM_STEPS[zoomIdx];
  applyZoom();
});
els.zoomOut.addEventListener('click', () => {
  zoomIdx = Math.max(zoomIdx - 1, 0);
  zoomScale = ZOOM_STEPS[zoomIdx];
  applyZoom();
});

// ── Canvas Utils ──────────────────────────────────────────────────────────────
function wrapText(context, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (context.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else { current = test; }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

async function loadImageSafely(url) {
  const proxies = [
    url,
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    'https://corsproxy.io/?' + encodeURIComponent(url),
  ];
  for (const src of proxies) {
    try {
      const res  = await fetch(src, { mode: 'cors' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) continue;
      const blobUrl = URL.createObjectURL(blob);
      return await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload  = () => resolve(i);
        i.onerror = reject;
        i.src = blobUrl;
      });
    } catch (e) { /* next proxy */ }
  }
  throw new Error('Görsel yüklenemedi.');
}

// ── Draw ──────────────────────────────────────────────────────────────────────
let drawDebounce = null;

function scheduleRedraw() {
  clearTimeout(drawDebounce);
  drawDebounce = setTimeout(drawCanvas, 80);
}

async function drawCanvas() {
  els.canvasLoader.classList.add('active');
  setStatus('Çiziliyor...', 'busy');
  try {
    await _draw();
    setStatus('Hazır', 'ok');
  } catch (e) {
    console.warn('Canvas hatası:', e.message);
    setStatus('Hata', 'err');
  } finally {
    els.canvasLoader.classList.remove('active');
  }
}

async function _draw() {
  ctx.clearRect(0, 0, SIZE, SIZE);

  const titleText   = inputs.title.value;
  const snippetText = inputs.snippet.value;
  const dateText    = inputs.date.value || new Date().toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
  const bgUrl       = inputs.bgUrl.value;
  const accent      = currentTheme.accent;

  // 1. Background
  let bgImg = null;
  let bgProps = { x: 0, y: 0, w: SIZE, h: SIZE };

  if (bgUrl && bgUrl.trim()) {
    try { bgImg = await loadImageSafely(bgUrl); } catch (e) {}
  }

  if (bgImg) {
    const scale = Math.max(SIZE / bgImg.width, SIZE / bgImg.height);
    bgProps.w = bgImg.width  * scale;
    bgProps.h = bgImg.height * scale;
    bgProps.x = (SIZE - bgProps.w) / 2;
    bgProps.y = (SIZE - bgProps.h) / 2;
    ctx.drawImage(bgImg, bgProps.x, bgProps.y, bgProps.w, bgProps.h);

    // Vignette
    const vig = ctx.createRadialGradient(SIZE/2, SIZE/2, SIZE*0.2, SIZE/2, SIZE/2, SIZE*0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0.15)');
    vig.addColorStop(1, 'rgba(0,0,0,0.80)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Bottom gradient
    const grad = ctx.createLinearGradient(0, SIZE * 0.35, 0, SIZE);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  } else {
    // Dark fallback
    const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, '#0D0D14');
    g.addColorStop(0.5, '#080810');
    g.addColorStop(1, '#05050A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Subtle dot grid
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let xi = 0; xi < SIZE; xi += 48) {
      for (let yi = 0; yi < SIZE; yi += 48) {
        ctx.beginPath();
        ctx.arc(xi, yi, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Accent glow orb (bottom-left)
    const orb = ctx.createRadialGradient(200, SIZE - 200, 0, 200, SIZE - 200, 380);
    orb.addColorStop(0, hexToRgba(accent, 0.10));
    orb.addColorStop(1, 'transparent');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // 2. Logo (top-left)
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'Anonymous';
    await new Promise((res, rej) => {
      logoImg.onload = res;
      logoImg.onerror = rej;
      logoImg.src = currentTheme.logoUrl || 'assets/logo.png';
    });
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur  = 24;
    ctx.drawImage(logoImg, 52, 52, 108, 108);
    ctx.restore();
  } catch (e) {}

  // 3. Rozet badge (top-right)
  const badgeText = inputs.badgeText ? inputs.badgeText.value : 'SON DAKİKA';
  ctx.font = 'bold 20px "Inter", sans-serif';
  const textWidth = ctx.measureText(badgeText).width;
  const bdgW = Math.max(200, textWidth + 60);
  const bdgH = 50;
  const bdgX = SIZE - bdgW - 52;
  const bdgY = 60;
  ctx.save();
  roundRect(ctx, bdgX, bdgY, bdgW, bdgH, 25);
  ctx.fillStyle   = accent;
  ctx.shadowColor = hexToRgba(accent, 0.55);
  ctx.shadowBlur  = 22;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle    = '#FFFFFF';
  ctx.textBaseline = 'middle';
  // Daire şeklinde beyaz bildirim noktası çiz
  ctx.beginPath();
  ctx.arc(bdgX + 26, bdgY + bdgH / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  // Yazıyı dikey ortalı çiz
  ctx.fillText(badgeText, bdgX + 43, bdgY + bdgH / 2);
  ctx.textBaseline = 'alphabetic';

  // 4. Bottom content panel
  const panelH = 468;
  const panelY = SIZE - panelH - 52;
  const panelX = 52;
  const panelW = SIZE - 104;

  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, 26);
  ctx.clip();

  if (bgImg) {
    ctx.filter = 'blur(44px) brightness(0.55) saturate(0.7)';
    ctx.drawImage(bgImg, bgProps.x - 70, bgProps.y - 70, bgProps.w + 140, bgProps.h + 140);
    ctx.filter = 'none';
  }

  ctx.fillStyle = bgImg ? 'rgba(6,6,14,0.62)' : 'rgba(10,10,20,0.88)';
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.restore();

  // Accent top-line on panel
  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, 3, 0);
  ctx.fillStyle   = accent;
  ctx.shadowColor = hexToRgba(accent, 0.8);
  ctx.shadowBlur  = 16;
  ctx.fill();
  ctx.restore();

  // 5. Panel texts
  const innerX = panelX + 50;
  const maxW   = panelW - 100;

  // Date line
  ctx.fillStyle = 'rgba(155,155,185,0.90)';
  ctx.font      = 'bold 21px "Inter", sans-serif';
  ctx.fillText('MERSİN • ' + dateText, innerX, panelY + 62);

  // Accent separator
  ctx.save();
  ctx.fillStyle   = accent;
  ctx.shadowColor = hexToRgba(accent, 0.5);
  ctx.shadowBlur  = 10;
  roundRect(ctx, innerX, panelY + 84, 68, 4, 2);
  ctx.fill();
  ctx.restore();

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = '800 52px "Inter", sans-serif';
  const titleLines = wrapText(ctx, titleText || 'Haber Başlığı', maxW);
  const maxTL      = 3;
  let   titleEndY  = panelY + 156;

  titleLines.slice(0, maxTL).forEach((line, i) => {
    const isLast = i === maxTL - 1 && titleLines.length > maxTL;
    ctx.fillText(isLast ? line + '…' : line, innerX, titleEndY + i * 66);
  });
  titleEndY += Math.min(titleLines.length, maxTL) * 66;

  // Snippet
  if (snippetText) {
    ctx.fillStyle = 'rgba(210,210,230,0.78)';
    ctx.font      = '400 27px "Inter", sans-serif';
    const snipLines = wrapText(ctx, snippetText, maxW);
    snipLines.slice(0, 2).forEach((line, i) => {
      const isLast = i === 1 && snipLines.length > 2;
      ctx.fillText(isLast ? line + '…' : line, innerX, titleEndY + 22 + i * 42);
    });
  }

  // Watermark
  const watermarkText = inputs.watermarkText ? inputs.watermarkText.value : 'www.mersinmanset.tr';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font      = '500 19px "Inter", sans-serif';
  ctx.fillText(watermarkText, innerX, panelY + panelH - 26);

  // Accent dot on watermark
  ctx.save();
  ctx.fillStyle   = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.arc(innerX - 13, panelY + panelH - 32, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Input Listeners ───────────────────────────────────────────────────────────
Object.values(inputs).forEach(el => {
  el.addEventListener('input', scheduleRedraw);
});

// ── Download ──────────────────────────────────────────────────────────────────
els.btnDownload.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'Mersin_Haber_' + Date.now() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// ── Copy ──────────────────────────────────────────────────────────────────────
els.btnCopy.addEventListener('click', async () => {
  try {
    canvas.toBlob(async blob => {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('✅ Görsel panoya kopyalandı!');
    });
  } catch (e) {
    showToast('❌ Kopyalama desteklenmiyor.', true);
  }
});

// ── Bot Controls ──────────────────────────────────────────────────────────────
const OCI_VM_IP   = '84.8.100.227';

els.btnTriggerBot.addEventListener('click', async () => {
  setStatus('Bot tetikleniyor...', 'busy');
  els.btnTriggerBot.style.opacity       = '0.6';
  els.btnTriggerBot.style.pointerEvents = 'none';

  try {
    const res = await fetch('../api/trigger', {
      method: 'POST',
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      showToast('✅ Bot tetiklendi! Telegram\'da onay bekleniyor...');
      setStatus('Bot aktif', 'ok');

      if (data.news) {
        inputs.title.value = data.news.title || '';
        inputs.snippet.value = data.news.snippet || '';
        inputs.date.value = data.news.date || '';
        inputs.bgUrl.value = data.news.imageUrl || '';
        
        // Karakter sayacını ve önizlemeyi güncelle
        updateCounter();
        drawCanvas();
      }
    } else {
      showToast('❌ ' + (data.message || 'Tetikleme başarısız oldu'), true);
      setStatus('Hata', 'err');
    }
  } catch (error) {
    showToast('❌ Ağ hatası: ' + error.message, true);
    setStatus('Hata', 'err');
  } finally {
    els.btnTriggerBot.style.opacity       = '1';
    els.btnTriggerBot.style.pointerEvents = 'all';
  }
});

els.btnSaveInterval.addEventListener('click', async () => {
  const newCron = els.cronInterval.value;

  setStatus('Zamanlama güncelleniyor...', 'busy');
  try {
    const res = await fetch('../api/settings/cron', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cron: newCron })
    });

    if (res.ok) {
      const data = await res.json();
      showToast('✅ ' + (data.message || 'Zamanlama güncellendi! Bot yeniden başlatılıyor...'));
      setStatus('Güncellendi', 'ok');
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Güncelleme başarısız oldu.');
    }
  } catch (error) {
    showToast('❌ ' + error.message, true);
    setStatus('Hata', 'err');
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res   = await fetch('/posted_news.json');
    const data  = await res.json();
    const posts = Array.isArray(data) ? data : (data.posted || data.posts || []);
    const today = new Date().toDateString();

    const todayPosts    = posts.filter(p => p.postedAt && new Date(p.postedAt).toDateString() === today);
    const todayPosted   = todayPosts.filter(p => p.postId && p.postId !== 'REJECTED').length;
    const todayRejected = todayPosts.filter(p => p.postId === 'REJECTED').length;

    els.statPosted.textContent   = todayPosted;
    els.statRejected.textContent = todayRejected;
    els.statTotal.textContent    = posts.length;

    const recent = [...posts].reverse().slice(0, 6);
    els.recentList.innerHTML = recent.length === 0
      ? '<div class="recent-empty">Henüz paylaşım yok.</div>'
      : recent.map(p => {
          const rejected = p.postId === 'REJECTED';
          const date = p.postedAt
            ? new Date(p.postedAt).toLocaleString('tr-TR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
            : '—';
          return '<div class="recent-item">' +
            '<div class="recent-badge' + (rejected ? ' rejected' : '') + '"></div>' +
            '<div class="recent-text">' +
              '<div class="recent-title">' + (p.title || 'Başlıksız').substring(0, 55) + '</div>' +
              '<div class="recent-date">' + date + ' · ' + (rejected ? 'Reddedildi' : 'Yayınlandı') + '</div>' +
            '</div></div>';
        }).join('');
  } catch (e) {
    els.recentList.innerHTML = '<div class="recent-empty">Veri okunamadı.</div>';
  }
}

// Arayüz ayarlarını (cron ve aktif kaynaklar) sunucudan çeker
async function loadSettings() {
  try {
    const res = await fetch('../api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        const active = data.settings.activeSources || [];
        // Checkbox durumlarını güncelle
        document.querySelectorAll('#sourcesList input[type="checkbox"]').forEach(cb => {
          cb.checked = active.includes(cb.value);
        });

        // Tasarım ayarlarını güncelle
        if (data.settings.badgeText && inputs.badgeText) {
          inputs.badgeText.value = data.settings.badgeText;
        }
        if (data.settings.watermarkText && inputs.watermarkText) {
          inputs.watermarkText.value = data.settings.watermarkText;
        }
        if (data.settings.logoUrl) {
          currentTheme.logoUrl = data.settings.logoUrl;
          const sidebarLogo = document.getElementById('brandLogoImg');
          if (sidebarLogo) sidebarLogo.src = data.settings.logoUrl + '?t=' + Date.now();
        }
        drawCanvas();
      }
    }
  } catch (err) {
    console.warn('Ayarlar yüklenemedi:', err.message);
  }
}

// Haber kaynaklarını kaydetme işlevi
document.getElementById('btnSaveSources').addEventListener('click', async () => {
  const activeSources = [];
  document.querySelectorAll('#sourcesList input[type="checkbox"]').forEach(cb => {
    if (cb.checked) activeSources.push(cb.value);
  });

  setStatus('Kaynaklar kaydediliyor...', 'busy');
  try {
    const res = await fetch('../api/settings/sources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ activeSources })
    });

    if (res.ok) {
      showToast('✅ Haber kaynakları güncellendi!');
      setStatus('Kaydedildi', 'ok');
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Güncelleme başarısız.');
    }
  } catch (error) {
    showToast('❌ ' + error.message, true);
    setStatus('Hata', 'err');
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
applyZoom();
drawCanvas();
loadSettings();
loadPipelineData(false); // İlk açılışta yükleme spinner'ı ile hızlıca yükle

// Canlı Log Akışı: Her 3 saniyede bir logları ve sunucu durumunu otomatik güncelle
setInterval(() => {
  loadPipelineData(true);
}, 3000);

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE TAB
// ══════════════════════════════════════════════════════════════════════════════

const PIPE_STEPS = [
  { id: 0, label: 'Haber Çekme',        keywords: ['fetchMersinNews', 'haber', 'RSS', 'Haberler çek', 'bulunamadı', 'haberi'] },
  { id: 1, label: 'Dedup Kontrolü',     keywords: ['isAlreadyPosted', 'paylaşılmamış', 'Dedup', 'Tüm bulunan', 'Seçilen haber'] },
  { id: 2, label: 'Görsel İndir',       keywords: ['downloadImage', 'Arka plan görseli', 'Görsel indirilemedi', 'Görsel bulunamadı', 'bg_'] },
  { id: 3, label: 'Kart Üretimi',       keywords: ['generateNewsCard', 'haber_', 'PNG', 'Kart'] },
  { id: 4, label: 'Telegram Onayı',     keywords: ['Telegram', 'requestApproval', 'onay', 'Yayınla', 'Reddet', 'reddedildi', 'onaylandı', 'Süre doldu'] },
  { id: 5, label: 'Instagram Paylaşım', keywords: ['postToInstagram', 'Instagram', 'YAYINDA', 'publishId', 'container'] },
  { id: 6, label: 'Dedup Güncelle',     keywords: ['markAsPosted', 'posted_news', 'update posted', 'DÖNGÜ TAMAMLANDI'] },
];

// Adım badge'lerini sıfırla
function resetPipeSteps() {
  for (let i = 0; i <= 6; i++) {
    const el = document.getElementById('pstep' + i);
    const badge = document.getElementById('pbadge' + i);
    if (!el) continue;
    el.className = 'pipe-step' + (i === 4 ? ' pipe-step--highlight' : '');
    if (badge) badge.textContent = '—';
  }
}

// Adım state güncelle
function setPipeStep(idx, state, badge) {
  const el = document.getElementById('pstep' + idx);
  const bd = document.getElementById('pbadge' + idx);
  if (!el) return;
  const base = idx === 4 ? 'pipe-step pipe-step--highlight' : 'pipe-step';
  el.className = base + (state ? ' state-' + state : '');
  if (bd && badge !== undefined) bd.textContent = badge;
}

// Run meta güncelle
function setRunMeta(pm2) {
  const chip = document.getElementById('runStatusChip');
  const started = document.getElementById('runStartedAt');
  const duration = document.getElementById('runDuration');

  if (!pm2) {
    chip.textContent = '—';
    chip.className = 'run-status-chip idle';
    started.textContent = '—';
    duration.textContent = '—';
    return;
  }

  const status = pm2.status || 'offline';
  const labelMap = { online: '✅ Aktif', stopped: '🚫 Durduruldu', errored: '❌ Hatalı', offline: '—' };
  chip.textContent = labelMap[status] || status;
  chip.className = 'run-status-chip ' + status;

  started.textContent = pm2.uptime || '—';
  duration.textContent = (pm2.memory && pm2.cpu) ? `${pm2.memory} / ${pm2.cpu}` : '—';
}

function parseStepsFromLog(logText, runConclusion) {
  if (!logText) return;

  const lines = logText.split('\n');
  const stepStates = Array(7).fill(null);

  lines.forEach(line => {
    const lower = line.toLowerCase();
    PIPE_STEPS.forEach(step => {
      if (step.keywords.some(kw => line.includes(kw) || lower.includes(kw.toLowerCase()))) {
        if (stepStates[step.id] === null) stepStates[step.id] = 'seen';
      }
    });
  });

  const failed = runConclusion === 'failure';
  let lastSeen = -1;
  stepStates.forEach((s, i) => { if (s === 'seen') lastSeen = i; });

  stepStates.forEach((s, i) => {
    if (s === null) {
      setPipeStep(i, '', '—');
    } else if (i < lastSeen) {
      setPipeStep(i, 'success', '✓');
    } else if (i === lastSeen) {
      if (failed) setPipeStep(i, 'failed', '✗');
      else if (runConclusion === 'success') setPipeStep(i, 'success', '✓');
      else setPipeStep(i, 'running', '…');
    } else {
      setPipeStep(i, '', '—');
    }
  });

  if (runConclusion === 'success') {
    stepStates.forEach((s, i) => {
      if (s === 'seen') setPipeStep(i, 'success', '✓');
    });
  }
}

async function loadPipelineData(isBackground = false) {
  const runsList = document.getElementById('runsList');
  if (!isBackground) {
    runsList.innerHTML = '<div class="recent-empty">Yükleniyor...</div>';
    resetPipeSteps();
    setRunMeta(null);
  }

  try {
    const res = await fetch('../api/pipeline');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (!isBackground) {
        runsList.innerHTML = '<div class="recent-empty">Sunucu hatası: ' + (err.message || res.status) + '</div>';
      }
      return;
    }

    const data = await res.json();
    
    if (data.pm2) {
      setRunMeta(data.pm2);
    }

    if (data.logs) {
      parseStepsFromLog(data.logs, data.pm2 ? (data.pm2.status === 'online' ? 'success' : 'failure') : 'success');
      
      const logLines = data.logs.split('\n').filter(line => line.trim()).slice(-35);
      runsList.innerHTML = '<div class="log-terminal">' + 
        logLines.map(line => {
          let lineClass = 'log-line';
          if (line.includes('❌') || line.toLowerCase().includes('hata') || line.toLowerCase().includes('error')) lineClass += ' log-error';
          if (line.includes('✅') || line.includes('✓')) lineClass += ' log-success';
          if (line.includes('⚠️')) lineClass += ' log-warn';
          if (line.includes('⚡') || line.includes('⏰')) lineClass += ' log-info';
          return `<div class="${lineClass}">${escapeHtml(line)}</div>`;
        }).join('') +
      '</div>';

      // Otomatik olarak terminali en alta kaydır
      const logTerminal = runsList.querySelector('.log-terminal');
      if (logTerminal) {
        logTerminal.scrollTop = logTerminal.scrollHeight;
      }
    } else if (!isBackground) {
      runsList.innerHTML = '<div class="recent-empty">Henüz log kaydı yok.</div>';
    }

  } catch (err) {
    if (!isBackground) {
      runsList.innerHTML = '<div class="recent-empty">Bağlantı hatası: ' + err.message + '</div>';
    }
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'pipeline') {
      loadPipelineData();
    }
  });
});

document.getElementById('btnRefreshPipeline').addEventListener('click', loadPipelineData);

// Güvenli (HTTPS) ve Güvensiz (HTTP) ortamları destekleyen kopyalama fonksiyonu
function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    return new Promise((resolve, reject) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          resolve();
        } else {
          reject(new Error('execCommand kopyalama başarısız.'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }
}

// SUNUCU LOG KONSOLU kopyalama işlevi
document.getElementById('btnCopyLogs').addEventListener('click', () => {
  const logTerminal = document.querySelector('.log-terminal');
  if (logTerminal) {
    const text = logTerminal.innerText;
    copyTextToClipboard(text)
      .then(() => showToast('✅ Loglar panoya kopyalandı!'))
      .catch(() => showToast('❌ Kopyalama başarısız oldu.', true));
  } else {
    showToast('❌ Kopyalanacak log bulunamadı.', true);
  }
});

// Tasarım Ayarlarını Kaydetme
document.getElementById('btnSaveDesign').addEventListener('click', async () => {
  const badgeText = inputs.badgeText.value;
  const watermarkText = inputs.watermarkText.value;

  setStatus('Tasarım ayarları kaydediliyor...', 'busy');
  try {
    const res = await fetch('../api/settings/design', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ badgeText, watermarkText })
    });

    if (res.ok) {
      showToast('✅ Tasarım ayarları güncellendi!');
      setStatus('Kaydedildi', 'ok');
      drawCanvas();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Güncelleme başarısız.');
    }
  } catch (error) {
    showToast('❌ ' + error.message, true);
    setStatus('Hata', 'err');
  }
});

// Logo Yükleme
document.getElementById('customLogo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('❌ Lütfen sadece görsel dosyası seçin!', true);
    return;
  }

  const logoUploadStatus = document.getElementById('logoUploadStatus');
  logoUploadStatus.textContent = 'Görsel okunuyor...';
  setStatus('Logo yükleniyor...', 'busy');

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await fetch('../api/settings/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logoData: reader.result })
      });

      if (res.ok) {
        const data = await res.json();
        showToast('✅ Yeni logo yüklendi!');
        logoUploadStatus.textContent = 'Yeni logo başarıyla yüklendi.';
        setStatus('Yüklendi', 'ok');
        
        currentTheme.logoUrl = data.logoUrl;
        const sidebarLogo = document.getElementById('brandLogoImg');
        if (sidebarLogo) sidebarLogo.src = data.logoUrl + '?t=' + Date.now();
        drawCanvas();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Logo yüklenemedi.');
      }
    } catch (error) {
      showToast('❌ ' + error.message, true);
      logoUploadStatus.textContent = 'Hata: ' + error.message;
      setStatus('Hata', 'err');
    }
  };
  reader.onerror = () => {
    showToast('❌ Dosya okuma hatası!', true);
    logoUploadStatus.textContent = 'Dosya okuma hatası.';
  };
  reader.readAsDataURL(file);
});

