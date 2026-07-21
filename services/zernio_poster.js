const axios = require('axios');
const fs = require('fs');

async function postToTikTok(imagePath, news) {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error('ZERNIO_API_KEY bulunamadı.');
  }

  const accountId = "6a2f8a705f7d1751abb89639";
  let jpegPath = imagePath;
  if (imagePath.endsWith('.png')) {
    jpegPath = imagePath.replace(/\.png$/, '.jpg');
  }

  if (!fs.existsSync(jpegPath)) {
    throw new Error(`TikTok için JPEG dosyası bulunamadı: ${jpegPath}`);
  }

  const { resolvePublicUrl } = require('./instagram_poster');
  console.log('📤 TikTok görseli public URL\'e çevriliyor...');
  const imageUrl = await resolvePublicUrl(jpegPath);
  console.log('🌐 TikTok Görsel URL:', imageUrl);

  let content = `📰 ${news.title}`;
  const hashtags = ' #mersin #haber';
  
  if (content.length + hashtags.length > 90) {
    const allowedTitleLength = 90 - hashtags.length - 4;
    content = `📰 ${news.title.substring(0, allowedTitleLength)}...` + hashtags;
  } else {
    content = content + hashtags;
  }
  
  if (content.length > 90) {
    content = content.substring(0, 87) + '...';
  }

  console.log('🚀 TikTok paylaşımı Zernio API üzerinden gönderiliyor...');
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

  console.log('✅ Zernio TikTok API başarılı!');
  return response.data?.id || 'zernio_tiktok_success';
}

module.exports = { postToTikTok };
