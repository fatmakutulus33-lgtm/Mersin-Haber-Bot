/**
 * services/image_fetcher.js
 *
 * İki görev:
 * 1. extractNewsImage(url)  — Bir haber sayfasından og:image çeker (Google News dışı URL'ler için)
 * 2. downloadImage(url, destPath) — Görseli yerel diske indirir (CDN 403 sorununu bypass eder)
 *    İndirilen görsel Railway'in /output/ static sunucusundan Instagram'a serve edilir.
 */
const axios = require('axios');
const fs    = require('fs');
const path  = require('path');
const { URL } = require('url');

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': BROWSER_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr,tr-TR;q=0.9,en-US;q=0.8,en;q=0.7',
};

// ─── 1. Sayfa'dan og:image çekme (Google News dışı URL'ler) ──────────────────

function extractOgImage(html, baseUrl) {
  const patterns = [
    /<meta[^>]*property=['"]og:image:secure_url['"][^>]*content=['"]([^'"]+)['"]/i,
    /<meta[^>]*content=['"]([^'"]+)['"][^>]*property=['"]og:image:secure_url['"]/i,
    /<meta[^>]*property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/i,
    /<meta[^>]*content=['"]([^'"]+)['"][^>]*property=['"]og:image['"]/i,
    /<meta[^>]*name=['"]twitter:image:src['"][^>]*content=['"]([^'"]+)['"]/i,
    /<meta[^>]*content=['"]([^'"]+)['"][^>]*name=['"]twitter:image:src['"]/i,
    /<meta[^>]*name=['"]twitter:image['"][^>]*content=['"]([^'"]+)['"]/i,
    /<meta[^>]*content=['"]([^'"]+)['"][^>]*name=['"]twitter:image['"]/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let imageUrl = match[1].replace(/&amp;/g, '&').trim();
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (!imageUrl.startsWith('http') && baseUrl) {
        try {
          imageUrl = new URL(imageUrl, baseUrl).href;
        } catch (_) {}
      }
      if (imageUrl.startsWith('http')) {
        if (imageUrl.includes('googleusercontent.com') || imageUrl.includes('news.google.com')) continue;
        return imageUrl;
      }
    }
  }
  return null;
}

/**
 * Haber sayfasından og:image çeker.
 * Sadece Google News olmayan, gerçek haber URL'leri için kullanılır.
 * @param {string} newsUrl
 * @returns {Promise<string|null>}
 */
async function extractNewsImage(newsUrl) {
  if (!newsUrl || newsUrl.includes('news.google.com') || newsUrl.includes('googleusercontent.com') || newsUrl.includes('mersin.bel.tr')) return null;

  const https = require('https');
  const agent = new https.Agent({ 
    rejectUnauthorized: false,
    ciphers: 'DEFAULT@SECLEVEL=1'
  });

  const proxies = [
    newsUrl,
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(newsUrl),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(newsUrl),
    'https://corsproxy.io/?' + encodeURIComponent(newsUrl),
  ];

  for (let i = 0; i < proxies.length; i++) {
    const targetUrl = proxies[i];
    const isProxy = i > 0;
    try {
      if (isProxy) {
        console.log(`📡 Sayfa görseli proxy üzerinden aranıyor (Deneme ${i}/${proxies.length - 1}): ${newsUrl.substring(0, 50)}...`);
      } else {
        console.log('📡 Sayfa görseli aranıyor: ' + newsUrl.substring(0, 70) + '...');
      }

      const res = await axios.get(targetUrl, {
        timeout: isProxy ? 4000 : 3000,
        maxRedirects: 5,
        headers: HEADERS,
        httpsAgent: agent,
        validateStatus: s => s < 500,
      });

      if (res.status >= 400) continue;

      const html = typeof res.data === 'string' ? res.data : '';
      const finalBase = (res.request && res.request.res && res.request.res.responseUrl) || newsUrl;
      const imageUrl = extractOgImage(html, finalBase);

      if (imageUrl) {
        console.log('📸 Sayfa görseli bulundu: ' + imageUrl.substring(0, 80));
        return imageUrl;
      }
    } catch (err) {
      console.warn(`⚠️  Sayfa görseli çekilemedi (${isProxy ? 'proxy' : 'direkt'}): ` + err.message);
    }
  }
  
  console.log('⚠️  Sayfada kullanılabilir görsel bulunamadı. Puppeteer yedek akışı deneniyor...');
  const puppeteerImg = await extractNewsImageViaPuppeteer(newsUrl);
  if (puppeteerImg) return puppeteerImg;

  console.log('⚠️  Tüm yöntemler denendi, görsel bulunamadı.');
  return null;
}

/**
 * Headless tarayıcı (Puppeteer) kullanarak dinamik sayfalardan og:image çeker.
 */
async function extractNewsImageViaPuppeteer(newsUrl) {
  try {
    const puppeteer = require('puppeteer');
    console.log('🌐 [Puppeteer Yedek Akış] Sayfa headless tarayıcı ile yükleniyor...');
    const fs = require('fs');
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };
    if (fs.existsSync('/usr/bin/chromium-browser')) {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    } else if (fs.existsSync('/usr/bin/chromium')) {
      launchOptions.executablePath = '/usr/bin/chromium';
    } else if (fs.existsSync('/snap/bin/chromium')) {
      launchOptions.executablePath = '/snap/bin/chromium';
    }
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_UA);
    await page.goto(newsUrl, { waitUntil: 'load', timeout: 8000 });
    const ogImg = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:image"], meta[name="twitter:image"], meta[name="twitter:image:src"]');
      return meta ? meta.getAttribute('content') : null;
    });
    await browser.close();
    if (ogImg) {
      console.log('📸 [Puppeteer Yedek Akış] Görsel başarıyla bulundu: ' + ogImg.substring(0, 80));
      return ogImg;
    }
  } catch (err) {
    console.warn('⚠️  [Puppeteer Yedek Akış] Başarısız oldu:', err.message);
  }
  return null;
}

// ─── 2. Görseli diske indirme (CDN 403 bypass) ───────────────────────────────

/**
 * tmgrup (Sabah, Takvim vb.) resizer URL'lerini çözer.
 * iasbh.tmgrup.com.tr resizer'ı same-host Referer'a 403 döner; ama URL'nin
 * içindeki ?u=<orijinal> görseli referer'sız ve daha yüksek çözünürlükte iner.
 * Örn: https://iasbh.tmgrup.com.tr/.../...?u=https://isbh.tmgrup.com.tr/sbh/...jpg
 *   → https://isbh.tmgrup.com.tr/sbh/...jpg
 */
function unwrapResizerUrl(imageUrl) {
  try {
    const parsed = new URL(imageUrl);
    if (parsed.hostname.includes('tmgrup.com.tr')) {
      const u = parsed.searchParams.get('u');
      if (u && /^https?:\/\//.test(u)) return u;
    }
  } catch (_) {}
  return imageUrl;
}

/**
 * Bir görsel host'u için doğru Referer'ı döndürür.
 * Hotlink koruması genelde görselin kendi CDN host'unu değil, yayıncı sitesini ister.
 */
function refererForHost(host) {
  if (host.includes('tmgrup.com.tr')) return 'https://www.sabah.com.tr/';
  return ''; // diğer kaynaklar için referer gerekmez
}

/**
 * Görseli images.weserv.nl üzerinden indirir.
 * weserv görseli KENDİ sunucusundan (origin-side) çekip döner; bu yüzden:
 *   - Datacenter IP engelini aşar (Oracle VM'in ECONNRESET sorunu)
 *   - CDN 403 / hotlink korumasını aşar
 * Production'da birincil yöntem budur — VM origin'e doğrudan ulaşamaz.
 *
 * @param {string} imageUrl - İndirilecek görsel URL'si (http/https)
 * @param {string} destPath - Kaydedilecek yerel dosya yolu
 * @returns {Promise<boolean>}
 */
async function downloadViaWeserv(imageUrl, destPath) {
  try {
    const noScheme = imageUrl.replace(/^https?:\/\//, '');
    const weservUrl = 'https://images.weserv.nl/?url=' + encodeURIComponent(noScheme);
    console.log('⬇️  Görsel indiriliyor (weserv proxy): ' + imageUrl.substring(0, 70));
    const res = await axios.get(weservUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
      headers: { 'User-Agent': BROWSER_UA },
      validateStatus: s => s < 400,
    });
    const contentType = res.headers['content-type'] || '';
    if (!contentType.startsWith('image/') || res.data.byteLength < 100) return false;

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, Buffer.from(res.data));
    const sizeKb = Math.round(res.data.byteLength / 1024);
    console.log('✅ Görsel indirildi (' + sizeKb + ' KB - weserv): ' + path.basename(destPath));
    return true;
  } catch (err) {
    console.warn('⚠️  weserv indirme başarısız: ' + (err.message || '').substring(0, 60));
    return false;
  }
}

/**
 * Verilen URL'deki görseli destPath'e indirir.
 * Sabah CDN gibi dışarıya 403 dönen kaynaklarda Referer header'ı kullanır.
 *
 * @param {string} imageUrl   - İndirilecek görsel URL'si
 * @param {string} destPath   - Kaydedilecek yerel dosya yolu (.png / .jpg)
 * @returns {Promise<boolean>} - Başarılıysa true
 */
async function downloadImage(imageUrl, destPath) {
  if (!imageUrl) return false;

  // tmgrup resizer URL'lerini orijinal (yüksek kaliteli, referer'sız inebilen) görsele çevir
  imageUrl = unwrapResizerUrl(imageUrl);

  // BİRİNCİL YÖNTEM: weserv proxy (origin-side fetch) — VM IP engelini + CDN 403'ü aşar.
  // Production'da direkt bağlantı hep ECONNRESET olduğu için önce bunu dene.
  if (await downloadViaWeserv(imageUrl, destPath)) return true;

  // Doğru Referer'ı seç — yayıncı sitesi (CDN host'u değil), 403'ü bypass eder
  let referer = '';
  try {
    const parsed = new URL(imageUrl);
    referer = refererForHost(parsed.hostname) || (parsed.protocol + '//' + parsed.host + '/');
  } catch (_) {}

  const attempts = [
    // 1. Deneme: Browser UA + Referer
    { 'User-Agent': BROWSER_UA, 'Referer': referer, 'Accept': 'image/webp,image/*,*/*;q=0.8' },
    // 2. Deneme: Googlebot UA (bazı siteler bunu geçirir)
    { 'User-Agent': 'Googlebot-Image/1.0', 'Accept': 'image/*' },
    // 3. Deneme: Sade istek
    { 'User-Agent': 'curl/7.88.1', 'Accept': '*/*' },
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      console.log('⬇️  Görsel indiriliyor (deneme ' + (i + 1) + '/3): ' + imageUrl.substring(0, 70));
      const res = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 12000,
        maxRedirects: 5,
        headers: attempts[i],
        validateStatus: s => s < 400,
      });

      const contentType = res.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        console.warn('⚠️  Beklenen görsel değil: ' + contentType);
        continue;
      }

      // Dosyayı kaydet
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, Buffer.from(res.data));
      const sizeKb = Math.round(res.data.byteLength / 1024);
      console.log('✅ Görsel indirildi (' + sizeKb + ' KB): ' + path.basename(destPath));
      return true;
    } catch (err) {
      const status = err.response ? err.response.status : err.code;
      console.warn('⚠️  İndirme denemesi ' + (i + 1) + ' başarısız (' + status + '): ' + err.message.substring(0, 60));
    }
  }

  // 4. Fallback: Native curl (Bypasses Node.js TLS signature blocking)
  try {
    console.log('⬇️  Görsel indiriliyor (deneme 4/4 - curl yedek akışı): ' + imageUrl.substring(0, 70));
    const { execSync } = require('child_process');
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    execSync(`curl -k -L -s --ciphers DEFAULT@SECLEVEL=1 -o "${destPath}" "${imageUrl}" -H "User-Agent: ${BROWSER_UA}" -H "Referer: ${referer}"`, { timeout: 15000 });
    
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100) {
      const sizeKb = Math.round(fs.statSync(destPath).size / 1024);
      console.log('✅ Görsel indirildi (' + sizeKb + ' KB - curl ile): ' + path.basename(destPath));
      return true;
    }
  } catch (curlErr) {
    console.warn('⚠️  curl indirme yedek akışı başarısız: ' + curlErr.message.substring(0, 60));
  }

  // 5. Fallback: CORS proxies (Bypasses Oracle VM datacenter IP blocks)
  const proxyUrls = [
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(imageUrl),
    'https://corsproxy.io/?' + encodeURIComponent(imageUrl),
  ];

  for (let i = 0; i < proxyUrls.length; i++) {
    try {
      console.log(`⬇️  Görsel indiriliyor (deneme ${5 + i}/6 - proxy): ` + imageUrl.substring(0, 50));
      const res = await axios.get(proxyUrls[i], {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 5,
        headers: { 'User-Agent': BROWSER_UA },
        validateStatus: s => s < 400,
      });

      if (res.data && res.data.byteLength > 100) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, Buffer.from(res.data));
        const sizeKb = Math.round(res.data.byteLength / 1024);
        console.log(`✅ Görsel indirildi (${sizeKb} KB - proxy ile): ` + path.basename(destPath));
        return true;
      }
    } catch (err) {
      console.warn(`⚠️  Proxy indirme denemesi ${i + 1} başarısız: ` + err.message.substring(0, 60));
    }
  }

  console.warn('❌ Görsel indirilemedi, varsayılan arka plan kullanılacak.');
  return false;
}

module.exports = { extractNewsImage, downloadImage };
