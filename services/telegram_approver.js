process.env["NTBA_FIX_350"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const PENDING_FILE = fs.existsSync('/data') 
  ? '/data/pending_approval.json' 
  : path.join(__dirname, '..', 'pending_approval.json');
let _bot = null;

function initBot() {
  if (_bot) return _bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN tanımlı değil!');

  if (process.env.DISABLE_TELEGRAM === 'true') {
    console.log('⚠️  DISABLE_TELEGRAM=true — Telegram bot devre dışı.');
    return null;
  }

  _bot = new TelegramBot(token, { polling: true });
  console.log('🤖 Telegram Bot polling başlatıldı.');

  _bot.on('polling_error', (error) => {
    console.error('❌ Telegram Polling Hatası:', error.message);
  });

  _bot.on('message', async (msg) => {
    const text = (msg.text || '').trim().toLowerCase();
    if (text.includes('id') || text.includes('start')) {
      try {
        await _bot.sendMessage(msg.chat.id, `🆔 <b>Chat Bilgisi</b>\n\n📌 <b>Adı:</b> ${msg.chat.title || msg.from.first_name}\n🏷️ <b>Tür:</b> ${msg.chat.type}\n🔢 <b>Chat ID:</b> <code>${msg.chat.id}</code>`, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('❌ Telegram ID yanıtı gönderilemedi:', err.message);
      }
    }
  });

  _bot.on('callback_query', (query) => {
    setTimeout(() => {
      _bot.answerCallbackQuery(query.id).catch(() => {});
    }, 1500);
  });

  _bot.onText(/\/tetikle/, async (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== process.env.TELEGRAM_CHAT_ID.toString()) {
      _bot.sendMessage(chatId, "⚠️ Yetkiniz bulunmamaktadır.");
      return;
    }
    _bot.sendMessage(chatId, "📡 Haberler taranıyor ve yeni bir haber hazırlanıyor...");
    try {
      const { runPipeline } = require('../pipeline');
      runPipeline().catch(err => {
        _bot.sendMessage(chatId, `❌ Hata oluştu: ${err.message}`);
      });
    } catch (err) {
      _bot.sendMessage(chatId, `❌ Hata oluştu: ${err.message}`);
    }
  });

  try {
    restorePendingApproval();
  } catch (err) {
    console.error('❌ Bekleyen onay kurtarılırken hata:', err.message);
  }

  return _bot;
}

function restorePendingApproval() {
  if (!fs.existsSync(PENDING_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    console.log(`♻️  Bekleyen onay kurtarılıyor (msg_id: ${data.messageId})...`);

    const bot = _bot;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!bot || !chatId) return;

    function handler(query) {
      if (query.data !== data.approvalId && query.data !== data.rejectId) return;
      bot.removeListener('callback_query', handler);

      const approved = query.data === data.approvalId;
      const statusText = approved
        ? `✅ <b>Onaylandı!</b> Paylaşımlar yapılıyor...\n\n📌 <i>${data.news.title}</i>`
        : `❌ <b>Reddedildi.</b> Bu haber yayınlanmayacak.\n\n📌 <i>${data.news.title}</i>`;

      const editOpts = {
        chat_id: chatId,
        message_id: data.messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] }
      };

      bot.editMessageCaption(statusText, editOpts).catch(() => {
        bot.editMessageText(statusText, editOpts).catch(() => {});
      });

      bot.answerCallbackQuery(query.id, {
        text: approved ? '🚀 Haber onaylandı!' : '🗑️ Haber reddedildi.'
      }).catch(() => {});

      try { fs.unlinkSync(PENDING_FILE); } catch (_) {}

      if (approved) {
        const { publishNewsItem } = require('../pipeline');
        publishNewsItem(data.imageFile, data.news).catch(err => {
          console.error('❌ Kurtarılan haber paylaşımı başarısız:', err.message);
        });
      } else {
        const { cleanupImage } = require('./image_generator');
        const { markAsPosted } = require('./dedup');
        cleanupImage(data.imageFile);
        markAsPosted(data.news, 'REJECTED');
      }
    }
    bot.on('callback_query', handler);
  } catch (err) {
    console.error('❌ Bekleyen onay verisi okunamadı:', err.message);
  }
}

function getBot() {
  return _bot;
}

async function requestApproval(news, localImagePath) {
  const bot = _bot;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chatId) {
    if (process.env.DISABLE_TELEGRAM === 'true') {
      console.log('🚫 Telegram devre dışı, onay isteği atlandı.');
      return false;
    }
    return true;
  }

  const approvalId = `approve_${Date.now()}`;
  const rejectId   = `reject_${Date.now()}`;

  const caption =
    `📰 <b>Yayınlanacak Haber (Mersin Manşet)</b>\n\n` +
    `📌 <i>${news.title}</i>\n\n` +
    `📅 Tarih  : ${news.date}\n` +
    `🔗 <a href="${news.link}">Orijinal Habere Git</a>`;

  const keyboard = {
    inline_keyboard: [[
      { text: '✅ Yayınla',  callback_data: approvalId },
      { text: '❌ Reddet',   callback_data: rejectId   }
    ]]
  };

  let sentMessage;
  try {
    if (localImagePath && fs.existsSync(localImagePath)) {
      sentMessage = await bot.sendPhoto(chatId, fs.createReadStream(localImagePath), {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      }, { filename: 'news.png', contentType: 'image/png' });
    } else {
      sentMessage = await bot.sendMessage(chatId, caption, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }

    fs.writeFileSync(PENDING_FILE, JSON.stringify({
      approvalId,
      rejectId,
      news,
      imageFile: localImagePath,
      messageId: sentMessage.message_id
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Telegram onay mesajı gönderilemedi:', err.message);
    return true;
  }

  return new Promise((resolve) => {
    let resolved = false;
    function handler(query) {
      if (query.data !== approvalId && query.data !== rejectId) return;
      if (resolved) return;
      resolved = true;
      bot.removeListener('callback_query', handler);

      // Read state safely
      let data = { news };
      try { data = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch (_) {}

      const approved = query.data === approvalId;
      const statusText = approved
        ? `✅ <b>Onaylandı!</b> Paylaşımlar yapılıyor...\n\n📌 <i>${data.news.title}</i>`
        : `❌ <b>Reddedildi.</b> Bu haber yayınlanmayacak.\n\n📌 <i>${data.news.title}</i>`;

      const editOpts = {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] }
      };

      bot.editMessageCaption(statusText, editOpts).catch(() => {
        bot.editMessageText(statusText, editOpts).catch(() => {});
      });

      bot.answerCallbackQuery(query.id, {
        text: approved ? '🚀 Haber onaylandı!' : '🗑️ Haber reddedildi.'
      }).catch(() => {});

      try { fs.unlinkSync(PENDING_FILE); } catch (_) {}
      resolve(approved);
    }
    bot.on('callback_query', handler);
  });
}

async function sendNotification(message) {
  const bot = _bot;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chatId) return;
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (error) {
    console.error('❌ Telegram bildirimi gönderilemedi:', error.message);
  }
}

module.exports = { initBot, getBot, requestApproval, sendNotification };
