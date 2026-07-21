/**
 * index.js — Mersin Haber Bot Ana Giriş Noktası
 * Her saat başı otomatik Mersin haberi önizler, Telegram onayı alır ve paylaşır.
 *
 * DEĞİŞİKLİK: Express static file server eklendi.
 * Imgur, Meta/Facebook IP'lerini engellediği için Instagram görselleri yüklenemiyordu.
 * Çözüm: Botu barındıran Railway sunucusunun kendisi görseli serve eder.
 * Gerekli env: PUBLIC_URL=https://<proje>.up.railway.app
 */
require('dotenv').config();

const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Global console override: Her log satırının önüne otomatik [GG.AA.YYYY SA:DK:SN] ekler
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `[${dateStr} ${timeStr}]`;
}

console.log = function(...args) {
  originalLog.apply(console, [getTimestamp(), ...args]);
};

console.warn = function(...args) {
  originalWarn.apply(console, [getTimestamp(), ...args]);
};

console.error = function(...args) {
  originalError.apply(console, [getTimestamp(), ...args]);
};

const path    = require('path');
const fs      = require('fs');
const express = require('express');
const cron    = require('node-cron');
const { initPersistentStorage } = require('./services/persistent_storage');

initPersistentStorage(__dirname);

const { runPipeline, getNextNewsItem } = require('./pipeline');
const { initBot }     = require('./services/telegram_approver');

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *'; // Varsayılan: her saat başı
const PORT          = process.env.PORT || 3000;

function now() {
  return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

// ── Express: static server ─────────────────────────────────────────────────
const app = express();

// CORS middleware (Arayüzün Netlify üzerinden API isteği atabilmesi için)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON istek gövdelerini ayrıştırmak için middleware
app.use(express.json());

// Dashboard klasörünü sun (arayüze tarayıcıdan erişim için)
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));
app.use('/', express.static(path.join(__dirname, 'dashboard')));

// /output/ altındaki PNG dosyaları Instagram tarafından indirilir
app.use('/output', express.static(path.join(__dirname, 'output')));

// Sağlık kontrolü (Railway / uptime botları için)
app.get('/health', (_req, res) => res.json({ status: 'ok', time: now() }));

// Paylaşılan haberlerin istatistiklerini ve listesini sunan API
app.get('/posted_news.json', (_req, res) => {
  const filePath = path.join(__dirname, 'posted_news.json');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.json({ posted: [], lastUpdated: "" });
  }
});

// PM2 süreç durumu ve sunucu loglarını sunan API
app.get('/api/pipeline', async (_req, res) => {
  try {
    const os = require('os');
    const outLogPath = path.join(os.homedir(), '.pm2/logs/mersin-haber-bot-out.log');
    const errLogPath = path.join(os.homedir(), '.pm2/logs/mersin-haber-bot-error.log');

    let logs = '';
    if (fs.existsSync(outLogPath)) {
      logs += fs.readFileSync(outLogPath, 'utf8');
    }
    if (fs.existsSync(errLogPath)) {
      const errLogs = fs.readFileSync(errLogPath, 'utf8');
      if (errLogs.trim()) {
        logs += '\n[HATA LOGLARI]\n' + errLogs;
      }
    }

    // Son 100 satırı filtrele
    const lines = logs.split('\n');
    const lastLines = lines.slice(-100).join('\n');

    // PM2 süreç durumunu al (sadece pm2 altında çalışıyorsa)
    let pm2Status = { uptime: '—', restarts: '—', status: 'online', memory: '—', cpu: '—' };
    if (process.env.PM2_HOME || process.env.PM2_USAGE || process.env.PM2_PID) {
      try {
        const { execSync } = require('child_process');
        const pm2J = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }));
        const botProcess = pm2J.find(p => p.name === 'mersin-haber-bot');
        if (botProcess) {
          const uptimeSec = Math.round((Date.now() - botProcess.pm2_env.pm_uptime) / 1000);
          pm2Status = {
            uptime: uptimeSec > 60 ? Math.floor(uptimeSec / 60) + 'd ' + (uptimeSec % 60) + 's' : uptimeSec + 's',
            restarts: botProcess.pm2_env.restart_time,
            status: botProcess.pm2_env.status,
            memory: Math.round(botProcess.monit.memory / 1024 / 1024) + ' MB',
            cpu: botProcess.monit.cpu + '%'
          };
        }
      } catch (e) {
        // Railway/Docker/Geliştirme ortamında pm2 olmayabilir, sessizce geç
      }
    }

    return res.json({
      success: true,
      pm2: pm2Status,
      logs: lastLines
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Zamanlama aralığı güncelleme API'si (yerel .env dosyasını günceller)
app.post('/api/settings/cron', async (req, res) => {
  const { cron } = req.body;
  if (!cron) return res.status(400).json({ success: false, message: 'Cron zamanlama değeri gereklidir!' });

  console.log(`⚡ Arayüz üzerinden yeni cron zamanlaması talep edildi: ${cron}`);
  try {
    if (!cronModule.validate(cron)) {
      return res.status(400).json({ success: false, message: 'Geçersiz cron ifadesi!' });
    }
    installCron(cron);

    const settingsPath = path.join(__dirname, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (_) {}
    }
    settings.cronSchedule = cron;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

    return res.json({ success: true, message: 'Zamanlama güncellendi ve hemen etkinleştirildi!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Ayarları getiren API
// Ayarları getiren API
app.get('/api/settings', (req, res) => {
  const settingsPath = path.join(__dirname, 'settings.json');
  let settings = { 
    activeSources: ["Sabah Mersin", "NTV", "Google News Mersin", "AA Gündem"],
    badgeText: "SON DAKİKA",
    watermarkText: "www.mersinmanset.tr",
    logoUrl: "assets/logo.png"
  };
  if (fs.existsSync(settingsPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      settings = { ...settings, ...saved };
    } catch (_) {}
  }
  return res.json({ success: true, settings });
});

// Aktif kaynakları güncelleyen API
app.post('/api/settings/sources', (req, res) => {
  const { activeSources } = req.body;
  if (!Array.isArray(activeSources)) {
    return res.status(400).json({ success: false, message: 'Geçersiz kaynak listesi!' });
  }
  console.log(`⚡ Arayüz üzerinden aktif haber kaynakları güncellendi: ${activeSources.join(', ')}`);
  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (_) {}
    }
    settings.activeSources = activeSources;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return res.json({ success: true, message: 'Haber kaynakları başarıyla güncellendi!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Tasarım metinlerini güncelleyen API
app.post('/api/settings/design', (req, res) => {
  const { badgeText, watermarkText } = req.body;
  if (!badgeText || !watermarkText) {
    return res.status(400).json({ success: false, message: 'Rozet ve filigran metinleri gereklidir!' });
  }
  console.log(`⚡ Arayüz üzerinden tasarım ayarları güncellendi: ${badgeText} - ${watermarkText}`);
  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (_) {}
    }
    settings.badgeText = badgeText;
    settings.watermarkText = watermarkText;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return res.json({ success: true, message: 'Tasarım ayarları başarıyla güncellendi!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Yeni logo görselini yükleyen API
app.post('/api/settings/logo', (req, res) => {
  const { logoData } = req.body;
  if (!logoData) {
    return res.status(400).json({ success: false, message: 'Logo görsel verisi (base64) gereklidir!' });
  }
  try {
    const matches = logoData.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, message: 'Geçersiz görsel formatı!' });
    }
    const imageBuffer = Buffer.from(matches[2], 'base64');
    const assetsDir = path.join(__dirname, 'dashboard', 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const logoPath = path.join(assetsDir, 'custom_logo.png');
    fs.writeFileSync(logoPath, imageBuffer);
    console.log(`⚡ Arayüz üzerinden yeni logo yüklendi: ${logoPath}`);

    const settingsPath = path.join(__dirname, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (_) {}
    }
    settings.logoUrl = 'assets/custom_logo.png';
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

    return res.json({ success: true, message: 'Logo başarıyla yüklendi ve güncellendi!', logoUrl: 'assets/custom_logo.png' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Dashboard üzerinden manuel bot tetikleme API'si
app.post('/api/trigger', async (_req, res) => {
  console.log('⚡ Arayüz (Dashboard) üzerinden manuel bot tetiklendi.');
  try {
    // 1. Bir sonraki paylaşılmamış haberi ve görselini bul/çöz (Senkron, hızlı)
    const news = await getNextNewsItem();
    if (!news) {
      return res.json({ success: false, message: 'Yeni paylaşılamamış haber bulunamadı!' });
    }

    // 2. Arka planda asenkron olarak pipeline'ı çalıştır (kart üretme, Telegram onayı vs.)
    runPipeline(news).catch(err => {
      console.error('❌ Tetiklenen pipeline hatası:', err.message);
    });

    // 3. Haberin tüm bilgilerini ve görselini arayüze anında döndür
    return res.json({ 
      success: true, 
      message: 'Bot başarıyla tetiklendi. Telegram onayı gönderiliyor!',
      news: {
        title: news.title,
        snippet: news.snippet,
        date: news.date,
        imageUrl: news.webImageUrl || news.imageUrl || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Static server başlatıldı — port ${PORT}`);
  console.log(`   Arayüz adresi: http://localhost:${PORT}`);
  console.log(`   Görsel erişim: ${process.env.PUBLIC_URL || 'http://localhost:' + PORT}/output/<dosya>.png`);
});
// ───────────────────────────────────────────────────────────────────────────

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║          MERSİN HABER BOT — BAŞLATILDI           ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log(`   Zamanlama  : ${CRON_SCHEDULE}`);
console.log(`   IG Hesap   : @mersin.manset (ID: ${process.env.IG_USER_ID})`);
console.log(`   Public URL : ${process.env.PUBLIC_URL || '⚠️  Tanımlı değil!'}`);
console.log(`   Başlangıç  : ${now()}`);
console.log('');

// Çevre değişkeni kontrolü
if (!process.env.IG_ACCESS_TOKEN) {
  console.error('❌ IG_ACCESS_TOKEN tanımlı değil! .env dosyasını kontrol et.');
  process.exit(1);
}

if (!process.env.PUBLIC_URL) {
  console.log('ℹ️  PUBLIC_URL tanımlı değil. Görseller Catbox.moe üzerinden yüklenecektir.');
}

// Telegram Bot'u başlat (polling — onay butonlarını dinler)
try {
  initBot();
} catch (err) {
  console.warn('⚠️  Telegram Bot başlatılamadı:', err.message);
  console.warn('   Haberler Telegram onayı olmadan yayınlanmaya devam eder.');
}

// Production restartlarında aynı haberi tekrar işlememek ve sağlık kontrolüne
// hızlı cevap vermek için başlangıç çalışması isteğe bağlıdır.
if (process.env.RUN_PIPELINE_ON_START === 'true') {
  console.log('⚡ Başlangıç haberi önizleniyor...');
  runPipeline().catch(err => {
    console.error('❌ Başlangıç hatası:', err.message);
  });
} else {
  console.log('ℹ️ Başlangıç pipeline çalışması atlandı; cron aktif olacak.');
}

// Cron zamanlaması kur
let cronTask = null;
const cronModule = cron;

function installCron(schedule) {
  if (cronTask) cronTask.stop();
  cronTask = cronModule.schedule(schedule, async () => {
    console.log(`\n⏰ Cron tetiklendi: ${now()}`);
    try {
      await runPipeline();
    } catch (err) {
      console.error('❌ Pipeline hatası:', err.message);
    }
  }, { timezone: 'Europe/Istanbul' });
  console.log(`✅ Cron aktif. Sonraki çalışma: ${schedule}`);
}

let initialSchedule = CRON_SCHEDULE;
try {
  const persistedSettings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));
  if (persistedSettings.cronSchedule && cronModule.validate(persistedSettings.cronSchedule)) {
    initialSchedule = persistedSettings.cronSchedule;
  }
} catch (_) {}
installCron(initialSchedule);

console.log('   Durdurmak için: Ctrl+C\n');

// Hata yakaları — botu durdurma
process.on('uncaughtException', err => {
  console.error('⚠️  Yakalanmamış hata:', err.message);
});
process.on('unhandledRejection', err => {
  console.error('⚠️  Yakalanmamış promise reddi:', err?.message || err);
});
