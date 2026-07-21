require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cron = require('node-cron');
const { runPipeline } = require('./pipeline');
const { initBot } = require('./services/telegram_approver');

const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Global console override for timestamps
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

console.log = (...args) => originalLog.apply(console, [getTimestamp(), ...args]);
console.warn = (...args) => originalWarn.apply(console, [getTimestamp(), ...args]);
console.error = (...args) => originalError.apply(console, [getTimestamp(), ...args]);

const PORT = process.env.PORT || 3000;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *';

const app = express();
app.use(express.json());

// Serve generated news card images publicly
app.use('/output', express.static(path.join(__dirname, 'output')));

// Health check endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`🌐 MERSİNMANSETBOT Express sunucusu başlatıldı — Port: ${PORT}`);
  console.log(`   Sağlık Kontrolü: http://localhost:${PORT}/health`);
  console.log(`   Görsel Erişim: ${process.env.PUBLIC_URL || 'http://localhost:' + PORT}/output/<dosya>.png`);
});

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║         MERSİNMANSETBOT — BAŞLATILDI              ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log(`   Zamanlama  : ${CRON_SCHEDULE}`);
console.log(`   IG ID      : ${process.env.IG_USER_ID}`);
console.log(`   Public URL : ${process.env.PUBLIC_URL || '⚠️ Tanımlı değil!'}`);
console.log('');

// Initialize Telegram Bot for approvals
try {
  initBot();
} catch (err) {
  console.warn('⚠️ Telegram Bot başlatılamadı:', err.message);
}

// Scheduled pipeline task
cron.schedule(CRON_SCHEDULE, async () => {
  console.log(`\n⏰ Zamanlanmış tarama tetiklendi.`);
  try {
    await runPipeline();
  } catch (err) {
    console.error('❌ Pipeline çalıştırılırken hata oluştu:', err.message);
  }
}, { timezone: 'Europe/Istanbul' });

// Auto run on start if enabled
if (process.env.RUN_PIPELINE_ON_START === 'true') {
  console.log('⚡ Başlangıç haber taraması başlatılıyor...');
  runPipeline().catch(err => {
    console.error('❌ Başlangıç haber tarama hatası:', err.message);
  });
}

// Global error handlers to keep the process alive
process.on('uncaughtException', err => {
  console.error('⚠️  Yakalanmamış Hata:', err.message);
});

process.on('unhandledRejection', err => {
  console.error('⚠️  Yakalanmamış Promise Reddi:', err?.message || err);
});
