const axios = require('axios');

/**
 * Telegram üzerinden bildirim gönderir.
 * @param {string} message - Gönderilecek mesaj
 */
async function sendNotification(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('⚠️  Telegram token veya chat ID bulunamadı, bildirim gönderilmiyor.');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('✅ Telegram bildirimi gönderildi.');
  } catch (error) {
    console.error('❌ Telegram bildirimi gönderilirken hata:', error.message);
  }
}

module.exports = { sendNotification };
