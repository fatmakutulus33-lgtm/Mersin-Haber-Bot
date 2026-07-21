/**
 * services/imgur_uploader.js
 * Yerel PNG dosyasını Imgur'a yükler, public URL döndürür.
 * Anonim yükleme — API key gerekmez (Client-ID yeterli).
 */
const axios = require('axios');
const fs = require('fs');

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || '546c25a59c58ad7';

/**
 * @param {string} imagePath - Yerel PNG dosyası yolu
 * @returns {string} Public Imgur URL
 */
async function uploadToImgur(imagePath) {
  console.log('📤 Imgur\'a yükleniyor...');
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.post('https://api.imgur.com/3/image', {
        image: base64,
        type: 'base64',
        title: 'Mersin Manset Haber Karti'
      }, {
        headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
        timeout: 30000
      });

      const url = res.data.data.link;
      console.log(`✅ Imgur URL: ${url}`);
      return url;
    } catch (err) {
      console.warn(`⚠️  Imgur deneme ${attempt}/3: ${err.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Imgur yükleme 3 denemede başarısız oldu');
}

module.exports = { uploadToImgur };
