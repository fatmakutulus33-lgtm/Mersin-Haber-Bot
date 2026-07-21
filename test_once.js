/**
 * test_once.js
 * Pipeline'ı bir kez çalıştır — cron olmadan.
 * Telegram onay botu da başlatılır.
 * Kullanım: node test_once.js
 */
require('dotenv').config();
const { initBot } = require('./services/telegram_approver');
const { runPipeline } = require('./pipeline');

console.log('🧪 TEST MODU — Tek seferlik çalışma\n');

// Telegram botunu başlat (onay butonları için polling)
try {
  initBot();
} catch (err) {
  console.warn('⚠️  Telegram Bot başlatılamadı:', err.message);
}

runPipeline()
  .then(() => { console.log('\n✅ Test başarılı!'); process.exit(0); })
  .catch(err => { console.error('\n❌ Test hatası:', err.message); process.exit(1); });
