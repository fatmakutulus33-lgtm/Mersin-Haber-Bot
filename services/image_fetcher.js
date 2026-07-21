const axios = require('axios');
const fs = require('fs');

/**
 * Haber detay sayfasından hızlıca og:image görsel URL'sini çeker (Tarayıcı açmadan - Milisaniyeler içinde!)
 */
async function extractNewsImage(newsUrl) {
  if (!newsUrl) return null;
  try {
    const response = await axios.get(newsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 5000
    });
    
    const html = response.data;
    if (typeof html !== 'string') return null;

    // 1. og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch && ogMatch[1]) return decodeHtmlEntities(ogMatch[1].trim());

    // 2. twitter:image
    const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twitterMatch && twitterMatch[1]) return decodeHtmlEntities(twitterMatch[1].trim());

    // 3. itemprop="image"
    const itempropMatch = html.match(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i);
    if (itempropMatch && itempropMatch[1]) return decodeHtmlEntities(itempropMatch[1].trim());

    return null;
  } catch (err) {
    console.warn(`⚠️ Orijinal görsel kazınamadı (${newsUrl}):`, err.message);
    return null;
  }
}

/**
 * Görseli sunucuya indirir (hızlı ve hata toleranslı)
 */
async function downloadImage(url, destPath) {
  try {
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=80`;
    console.log(`⬇️  Görsel indiriliyor (weserv proxy): ${proxyUrl.substring(0, 80)}...`);
    
    const response = await axios({
      method: 'GET',
      url: proxyUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'MersinBot/1.0'
      },
      timeout: 10000
    });

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);
      
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      
      writer.on('close', () => {
        if (!error) resolve(true);
      });
    });
  } catch (err) {
    console.warn(`⚠️ Weserv proxy indirimi başarısız, doğrudan indiriliyor: ${url.substring(0, 80)}...`);
    try {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
      });
      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(destPath);
        response.data.pipe(writer);
        let error = null;
        writer.on('error', err => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on('close', () => {
          if (!error) resolve(true);
        });
      });
    } catch (directErr) {
      throw new Error(`Görsel indirme başarısız: ${directErr.message}`);
    }
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

module.exports = { extractNewsImage, downloadImage };
