/**
 * Guncellenmis pipeline gorsel akisini test eder (Instagram'a gondermez)
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { fetchMersinNews } = require('./services/news_fetcher');
const { extractNewsImage, downloadImage } = require('./services/image_fetcher');
const { generateNewsCard, OUTPUT_DIR } = require('./services/image_generator');
const { isAlreadyPosted } = require('./services/dedup');

const FALLBACKS_DIR = path.join(__dirname, 'assets', 'fallbacks');
const LOCAL_FALLBACKS = {
  'sports': {
    url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1080&q=80',
    file: 'spor.jpg'
  },
  'accident': {
    url: 'https://images.unsplash.com/photo-1563206767-5b18f218e8de?auto=format&fit=crop&w=1080&q=80',
    file: 'kaza.jpg'
  },
  'city': {
    url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1080&q=80',
    file: 'siyaset.jpg'
  },
  'culture': {
    url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1080&q=80',
    file: 'kultur.jpg'
  },
  'finance': {
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1080&q=80',
    file: 'ekonomi.jpg'
  },
  'agriculture': {
    url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1080&q=80',
    file: 'tarim.jpg'
  },
  'general': {
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1080&q=80',
    file: 'genel.jpg'
  }
};

async function ensureFallbackImages() {
  if (!fs.existsSync(FALLBACKS_DIR)) {
    fs.mkdirSync(FALLBACKS_DIR, { recursive: true });
  }

  for (const key of Object.keys(LOCAL_FALLBACKS)) {
    const item = LOCAL_FALLBACKS[key];
    const localPath = path.join(FALLBACKS_DIR, item.file);
    if (!fs.existsSync(localPath)) {
      console.log(`📥 Eksik yedek görsel indiriliyor: ${item.file}...`);
      await downloadImage(item.url, localPath);
    }
  }
}

function getThemeCategory(title) {
  const lowerTitle = (title || '').toLowerCase();
  
  if (lowerTitle.includes('spor') || lowerTitle.includes('futbol') || lowerTitle.includes('idman') || lowerTitle.includes('maç') || lowerTitle.includes('stadyum') || lowerTitle.includes('yenildi') || lowerTitle.includes('yendi') || lowerTitle.includes('galibiyet') || lowerTitle.includes('basketbol')) {
    return 'sports';
  }
  if (lowerTitle.includes('kaza') || lowerTitle.includes('feci') || lowerTitle.includes('cinayet') || lowerTitle.includes('öldü') || lowerTitle.includes('yaralandı') || lowerTitle.includes('yangın') || lowerTitle.includes('tutuklandı') || lowerTitle.includes('gözaltı') || lowerTitle.includes('operasyon') || lowerTitle.includes('polis')) {
    return 'accident';
  }
  if (lowerTitle.includes('belediye') || lowerTitle.includes('başkan') || lowerTitle.includes('bakan') || lowerTitle.includes('vali') || lowerTitle.includes('seçim') || lowerTitle.includes('parti') || lowerTitle.includes('meclis') || lowerTitle.includes('toplantı')) {
    return 'city';
  }
  if (lowerTitle.includes('festival') || lowerTitle.includes('konser') || lowerTitle.includes('etkinlik') || lowerTitle.includes('sergi') || lowerTitle.includes('tiyatro') || lowerTitle.includes('sanat') || lowerTitle.includes('müzik') || lowerTitle.includes('kültür')) {
    return 'culture';
  }
  if (lowerTitle.includes('altın') || lowerTitle.includes('dolar') || lowerTitle.includes('fiyat') || lowerTitle.includes('zam') || lowerTitle.includes('enflasyon') || lowerTitle.includes('ihracat') || lowerTitle.includes('esnaf') || lowerTitle.includes('ekonomi') || lowerTitle.includes('para') || lowerTitle.includes('ticaret')) {
    return 'finance';
  }
  if (lowerTitle.includes('tarım') || lowerTitle.includes('çiftçi') || lowerTitle.includes('hal') || lowerTitle.includes('meyve') || lowerTitle.includes('sebze') || lowerTitle.includes('portakal') || lowerTitle.includes('limon') || lowerTitle.includes('domates') || lowerTitle.includes('tarla')) {
    return 'agriculture';
  }
  
  return 'general';
}

(async function() {
  console.log('Haberler cekiliyor...');
  const allNews = await fetchMersinNews();
  
  // Gorsel olmayan ilk haberi sec
  const news = allNews.find(function(n) { return !n.imageUrl && !isAlreadyPosted(n.id); })
             || allNews[0];
  
  if (!news) { console.log('Haber yok'); return; }
  
  console.log('\nSecilen: ' + news.title.substring(0, 60));
  console.log('Link: ' + news.link.substring(0, 80));
  console.log('RSS Gorsel URL: ' + (news.imageUrl || 'YOK'));
  
  // Gorsel URL bul
  var resolvedImageUrl = news.imageUrl || null;
  let isLocalImage = false;
  if (!resolvedImageUrl && !news.link.includes('news.google.com')) {
    console.log('\nSayfadan gorsel aranıyor...');
    resolvedImageUrl = await extractNewsImage(news.link);
    console.log('Sayfa gorseli: ' + (resolvedImageUrl || 'YOK'));
  }
  
  if (!resolvedImageUrl) {
    console.log('\nGörsel bulunamadı, habere uygun görsel yerel arşivden tasarlanıyor...');
    await ensureFallbackImages();
    const category = getThemeCategory(news.title);
    const fallbackItem = LOCAL_FALLBACKS[category] || LOCAL_FALLBACKS['general'];
    const localFallbackPath = path.join(FALLBACKS_DIR, fallbackItem.file);
    
    if (fs.existsSync(localFallbackPath)) {
      resolvedImageUrl = localFallbackPath;
      isLocalImage = true;
      console.log(`Tasarlanan yerel yedek görsel: ${fallbackItem.file}`);
    } else {
      console.log('Yerel yedek görsel bulunamadı, Unsplash aranıyor...');
      resolvedImageUrl = `https://images.unsplash.com/featured/1080x1080/?${category},mersin`;
    }
  }
  
  // Gorseli diske indir
  if (isLocalImage) {
    news.imageUrl = resolvedImageUrl;
    console.log('\nYerel yedek görsel arka planı hazır.');
  } else if (resolvedImageUrl) {
    const tempImgPath = path.join(OUTPUT_DIR, 'bg_test.jpg');
    const downloaded = await downloadImage(resolvedImageUrl, tempImgPath);
    if (downloaded) {
      news.imageUrl = tempImgPath;
      console.log('\nGorsel yerel diske indirildi: ' + tempImgPath);
    } else {
      console.log('\nGörsel indirilemedi, habere uygun görsel yerel arşivden tasarlanıyor...');
      await ensureFallbackImages();
      const category = getThemeCategory(news.title);
      const fallbackItem = LOCAL_FALLBACKS[category] || LOCAL_FALLBACKS['general'];
      const localFallbackPath = path.join(FALLBACKS_DIR, fallbackItem.file);
      
      if (fs.existsSync(localFallbackPath)) {
        news.imageUrl = localFallbackPath;
        console.log(`Tasarlanan yerel yedek görsel (indirme hatası yedek): ${fallbackItem.file}`);
      } else {
        news.imageUrl = null;
        console.log('\nGörsel indirilemedi, varsayilan arka plan kullanilacak.');
      }
    }
  } else {
    news.imageUrl = null;
    console.log('\nGorsel bulunamadi.');
  }
  
  // Haber karti uret
  const imageFile = path.join(OUTPUT_DIR, 'test_kart.png');
  console.log('\nHaber kart uretiliyor...');
  await generateNewsCard(news, imageFile);
  console.log('\nBASARI! Kart olustu: ' + imageFile);
  console.log('Gorsel arka plan: ' + (news.imageUrl ? 'HABER GORSELI KULLANILDI' : 'VARSAYILAN ARKA PLAN'));
})().catch(console.error);
