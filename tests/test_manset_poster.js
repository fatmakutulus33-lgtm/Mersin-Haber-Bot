/**
 * test_manset_poster.js
 * Mersin Manşet portal API'sine test amaçlı haber gönderir.
 * Kullanım: node test_manset_poster.js
 */
require('dotenv').config();
const { postToMersinManset } = require('./services/manset_poster');

console.log('🧪 MERSIN MANŞET ENTEGRASYON TESTİ BAŞLATILIYOR\n');
console.log(`API URL: ${process.env.MERSIN_MANSET_API_URL || 'Varsayılan (https://mersinmanset.tr)'}`);

const mockNews = {
  title: "Mersin'de Akdeniz Oyunları Hazırlıkları Başladı (Bot Test)",
  snippet: "Mersin'de düzenlenecek uluslararası gençlik spor müsabakaları öncesi tesis hazırlıkları tüm hızıyla sürüyor. Vali ve belediye başkanları çalışmaları yerinde inceledi.",
  source: "Haber Botu Test Kaynağı",
  link: "https://www.sabah.com.tr/mersin/test-haber-linki-12345",
  pubDate: new Date().toISOString(),
  date: new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  webImageUrl: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80"
};

// resolvePublicUrl mock'u olarak bir test resmi URL'i geçiriyoruz
const mockCardUrl = "https://catbox.moe/pictures/test_news_card.png";

postToMersinManset(mockNews, mockCardUrl)
  .then(success => {
    if (success) {
      console.log('\n🎉 Test Başarılı! Haber web portalına başarıyla yüklendi.');
      process.exit(0);
    } else {
      console.error('\n❌ Test Başarısız: API sunucusundan olumsuz yanıt döndü.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n❌ Test Hatası:', err.message);
    process.exit(1);
  });
