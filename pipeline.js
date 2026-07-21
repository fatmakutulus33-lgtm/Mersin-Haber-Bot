require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { fetchMersinNews } = require('./services/news_fetcher');
const { extractNewsImage, downloadImage } = require('./services/image_fetcher');
const { generateNewsCard, cleanupImage, OUTPUT_DIR } = require('./services/image_generator');
const { postToInstagram } = require('./services/instagram_poster');
const { isAlreadyPosted, markAsPosted } = require('./services/dedup');
const { requestApproval, sendNotification } = require('./services/telegram_approver');

function now() {
  return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

async function getNextNewsItem() {
  const allNews = await fetchMersinNews();
  if (allNews.length === 0) return null;

  const candidates = allNews.filter(n => !isAlreadyPosted(n));
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    let resolvedImageUrl = candidate.imageUrl || null;
    if (!resolvedImageUrl) {
      try {
        resolvedImageUrl = await extractNewsImage(candidate.link);
      } catch (_) {}
    }
    if (resolvedImageUrl) {
      candidate.webImageUrl = resolvedImageUrl;
      return candidate;
    }
    markAsPosted(candidate, 'SKIP_NO_IMAGE');
  }

  return null;
}

async function runPipeline(newsItem = null) {
  console.log('\n' + '═'.repeat(55));
  console.log(`🗞️  MERSIN MANSET BOT PIPELINE — ${now()}`);
  console.log('═'.repeat(55));

  let news = newsItem;
  if (!news) news = await getNextNewsItem();
  if (!news) {
    console.log('ℹ️  Paylaşılmamış yeni bir haber bulunamadı.');
    return;
  }

  const resolvedImageUrl = news.webImageUrl || news.imageUrl || null;
  if (!resolvedImageUrl) {
    markAsPosted(news, 'SKIP_NO_IMAGE');
    return;
  }

  const tempImgPath = path.join(OUTPUT_DIR, `bg_${Date.now()}.jpg`);
  const downloaded = await downloadImage(resolvedImageUrl, tempImgPath);
  if (!downloaded) {
    markAsPosted(news, 'SKIP_DOWNLOAD_FAILED');
    return;
  }
  news.imageUrl = tempImgPath;

  const imageFile = path.join(OUTPUT_DIR, `haber_${Date.now()}.png`);
  await generateNewsCard(news, imageFile);
  try { fs.unlinkSync(news.imageUrl); } catch (_) {}

  const approved = await requestApproval(news, imageFile);
  if (!approved) {
    cleanupImage(imageFile);
    markAsPosted(news, 'REJECTED');
    return;
  }

  await publishNewsItem(imageFile, news);
}

async function publishNewsItem(imageFile, news) {
  let durableImage = null;
  try {
    const { resolveDurablePublicUrl } = require('./services/instagram_poster');
    durableImage = await resolveDurablePublicUrl(imageFile);
  } catch (err) {
    console.error("❌ Kalıcı görsel URL'si oluşturulamadı:", err.message);
  }

  // 1. WordPress (WordPress First!)
  let wordpressLink = null;
  const wordpressEnabled = String(process.env.WORDPRESS_ENABLED || 'true').toLowerCase() !== 'false';
  if (wordpressEnabled) {
    try {
      const { postToWordPress } = require('./services/wordpress_poster');
      wordpressLink = await postToWordPress(imageFile, news, durableImage && durableImage.url);
      if (wordpressLink) console.log(`🎉 WORDPRESS YAYINDA! Link: ${wordpressLink}`);
    } catch (err) {
      console.error('❌ WordPress paylaşımı sırasında hata oluştu:', err.message);
    }
  }

  // 2. Mersin Manşet Web Portal API
  try {
    const { postToMersinManset } = require('./services/manset_poster');
    await postToMersinManset(news, durableImage && durableImage.url);
  } catch (err) {
    console.error('❌ Web portalına haber gönderilirken hata oluştu:', err.message);
  }

  // 3. Instagram
  let publishId = null;
  try {
    publishId = await postToInstagram(imageFile, news);
  } catch (err) {
    console.error('❌ Instagram paylaşımı başarısız:', err.message);
  }

  // 4. TikTok (Zernio)
  let tiktokPublishId = null;
  try {
    const { postToTikTok } = require('./services/zernio_poster');
    tiktokPublishId = await postToTikTok(imageFile, news);
  } catch (err) {
    console.error('❌ TikTok paylaşımı sırasında hata oluştu:', err.message);
  }

  const completedPublishId = wordpressLink || publishId || tiktokPublishId || 'POSTED';
  markAsPosted(news, completedPublishId);

  if (!(durableImage && durableImage.keepLocalFile)) {
    setTimeout(function() { cleanupImage(imageFile); }, 60000);
  }

  let message = `🚀 <b>Yeni Haber Yayında!</b>\n\n📌 <i>${news.title}</i>\n\n`;
  if (wordpressLink) message += `📝 <b>WordPress:</b> <a href="${wordpressLink}">Yazıyı Oku / Sitede Gör</a>\n`;
  else if (!wordpressEnabled) message += `⏸️ <b>WordPress:</b> Bilerek kapalı\n`;
  else message += `⚠️ <b>WordPress:</b> Atlandı veya paylaşılamadı\n`;

  if (publishId) message += `📸 <b>Instagram:</b> <a href="https://www.instagram.com/mersin.manset/">Instagram'da Görüntüle</a>\n`;
  else message += `⚠️ <b>Instagram:</b> Paylaşılamadı\n`;

  if (tiktokPublishId) message += `🎵 <b>TikTok:</b> Paylaşıldı (ID: ${tiktokPublishId})\n`;
  else message += `⚠️ <b>TikTok:</b> Paylaşılamadı.`;

  await sendNotification(message);
}

module.exports = { runPipeline, getNextNewsItem, publishNewsItem };
