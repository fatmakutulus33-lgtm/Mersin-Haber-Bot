/**
 * services/zernio_poster.js
 * Zernio API ile TikTok üzerinde haber paylaşımı yapar.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Zernio API aracılığıyla TikTok'a haber görseli ve açıklaması gönderir.
 * @param {string} imagePath - Oluşturulan kartın dosya yolu (.png veya .jpg)
 * @param {object} news - Haber objesi (title, snippet vb. barındırır)
 */
async function postToTikTok(imagePath, news) {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error('ZERNIO_API_KEY env variable is missing. Please set it in .env');
  }

  // TikTok Account ID
  const accountId = "6a2f8a705f7d1751abb89639";
  
  // TikTok PNG desteklemediği için JPEG formatındaki görseli kullanacağız
  let jpegPath = imagePath;
  if (imagePath.endsWith('.png')) {
    jpegPath = imagePath.replace(/\.png$/, '.jpg');
  }

  if (!fs.existsSync(jpegPath)) {
    throw new Error(`JPEG image file not found for TikTok: ${jpegPath}`);
  }

  // resolvePublicUrl fonksiyonunu instagram_poster'dan import ederek görseli CDN/Catbox.moe'ya yüklüyoruz
  const { resolvePublicUrl } = require('./instagram_poster');
  
  console.log('📤 TikTok görseli public URL\'e çevriliyor...');
  const imageUrl = await resolvePublicUrl(jpegPath);
  console.log('🌐 TikTok Görsel URL:', imageUrl);

  // TikTok fotoğraf paylaşımlarında başlık/içerik en fazla 90 karakter olmalıdır.
  let content = `📰 ${news.title}`;
  const hashtags = ' #mersin #haber';
  
  if (content.length + hashtags.length > 90) {
    const allowedTitleLength = 90 - hashtags.length - 4; // '...' ve boşluklar dahil
    content = `📰 ${news.title.substring(0, allowedTitleLength)}...` + hashtags;
  } else {
    content = content + hashtags;
  }
  
  if (content.length > 90) {
    content = content.substring(0, 87) + '...';
  }

  console.log('🚀 Sending post to Zernio TikTok API...');
  
  const response = await axios.post('https://zernio.com/api/v1/posts', {
    content: content,
    mediaItems: [
      {
        type: "image",
        url: imageUrl
      }
    ],
    platforms: [
      {
        platform: "tiktok",
        accountId: accountId
      }
    ],
    isDraft: false,
    publishNow: true
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  console.log('✅ Zernio TikTok API Success!');
  // API response içerisindeki ID'yi dön
  const publishId = response.data?.id || (response.data?.data && response.data.data.id) || 'zernio_tiktok_success';
  return publishId;
}

module.exports = { postToTikTok };
