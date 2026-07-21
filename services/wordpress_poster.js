/**
 * services/wordpress_poster.js
 * Mersin haberlerini WordPress REST API üzerinden yeni içerik olarak yayınlar.
 */
const axios = require('axios');
const { resolvePublicUrl } = require('./instagram_poster');

function buildWordPressContent(news, imageUrl) {
  let htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 760px; margin: 0 auto; line-height: 1.7; color: #1f2937;">
  `;

  if (imageUrl) {
    htmlContent += `
      <div style="margin: 0 0 20px 0;">
        <img src="${imageUrl}" alt="${news.title}" style="width: 100%; height: auto; border-radius: 14px; display: block;" />
      </div>
    `;
  }

  htmlContent += `
      <h1 style="font-size: 34px; line-height: 1.2; margin: 0 0 16px 0; color: #111827;">${news.title}</h1>
      <p style="font-size: 18px; color: #374151; margin: 0 0 18px 0;">${news.snippet}</p>
      <p style="font-size: 15px; color: #6b7280; margin: 0 0 24px 0;">
        Kaynak: <strong>${news.source}</strong> | Tarih: ${news.date || ''}
      </p>
      <p style="font-size: 16px; color: #111827; margin: 0 0 16px 0;">
        Detaylar için orijinal haberi ziyaret edin:
        <a href="${news.link}" target="_blank" rel="noopener noreferrer">${news.link}</a>
      </p>
    </div>
  `;

  return htmlContent;
}

async function getWordPressAuth() {
  const siteUrl = (process.env.WORDPRESS_SITE_URL || 'https://www.mersinmanset.tr').replace(/\/$/, '');
  const username = process.env.WORDPRESS_USERNAME;
  const appPassword = process.env.WORDPRESS_APP_PASSWORD;

  if (!username || !appPassword) {
    return null;
  }

  const token = Buffer.from(`${username}:${appPassword}`).toString('base64');
  return { siteUrl, token };
}

async function postToWordPress(imagePath, news, durableImageUrl) {
  const auth = await getWordPressAuth();
  if (!auth) {
    console.log('ℹ️  WordPress kimlik bilgileri eksik. WordPress yayını atlanıyor.');
    return null;
  }

  const { siteUrl, token } = auth;
  const apiUrl = `${siteUrl}/wp-json/wp/v2/posts`;

  let imageUrl = null;
  try {
    imageUrl = durableImageUrl !== undefined ? durableImageUrl : await resolvePublicUrl(imagePath);
  } catch (err) {
    console.warn('⚠️ WordPress görsel URL üretilemedi, içerik görselsiz yayınlanacak:', err.message);
  }

  const payload = {
    title: news.title,
    content: buildWordPressContent(news, imageUrl),
    status: 'publish',
    excerpt: news.snippet || '',
  };

  try {
    console.log(`🚀 WordPress API'sine gönderiliyor: ${apiUrl}`);
    const response = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });

    const postUrl = response.data?.link || null;
    if (postUrl) {
      console.log('✅ WordPress paylaşımı başarıyla tamamlandı!');
    } else {
      console.warn('⚠️ WordPress API yanıtı beklenen link alanını içermiyor:', response.data);
    }
    return postUrl;
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    console.error('❌ WordPress API paylaşım hatası:', errMsg);
    return null;
  }
}

module.exports = { postToWordPress };
