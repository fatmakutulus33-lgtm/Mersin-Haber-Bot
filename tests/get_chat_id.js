/**
 * get_chat_id.js — Chat ID'yi tespit etmek için tek seferlik script.
 * Bot'a /start yazınca chat ID'yi yazdırır.
 */
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log('');
console.log('🤖 Bot dinleniyor...');
console.log('👉 Telegram\'da @railway2026_bot\'a /start veya herhangi bir mesaj yaz.');
console.log('');

bot.on('message', (msg) => {
  console.log('━'.repeat(50));
  console.log('✅ CHAT ID BULUNDU!');
  console.log(`   Chat ID   : ${msg.chat.id}`);
  console.log(`   Kullanıcı : ${msg.from.first_name} (@${msg.from.username || 'bilinmiyor'})`);
  console.log('━'.repeat(50));
  console.log('');
  console.log(`📋 .env dosyasına şunu ekle:`);
  console.log(`   TELEGRAM_CHAT_ID=${msg.chat.id}`);
  console.log('');
  bot.stopPolling();
  process.exit(0);
});

// 60 sn sonra timeout
setTimeout(() => {
  console.log('⏰ 60 saniye doldu, mesaj gelmedi.');
  bot.stopPolling();
  process.exit(1);
}, 60000);
