/**
 * test_new_logic.js
 * Test the new imageless news skip logic in pipeline.js
 */
require('dotenv').config();
const { runPipeline } = require('./pipeline');

// Set env vars for testing
process.env.DISABLE_TELEGRAM = 'true'; // Bypass Telegram approval block

async function runTests() {
  console.log('🧪 TEST 1: News item WITH image url (should try downloading)');
  const newsWithImage = {
    id: 'test_id_with_image_' + Date.now(),
    title: 'Görselli Test Haberi',
    snippet: 'Bu haberin görseli bulunmaktadır.',
    link: 'https://www.sabah.com.tr/mersin/2026/06/11/gorselli-test-haberi',
    imageUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=500&q=80',
    date: '13.06.2026'
  };

  try {
    await runPipeline(newsWithImage);
    console.log('✅ TEST 1 passed (if approval is skipped and Instagram call is printed or rejected).');
  } catch (err) {
    console.log('❌ TEST 1 failed:', err.message);
  }

  console.log('\n🧪 TEST 2: News item WITHOUT image url (should skip immediately)');
  const newsWithoutImage = {
    id: 'test_id_no_image_' + Date.now(),
    title: 'Görselsiz Test Haberi',
    snippet: 'Bu haberin görseli bulunmamaktadır.',
    link: 'https://www.sabah.com.tr/mersin/2026/06/11/gorselsiz-test-haberi',
    imageUrl: null,
    date: '13.06.2026'
  };

  try {
    await runPipeline(newsWithoutImage);
    console.log('✅ TEST 2 passed (returned early cleanly!).');
  } catch (err) {
    console.log('❌ TEST 2 failed:', err.message);
  }

  console.log('\n🧪 TEST 3: News item with INVALID image url (should fail download and skip)');
  const newsWithInvalidImage = {
    id: 'test_id_invalid_image_' + Date.now(),
    title: 'Geçersiz Görselli Test Haberi',
    snippet: 'Bu haberin görsel linki bozuktur.',
    link: 'https://www.sabah.com.tr/mersin/2026/06/11/gecersiz-gorselli-test-haberi',
    imageUrl: 'https://invalid-domain-12345.com/non_existent_image.jpg',
    date: '13.06.2026'
  };

  try {
    await runPipeline(newsWithInvalidImage);
    console.log('✅ TEST 3 passed (returned early cleanly!).');
  } catch (err) {
    console.log('❌ TEST 3 failed:', err.message);
  }
}

runTests().then(() => {
  console.log('\n🎉 Bütün testler bitti.');
  process.exit(0);
}).catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});
