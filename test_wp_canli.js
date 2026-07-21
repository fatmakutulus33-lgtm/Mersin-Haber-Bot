/**
 * WordPress canlı entegrasyon testi
 * Kullanım: node test_wp_canli.js
 */
require('dotenv').config();
const axios = require('axios');

const siteUrl = (process.env.WORDPRESS_SITE_URL || 'https://www.mersinmanset.tr').replace(/\/$/, '');
const username = process.env.WORDPRESS_USERNAME;
const appPassword = process.env.WORDPRESS_APP_PASSWORD;

if (!username || !appPassword) {
  console.error('❌ WORDPRESS_USERNAME veya WORDPRESS_APP_PASSWORD .env dosyasında tanımlı değil!');
  process.exit(1);
}

const token = Buffer.from(`${username}:${appPassword}`).toString('base64');

async function testWordPress() {
  console.log(`🧪 WordPress Canlı Entegrasyon Testi`);
  console.log(`   Site    : ${siteUrl}`);
  console.log(`   Kullanıcı: ${username}`);
  console.log('');

  // 1. Bağlantı testi
  try {
    const ping = await axios.get(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
      headers: { 'User-Agent': 'MersinHaberBot/1.0' },
      timeout: 10000
    });
    console.log(`✅ WordPress API erişilebilir (HTTP ${ping.status})`);
  } catch (err) {
    console.error(`❌ WordPress API erişilemiyor: ${err.message}`);
    process.exit(1);
  }

  // 2. Kimlik doğrulama testi
  try {
    const me = await axios.get(`${siteUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${token}`,
        'User-Agent': 'MersinHaberBot/1.0'
      },
      timeout: 10000
    });
    console.log(`✅ Kimlik doğrulama başarılı — Kullanıcı: ${me.data.name} (Rol: ${me.data.roles?.join(', ')})`);
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    const errCode = err.response?.data?.code || '';
    console.error(`❌ Kimlik doğrulama başarısız: ${errMsg} (kod: ${errCode})`);
    if (err.response?.status === 401) {
      console.error(`   → Uygulama Şifresi (Application Password) doğru mu?`);
      console.error(`   → WordPress Admin → Kullanıcılar → Profiliniz → Uygulama Şifreleri`);
    }
    process.exit(1);
  }

  // 3. Test yazısı gönder (taslak - yayınlanmaz)
  let testPostId = null;
  try {
    const payload = {
      title: '[TEST] Mersin Haber Bot Entegrasyon Testi',
      content: '<p>Bu bir test yazısıdır. Otomatik olarak silinecektir.</p><p>Mersin Haber Bot WordPress entegrasyon doğrulaması.</p>',
      status: 'draft',
      excerpt: 'Test yazısı - otomatik silinecek'
    };

    const resp = await axios.post(`${siteUrl}/wp-json/wp/v2/posts`, payload, {
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MersinHaberBot/1.0'
      },
      timeout: 20000
    });

    testPostId = resp.data.id;
    const postLink = resp.data.link;
    console.log(`✅ Test yazısı oluşturuldu!`);
    console.log(`   Post ID : ${testPostId}`);
    console.log(`   Link    : ${postLink}`);
    console.log(`   Status  : ${resp.data.status} (taslak — yayınlanmadı)`);
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    const errCode = err.response?.data?.code || '';
    console.error(`❌ WordPress yazı gönderimi başarısız: ${errMsg}`);
    if (errCode) console.error(`   Hata kodu: ${errCode}`);
    if (err.response?.data) {
      console.error(`   Detay:`, JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }

  // 4. Test yazısını sil
  if (testPostId) {
    try {
      await axios.delete(`${siteUrl}/wp-json/wp/v2/posts/${testPostId}?force=true`, {
        headers: {
          Authorization: `Basic ${token}`,
          'User-Agent': 'MersinHaberBot/1.0'
        },
        timeout: 10000
      });
      console.log(`🗑️  Test yazısı kalıcı olarak silindi (ID: ${testPostId})`);
    } catch (err) {
      console.warn(`⚠️ Test yazısı silinemedi (elle silin - ID: ${testPostId}): ${err.message}`);
    }
  }

  console.log('');
  console.log('🎉 TÜM TESTLER BAŞARILI — WordPress entegrasyonu tam çalışıyor!');
}

testWordPress().catch(err => {
  console.error('❌ Beklenmedik hata:', err.message);
  process.exit(1);
});
