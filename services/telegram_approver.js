/**
 * telegram_approver.js
 * Haber paylaşımı öncesi Telegram üzerinden onay mekanizması.
 * 
 * Akış:
 *  1. Haber önizlemesini + görseli Telegram'a gönder
 *  2. "✅ Yayınla" / "❌ Reddet" inline butonları sun
 *  3. APPROVAL_TIMEOUT_MS içinde buton tıklanmazsa → otomatik RED
 *  4. Sonucu Promise olarak döndür: true = onaylandı, false = reddedildi
 */

process.env["NTBA_FIX_350"] = 1;

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const PENDING_FILE = path.join(__dirname, '..', 'pending_approval.json');

// No approval timeout is used anymore, it waits indefinitely until approved or rejected manually.

let _bot = null;

/**
 * Bot singleton — index.js tarafından başlatılır.
 * Polling tek bir yerden yapılmalı; bu modül mevcut instance'ı alır.
 */
function initBot() {
  if (_bot) return _bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN .env içinde tanımlı değil!');
  // DISABLE_TELEGRAM=true → polling başlat, bot instance oluştur ama polling yapma
  // Bu özellikle test veya CI ortamlarında başka bir instance ile çakışmayı önler
  if (process.env.DISABLE_TELEGRAM === 'true') {
    console.log('⚠️  DISABLE_TELEGRAM=true — Telegram bot devre dışı.');
    return null;
  }
  _bot = new TelegramBot(token, { polling: true });
  console.log('🤖 Telegram Bot polling başlatıldı.');

  // Polling hatalarını yakala ve logla
  _bot.on('polling_error', (error) => {
    console.error('❌ Telegram Polling Hatası:', error.code || error.name, error.message);
  });

  // Her gelen mesajı logla ve id/start/gruba katılma isteklerine anında yanıt ver
  _bot.on('message', async (msg) => {
    console.log(`📩 Telegram Mesajı Alındı [ChatID: ${msg.chat.id}, Tür: ${msg.chat.type}]: ${msg.text || '[Medya/Sistem]'}`);

    const text = (msg.text || '').trim().toLowerCase();
    const isIdRequest = text.includes('id') || text.includes('start') || text.includes('tetikle');

    if (isIdRequest || msg.new_chat_members) {
      const chatId = msg.chat.id;
      const chatType = msg.chat.type;
      const title = msg.chat.title || msg.from.first_name || 'Bilinmiyor';
      
      if (text.includes('id') || text.includes('start') || msg.new_chat_members) {
        try {
          await _bot.sendMessage(chatId, `🆔 <b>Chat Bilgisi</b>\n\n📌 <b>Adı:</b> ${title}\n🏷️ <b>Tür:</b> ${chatType}\n🔢 <b>Chat ID:</b> <code>${chatId}</code>`, { parse_mode: 'HTML' });
          console.log(`✅ Chat ID bildirimi gönderildi -> ${chatId}`);
        } catch (err) {
          console.error(`❌ Chat ID yanıtı gönderilemedi:`, err.message);
        }
      }
    }
  });

  // /tetikle komut dinleyicisi
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

  // Bekleyen onayı kurtar
  try {
    restorePendingApproval();
  } catch (err) {
    console.error('❌ Bekleyen onay kurtarılırken hata:', err.message);
  }

  return _bot;
}

/**
 * Uygulama yeniden başladığında bekleyen Telegram onayını kurtarır ve callback dinleyicisini yeniden kurar.
 */
function restorePendingApproval() {
  if (!fs.existsSync(PENDING_FILE)) return;

  try {
    const data = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    console.log(`♻️  Bekleyen Telegram onay isteği kurtarılıyor (msg_id: ${data.messageId})...`);

    const bot = _bot;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!bot || !chatId) return;

    function handler(query) {
      if (query.data !== data.approvalId && query.data !== data.rejectId) return;

      bot.removeListener('callback_query', handler);

      const approved = query.data === data.approvalId;
      const statusText = approved
        ? `✅ <b>Onaylandı!</b> WordPress'te yayınlanıyor...\n\n📌 <i>${data.news.title}</i>`
        : `❌ <b>Reddedildi.</b> Bu haber yayınlanmayacak.\n\n📌 <i>${data.news.title}</i>`;

      // Butonları kaldır, durumu güncelle
      bot.editMessageCaption(statusText, {
        chat_id: chatId,
        message_id: data.messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] }
      }).catch(() => {});

      bot.answerCallbackQuery(query.id, {
        text: approved ? '🚀 Haber onaylandı!' : '🗑️ Haber reddedildi.'
      }).catch(() => {});

      console.log(`${approved ? '✅ Haber onaylandı (KURTARILAN)' : '❌ Haber reddedildi (KURTARILAN)'} (kullanıcı: @${query.from.username || query.from.first_name})`);

      // Kalıcılık dosyasını temizle
      try { fs.unlinkSync(PENDING_FILE); } catch (_) {}

      // Paylaşım adımlarını tetikle
      if (approved) {
        const { publishNewsItem } = require('../pipeline');
        console.log('🚀 Kurtarılan haber için paylaşım akışı başlatılıyor...');
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

/**
 * Haber önizlemesini Telegram'a gönderir ve onay bekler.
 * @param {object} news        - { title, source, date, link }
 * @param {string} imgurUrl    - Imgur'a yüklenen görsel URL
 * @returns {Promise<boolean>} - true = onaylandı, false = reddedildi/zaman aşımı
 */
async function requestApproval(news, imgurUrl) {
  const bot = _bot;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!bot || !chatId) {
    if (process.env.DISABLE_TELEGRAM === 'true') {
      console.log('🚫  DISABLE_TELEGRAM=true — Lokal test modu: onay isteği atlandı, haber reddedildi (Instagram\'a gönderilmez).');
      return false;
    }
    console.log('⚠️  Telegram bot/chatId yok — onay atlanıyor, doğrudan yayınlanıyor.');
    return true;
  }

  const approvalId = `approve_${Date.now()}`;
  const rejectId   = `reject_${Date.now()}`;

  const caption =
    `📰 <b>Yayınlanacak Haber (WordPress)</b>\n\n` +
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
    // Görsel varsa photo olarak, yoksa text olarak gönder
    if (imgurUrl) {
      const isLocal = fs.existsSync && fs.existsSync(imgurUrl);
      const photoSource = isLocal ? fs.createReadStream(imgurUrl) : imgurUrl;
      const fileOptions = isLocal ? { filename: 'haber.png', contentType: 'image/png' } : {};
      sentMessage = await bot.sendPhoto(chatId, photoSource, {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      }, fileOptions);
    } else {
      sentMessage = await bot.sendMessage(chatId, caption, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }
    console.log(`📨 Telegram onay mesajı gönderildi (msg_id: ${sentMessage.message_id})`);
    
    // Mesaj başarıyla gönderildiyse onay durumunu geçici olarak diske kaydet
    fs.writeFileSync(PENDING_FILE, JSON.stringify({
      approvalId,
      rejectId,
      news,
      imageFile: imgurUrl,
      messageId: sentMessage.message_id
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Telegram onay mesajı gönderilemedi:', err.message);
    return true; // Telegram hatası = engelleme, yayına devam et
  }

  // Callback_query bekle (Promise)
  return new Promise((resolve) => {
    let resolved = false;

    function handler(query) {
      if (query.data !== approvalId && query.data !== rejectId) return;
      if (resolved) return;
      resolved = true;

      bot.removeListener('callback_query', handler);

      const approved = query.data === approvalId;
      const statusText = approved
        ? `✅ <b>Onaylandı!</b> WordPress'te yayınlanıyor...\n\n📌 <i>${news.title}</i>`
        : `❌ <b>Reddedildi.</b> Bu haber yayınlanmayacak.\n\n📌 <i>${news.title}</i>`;

      // Butonları kaldır, durumu güncelle
      bot.editMessageCaption(statusText, {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] }
      }).catch(() => {});

      // Callback query'yi onayla (loading spinner kaldırılsın)
      bot.answerCallbackQuery(query.id, {
        text: approved ? '🚀 Haber onaylandı!' : '🗑️ Haber reddedildi.'
      }).catch(() => {});

      console.log(`${approved ? '✅ Haber onaylandı' : '❌ Haber reddedildi'} (kullanıcı: @${query.from.username || query.from.first_name})`);
      
      // Onay veya red tamamlandığı için kalıcılık dosyasını temizle
      try { fs.unlinkSync(PENDING_FILE); } catch (_) {}
      
      resolve(approved);
    }

    bot.on('callback_query', handler);
  });
}

/**
 * Pipeline tamamlandığında Telegram'a sonuç bildirimi gönderir.
 * @param {string} message - HTML formatında mesaj
 */
async function sendNotification(message) {
  const bot = _bot;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!bot || !chatId) {
    console.log('⚠️  Telegram token veya chat ID bulunamadı, bildirim gönderilmiyor.');
    return;
  }

  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    console.log('✅ Telegram bildirimi gönderildi.');
  } catch (error) {
    console.error('❌ Telegram bildirimi gönderilirken hata:', error.message);
  }
}

module.exports = { initBot, getBot, requestApproval, sendNotification };
