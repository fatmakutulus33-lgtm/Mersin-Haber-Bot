/**
 * Sabah CDN gorsel URL'lerinin Instagram tarafindan erisebilir olup olmadigini test eder
 */
const axios = require('axios');

const testUrl = 'https://iasbh.tmgrup.com.tr/644137/366/218/91/0/1206/664?u=https://isbh.tmgrup.com.tr/sbh/2025/05/28/mersinde-kaza-otomobil-ile-carpisan-atv-surucusu-yaralandi-1748420000-1.jpg';

(async function() {
  try {
    const res = await axios.head(testUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1'
      }
    });
    console.log('HTTP Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Content-Length:', res.headers['content-length']);
    console.log('URL erisilebilir: EVET');
  } catch(e) {
    console.log('HATA:', e.message);
    if (e.response) {
      console.log('HTTP Status:', e.response.status);
    }
  }
})();
