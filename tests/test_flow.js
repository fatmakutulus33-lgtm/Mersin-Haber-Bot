/**
 * tests/test_flow.js
 * MERSİNMANSETBOT entegrasyon ve performans test aracı
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { fetchMersinNews } = require('../services/news_fetcher');
const { extractNewsImage, downloadImage } = require('../services/image_fetcher');
const { generateNewsCard, cleanupImage } = require('../services/image_generator');

async function runTest() {
  console.log('🧪 MERSİNMANSETBOT Bütünsel Performans Testi Başlatılıyor...');
  console.log('-----------------------------------------------------------');

  const startTime = Date.now();

  // 1. Haber Çekme Testi
  console.log('\n[1/4] Haber Çekme ve RSS Tarama Test Ediliyor...');
  const fetchStart = Date.now();
  const newsList = await fetchMersinNews();
  const fetchDuration = Date.now() - fetchStart;
  
  console.log(`⚡ RSS Tarama Tamamlandı. Süre: ${fetchDuration} ms`);
  console.log(`📌 Bulunan Haber Sayısı: ${newsList.length}`);
  
  if (newsList.length === 0) {
    console.error('❌ Hata: Hiç haber bulunamadı.');
    process.exit(1);
  }

  // 2. Orijinal Görsel Çözümleme Testi (Puppeteer Olmadan - Hızlı!)
  console.log('\n[2/4] Puppeteer Olmadan Orijinal Görsel Çözme Test Ediliyor...');
  const targetNews = newsList[0];
  console.log(`📰 Test Haberi: "${targetNews.title}"`);
  console.log(`🔗 Link: ${targetNews.link}`);

  const imageResolveStart = Date.now();
  const resolvedImageUrl = targetNews.imageUrl || await extractNewsImage(targetNews.link);
  const imageResolveDuration = Date.now() - imageResolveStart;

  console.log(`⚡ Görsel Çözümleme Süresi: ${imageResolveDuration} ms`);
  console.log(`🖼️ Çözümlenen Görsel URL: ${resolvedImageUrl || 'Mevcut değil (Yedek görsel kullanılacak)'}`);

  // 3. Görsel İndirme Testi
  console.log('\n[3/4] Görsel İndirme ve weserv.nl Proxy Test Ediliyor...');
  const tempImgPath = path.join(__dirname, '..', 'output', `test_bg_${Date.now()}.jpg`);
  
  if (resolvedImageUrl) {
    const downloadStart = Date.now();
    try {
      await downloadImage(resolvedImageUrl, tempImgPath);
      console.log(`⚡ Görsel başarıyla indirildi. Süre: ${Date.now() - downloadStart} ms`);
    } catch (err) {
      console.warn(`⚠️ Görsel indirme başarısız (${err.message}). Yedek görsel kullanılacak.`);
    }
  } else {
    console.log('ℹ️ Haber görseli yok, yedek arka plan kullanılacak.');
  }

  // 4. Görsel Kart Üretme Testi
  console.log('\n[4/4] Canvas Tabanlı Görsel Kart Üretme Test Ediliyor...');
  const testCardPath = path.join(__dirname, '..', 'output', `test_card_${Date.now()}.png`);
  
  if (fs.existsSync(tempImgPath)) {
    targetNews.imageUrl = tempImgPath;
  }

  const cardStart = Date.now();
  await generateNewsCard(targetNews, testCardPath);
  const cardDuration = Date.now() - cardStart;

  console.log(`⚡ Kart Üretme Süresi: ${cardDuration} ms`);
  console.log(`📁 Oluşturulan Kart Dosyaları:`);
  console.log(`   - PNG: ${testCardPath}`);
  console.log(`   - JPEG: ${testCardPath.replace(/\.png$/, '.jpg')}`);

  // Temizlik
  if (fs.existsSync(tempImgPath)) fs.unlinkSync(tempImgPath);
  cleanupImage(testCardPath);

  const totalDuration = Date.now() - startTime;
  console.log('\n===========================================================');
  console.log(`🎉 TÜM ENTEGRASYON TESTLERİ BAŞARIYLA TAMAMLANDI!`);
  console.log(`⏱️  Toplam İşlem Süresi: ${totalDuration} ms`);
  console.log('===========================================================');
}

runTest().catch(err => {
  console.error('❌ Test sırasında beklenmedik hata:', err.message);
  process.exit(1);
});
