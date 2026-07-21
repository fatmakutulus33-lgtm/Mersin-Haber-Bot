/**
 * Geçici script: GitHub Pages'i gh-pages branch'inden etkinleştirir.
 */
const https = require('https');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO  = process.env.GITHUB_REPOSITORY || 'fatmakutulus33-lgtm/Mersin-Haber-Bot';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req  = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MersinBot',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('GitHub Pages durumu kontrol ediliyor...');
  const check = await apiRequest('GET', `/repos/${REPO}/pages`, null);

  if (check.status === 404) {
    console.log('Pages aktif değil — etkinleştiriliyor...');
    const res = await apiRequest('POST', `/repos/${REPO}/pages`, {
      source: { branch: 'gh-pages', path: '/' }
    });
    console.log(`Sonuç: ${res.status}`, JSON.stringify(res.body, null, 2));
  } else if (check.status === 200) {
    console.log('Pages zaten aktif!');
    console.log(`  Branch : ${check.body.source?.branch}`);
    console.log(`  URL    : ${check.body.html_url}`);
    // Branch gh-pages değilse güncelle
    if (check.body.source?.branch !== 'gh-pages') {
      const upd = await apiRequest('PUT', `/repos/${REPO}/pages`, {
        source: { branch: 'gh-pages', path: '/' }
      });
      console.log('Branch güncellendi:', upd.status);
    }
  } else {
    console.log('Bilinmeyen durum:', check.status, check.body);
  }
})();
