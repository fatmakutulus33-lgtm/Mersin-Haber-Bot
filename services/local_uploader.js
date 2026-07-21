/**
 * services/local_uploader.js
 * Görseli Imgur'a YÜKLEME — Railway'in kendi HTTP sunucusundan serve et.
 *
 * Instagram Graph API, image_url'yi Meta sunucularından indirmek zorunda.
 * Imgur, Meta IP'lerini engellediğinden görsel görünmüyor.
 * Çözüm: Botu barındıran Railway servisinin kendi public URL'ini kullan.
 *
 * Gerekli env değişkeni: PUBLIC_URL (örn. https://mersin-haber-bot.up.railway.app)
 */
const path = require('path');

/**
 * Yerel dosya yolunu, Express static server üzerinden erişilebilir public URL'e çevirir.
 * @param {string} imagePath - Yerel PNG dosyası yolu (output/ altında)
 * @returns {string} Public URL
 */
function getPublicUrl(imagePath) {
  const baseUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

  if (!baseUrl) {
    throw new Error(
      'PUBLIC_URL tanımlı değil! Railway ortam değişkenlerine ekle.\n' +
      'Örnek: PUBLIC_URL=https://mersin-haber-bot.up.railway.app'
    );
  }

  const filename = path.basename(imagePath);
  const url = `${baseUrl}/output/${filename}`;
  console.log(`🌐 Görsel URL (Railway): ${url}`);
  return url;
}

module.exports = { getPublicUrl };
