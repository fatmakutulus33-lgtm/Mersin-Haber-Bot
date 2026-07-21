require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { fetchMersinNews } = require('./services/news_fetcher');
const { extractNewsImage, downloadImage } = require('./services/image_fetcher');
const { generateNewsCard, cleanupImage, OUTPUT_DIR } = require('./services/image_generator');
const { postToInstagram } = require('./services/instagram_poster');
const { isAlreadyPosted, markAsPosted, getRecentPosts } = require('./services/dedup');
const { requestApproval, sendNotification } = require('./services/telegram_approver');

function now() {
  return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

const FALLBACKS_DIR = path.join(__dirname, 'assets', 'fallbacks');
const LOCAL_FALLBACKS = {
  sports: { url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1080&q=80', file: 'spor.jpg' },
  accident: { url: 'https://images.unsplash.com/photo-1563206767-5b18f218e8de?auto=format&fit=crop&w=1080&q=80', file: 'kaza.jpg' },
  city: { url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1080&q=80', file: 'siyaset.jpg' },
  culture: { url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1080&q=80', file: 'kultur.jpg' },
  finance: { url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1080&q=80', file: 'ekonomi.jpg' },
  agriculture: { url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1080&q=80', file: 'tarim.jpg' },
  general: { url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1080&q=80', file: 'genel.jpg' }
};

async function ensureFallbackImages() {
  if (!fs.existsSync(FALLBACKS_DIR)) fs.mkdirSync(FALLBACKS_DIR, { recursive: true });
  for (const key of Object.keys(LOCAL_FALLBACKS)) {
    const item = LOCAL_FALLBACKS[key];
    const localPath = path.join(FALLBACKS_DIR, item.file);
    if (!fs.existsSync(localPath)) {
      await downloadImage(item.url, localPath);
    }
  }
}

async function getNextNewsItem() {
  const allNews = await fetchMersinNews();
  if (allNews.length === 0) return null;

  const candidates = allNews.filter(n => !isAlreadyPosted(n.id));
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
  console.log(`🗞️  MERSIN HABER BOT — ${now()}`);
  console.log('═'.repeat(55));

  let news = newsItem;
  if (!news) news = await getNextNewsItem();
  if (!news) throw new Error('Paylaşılmamış yeni bir haber bulunamadı!');

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
  let publishId = null;
  let instagramError = null;
  try {
    publishId = await postToInstagram(imageFile, news);
  } catch (err) {
    instagramError = err;
    console.error('❌ Instagram paylaşımı başarısız; diğer platformlara devam ediliyor:', err.message);
  }

  let tiktokPublishId = null;
  try {
    const { postToTikTok } = require('./services/zernio_poster');
    tiktokPublishId = await postToTikTok(imageFile, news);
  } catch (err) {
    console.error('❌ TikTok paylaşımı sırasında hata oluştu:', err.message);
  }

  let durableImage = null;
  try {
    const { resolveDurablePublicUrl } = require('./services/instagram_poster');
    durableImage = await resolveDurablePublicUrl(imageFile);
  } catch (err) {
    console.error("❌ Kalıcı görsel URL'si oluşturulamadı:", err.message);
  }

  try {
    const { postToMersinManset } = require('./services/manset_poster');
    await postToMersinManset(news, durableImage && durableImage.url);
  } catch (err) {
    console.error('❌ Web portalına haber gönderilirken hata oluştu:', err.message);
  }

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

  const completedPublishId = wordpressLink || publishId || tiktokPublishId || 'WP_POSTED';
  if (!completedPublishId) {
    throw new Error(`Platform paylaşımları başarısız oldu. Instagram: ${instagramError ? instagramError.message : 'bilinmiyor'}`);
  }
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
  getRecentPosts(3).forEach((p, i) => console.log(`   ${i + 1}. ${p.title.substring(0, 55)} (${new Date(p.postedAt).toLocaleString('tr-TR')})`));
}

module.exports = { runPipeline, getNextNewsItem, publishNewsItem };
