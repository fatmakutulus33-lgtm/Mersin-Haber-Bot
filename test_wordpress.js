/**
 * test_wordpress.js
 * WordPress yayın servisinin tolerans ve mock testlerini gerçekleştirir.
 */
require('dotenv').config();
const { postToWordPress } = require('./services/wordpress_poster');
const assert = require('assert');

async function testMissingCredentials() {
  console.log('🧪 Test 1: Kimlik Bilgileri Eksik Olduğunda Tolerans Testi...');

  const origSiteUrl = process.env.WORDPRESS_SITE_URL;
  const origUsername = process.env.WORDPRESS_USERNAME;
  const origAppPassword = process.env.WORDPRESS_APP_PASSWORD;

  delete process.env.WORDPRESS_SITE_URL;
  delete process.env.WORDPRESS_USERNAME;
  delete process.env.WORDPRESS_APP_PASSWORD;

  const mockNews = {
    title: 'Test Haber Başlığı',
    snippet: 'Test haber özeti snippet.',
    source: 'Test Kaynak',
    link: 'https://example.com/test'
  };

  const result = await postToWordPress('dummy_path.png', mockNews);

  process.env.WORDPRESS_SITE_URL = origSiteUrl;
  process.env.WORDPRESS_USERNAME = origUsername;
  process.env.WORDPRESS_APP_PASSWORD = origAppPassword;

  assert.strictEqual(result, null, 'Kimlik bilgileri eksik olmasına rağmen postToWordPress null dönmedi!');
  console.log('✅ Test 1 Başarılı: Kimlik bilgileri eksikse WordPress paylaşımı sessizce atlanıyor.\n');
}

async function testMockPosting() {
  console.log('🧪 Test 2: Mock API Paylaşım Testi...');

  const mockNews = {
    title: 'Mersin\'de Yeni Gelişme',
    snippet: 'Mersin merkezde sıcak saatler yaşandı...',
    source: 'Sabah Mersin',
    link: 'https://sabah.com.tr/mersin-haber'
  };

  process.env.WORDPRESS_USERNAME = 'mock_user';
  process.env.WORDPRESS_APP_PASSWORD = 'mock_app_password';
  process.env.WORDPRESS_SITE_URL = 'https://example.com';

  const result = await postToWordPress('dummy_path.png', mockNews);

  assert.strictEqual(result, null, 'Geçersiz token ile API null dönmedi!');
  console.log('✅ Test 2 Başarılı: Hatalı credentials durumunda API graceful davranıyor.\n');
}

async function runTests() {
  try {
    await testMissingCredentials();
    await testMockPosting();
    console.log('🎉 TÜM WORDPRESS ENTEGRASYON TESTLERİ BAŞARIYLA TAMAMLANDI!');
  } catch (err) {
    console.error('❌ Test hatası:', err.message);
    process.exit(1);
  }
}

runTests();
