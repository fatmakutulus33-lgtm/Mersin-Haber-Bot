/**
 * Guncellenmis extractNewsImage modülünü test eder
 */
const { extractNewsImage } = require('./services/image_fetcher');

async function testUrl(label, url) {
  try {
    const img = await extractNewsImage(url);
    console.log('[' + label + '] ' + (img ? 'BASARI: ' + img : 'GORSEL YOK'));
  } catch(e) {
    console.log('[' + label + '] HATA: ' + e.message);
  }
}

(async function() {
  console.log('--- extractNewsImage Test Başlatıldı ---\n');
  await testUrl('AA Gundem RSS item', 'https://www.aa.com.tr/tr/gundem/aydinda-araba-kazasinda-1-kisi-hayatini-kaybetti/3517285');
  await testUrl('Sabah Mersin', 'https://www.sabah.com.tr/mersin');
  await testUrl('Mersin Gazetesi (Relative Path Test)', 'https://www.mersingazetesi.com.tr/');
  await testUrl('Mersin Haber (SSL Bypass Test)', 'https://www.mersinhaber.com/');
  await testUrl('Son Dakika Mersin', 'https://www.sondakika.com/yerel/mersin/');
})();
