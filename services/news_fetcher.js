/**
 * services/news_fetcher.js
 * Google News RSS + direkt Türk haber sitelerinden Mersin haberleri çeker.
 * Öncelikli kaynaklar: Sabah Mersin, AA Gündem (görsel içeren feed'ler)
 */
const Parser = require('rss-parser');
const crypto = require('crypto');
const GoogleNewsDecoder = require('google-news-decoder');
const decoder = new GoogleNewsDecoder();

const https = require('https');
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
    ],
  },
  timeout: 10000,
  requestOptions: {
    rejectUnauthorized: false,
    agent: new https.Agent({
      rejectUnauthorized: false,
      ciphers: 'DEFAULT@SECLEVEL=1'
    })
  }
});

const fs = require('fs');
const path = require('path');

const ALL_RSS_FEEDS = [
  {
    url: 'https://www.sabah.com.tr/rss/mersin.xml',
    label: 'Sabah Mersin',
    needsMersinFilter: false,
  },
  {
    url: 'https://www.ntv.com.tr/gundem.rss',
    label: 'NTV',
    needsMersinFilter: true,
  },
  {
    url: 'https://news.google.com/rss/search?q=mersin&hl=tr&gl=TR&ceid=TR:tr',
    label: 'Google News Mersin',
    needsMersinFilter: false,
  },
  {
    url: 'https://www.aa.com.tr/tr/rss/default?cat=gundem',
    label: 'AA Gündem',
    needsMersinFilter: true,
  }
];

function getActiveFeeds() {
  try {
    const settingsPath = path.join(__dirname, '../settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const active = settings.activeSources || [];
      return ALL_RSS_FEEDS.filter(f => active.includes(f.label));
    }
  } catch (err) {
    console.warn('⚠️  settings.json okunamadı, varsayılan tüm kaynaklar kullanılacak:', err.message);
  }
  return ALL_RSS_FEEDS;
}

// ──────────────────────────────────────────────────────────────────────────

function isMersinRelated(item) {
  const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();
  const keywords = ['mersin', 'tarsus', 'mezitli', 'yenişehir', 'silifke', 'erdemli', 'mut', 'anamur', 'pozcu', 'toroslar'];
  return keywords.some(k => text.includes(k));
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Haber başlığının sonundaki kaynak veya ajans ifadelerini (Örn: - DHA, | Haber7) temizler.
 */
function removeSourceFromTitle(title) {
  if (!title) return '';
  let cleaned = title.trim();
  
  // Sonundaki " - Kaynak" veya " | Kaynak" kalıplarını temizle
  cleaned = cleaned.replace(/\s+[-\|]\s+[^-|]+$/, '');
  cleaned = cleaned.replace(/\s+[-\|]\s+[^-|]+$/, ''); // İki katmanlı kaynaklar için tekrar et (Örn: - DHA | Demirören)
  
  return cleaned.trim();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * RSS item'ından görsel URL'sini çıkarır.
 * Önce media:content, sonra enclosure, sonra media:thumbnail dener.
 * Google News URL'lerinde görsel yoktur — null döner.
 */
function extractImageFromItem(item, feedUrl) {
  // Google News feed'i — görsel yok
  if (feedUrl.includes('news.google.com')) return null;

  // media:content (Sabah, NTV vb.)
  if (item.mediaContent) {
    const url = item.mediaContent.$ && item.mediaContent.$.url;
    if (url && url.startsWith('http')) return url;
  }

  // enclosure (podcast/standart RSS / rss2json)
  if (item.enclosure) {
    const url = item.enclosure.url || item.enclosure.link;
    const type = item.enclosure.type || '';
    if (url && url.startsWith('http') && (!type || type.startsWith('image'))) {
      return url;
    }
  }

  // media:thumbnail
  if (item.mediaThumbnail) {
    const url = item.mediaThumbnail.$ && item.mediaThumbnail.$.url;
    if (url && url.startsWith('http')) return url;
  }

  return null;
}

/**
 * RSS açıklaması veya içeriği (HTML) içerisinden ilk <img> etiketinin src adresini çıkarır.
 */
function extractImageFromContent(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=['"]([^'"]+)['"]/i);
  return match ? match[1] : null;
}

/**
 * Tüm RSS kaynaklarından Mersin haberlerini çeker.
 * @returns {Array} Normalleştirilmiş haber listesi (imageUrl dahil)
 */
async function fetchMersinNews() {
  const allNews = [];

  for (const feed of getActiveFeeds()) {
    try {
      console.log(`📡 RSS çekiliyor: [${feed.label}]`);
      let parsed;
      try {
        parsed = await parser.parseURL(feed.url);
      } catch (parserErr) {
        console.warn(`⚠️  rss-parser hatası (${feed.label}): ${parserErr.message}. curl yedek akışı deneniyor...`);
        try {
          const { execSync } = require('child_process');
          const xml = execSync(`curl -k -L -s --ciphers DEFAULT@SECLEVEL=1 "${feed.url}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"`, { encoding: 'utf8', timeout: 15000 });
          parsed = await parser.parseString(xml);
        } catch (curlErr) {
          console.warn(`⚠️  curl yedek akışı da başarısız (${feed.label}): ${curlErr.message}. rss2json API üzerinden deneniyor...`);
          const axios = require('axios');
          const apiRes = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { timeout: 15000 });
          if (apiRes.data && apiRes.data.status === 'ok') {
            parsed = {
              title: apiRes.data.feed.title || feed.label,
              items: apiRes.data.items.map(item => ({
                title: item.title,
                contentSnippet: item.description,
                content: item.content,
                link: item.link,
                pubDate: item.pubDate,
                enclosure: item.enclosure,
                mediaContent: item.thumbnail ? { $: { url: item.thumbnail } } : null
              }))
            };
            console.log(`✅ [${feed.label}] haberi rss2json API üzerinden başarıyla çekildi.`);
          } else {
            throw new Error('rss2json API başarısız veya boş yanıt döndürdü.');
          }
        }
      }

      // Google News bağlantılarını paralel olarak çöz
      const itemsToDecode = (parsed.items || []).filter(item => {
        const link = item.link || item.guid || '';
        return link.includes('news.google.com');
      });

      if (itemsToDecode.length > 0) {
        console.log(`🌐 Google News paralel çözücü aktif: ${itemsToDecode.length} adet bağlantı paralel çözülüyor...`);
        const decodePromises = itemsToDecode.map(async (item) => {
          let link = item.link || item.guid || '';
          try {
            const timeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 4000)
            );
            const decodeResult = await Promise.race([
              decoder.decodeGoogleNewsUrl(link),
              timeout
            ]);
            const decoded = decodeResult && decodeResult.decodedUrl;
            if (decoded && typeof decoded === 'string' && decoded.startsWith('http')) {
              item.decodedLink = decoded;
            } else if (decoded && typeof decoded === 'object' && decoded.url && typeof decoded.url === 'string') {
              item.decodedLink = decoded.url;
            }
          } catch (err) {
            // Sessizce atla
          }
        });
        await Promise.all(decodePromises);
      }

      for (const item of parsed.items || []) {
        const title   = removeSourceFromTitle(cleanText(item.title));
        const snippet = cleanText(item.contentSnippet || item.content || '');
        // Google News feed'lerde parsed.title ham query string içerebilir → label kullan
        const rawSource = item.creator || item['dc:creator'] || parsed.title || '';
        const source  = cleanText(feed.label && rawSource.length > 60 ? feed.label : (rawSource || feed.label || ''));
        const link    = item.decodedLink || item.link || item.guid || '';

        const pubDate = item.pubDate || item.isoDate || '';

        // Mersin filtresi
        const newsItem = { title, snippet, source, link, pubDate };
        // needsMersinFilter: true  → genel feed, sadece Mersin ile ilgilileri al
        // needsMersinFilter: false → zaten Mersin feed'i, hepsini al
        if (feed.needsMersinFilter && !isMersinRelated(newsItem)) continue;

        if (title.length < 15) continue;

        // RSS'ten gelen görsel (varsa) veya gömülü açıklama resimlerini ara
        let imageUrl = extractImageFromItem(item, feed.url) || null;
        if (!imageUrl) {
          imageUrl = extractImageFromContent(item.contentSnippet || item.content || '') || null;
        }

        // Google News logosunu filtrele (bu linkler haber resmi değil, Google logosudur)
        if (imageUrl && (imageUrl.includes('googleusercontent.com') || imageUrl.includes('news.google.com'))) {
          imageUrl = null;
        }


        // Göreli görsel yolunu absolute URL'e çevir
        if (imageUrl) {
          imageUrl = imageUrl.trim();
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (!imageUrl.startsWith('http') && link) {
            try {
              imageUrl = new URL(imageUrl, link).href;
            } catch (_) {}
          }
        }

        allNews.push({
          title,
          snippet: snippet.substring(0, 200),
          source,
          link,
          pubDate,
          date: formatDate(pubDate),
          imageUrl,   // Doğrudan veya dolaylı gelen görsel
          id: crypto.createHash('md5').update(link || title).digest('hex'),
        });
      }
    } catch (err) {
      console.warn(`⚠️  RSS hatası (${feed.label}): ${err.message}`);
    }
  }

  // Tekrar eden linkleri kaldır
  const seen = new Set();
  const unique = allNews.filter(n => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  // Tarihe göre sırala — en yeni önce
  unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Artık görselsiz haberleri de elenmeden kabul ediyoruz; resim yoksa pipeline'da habere uygun bir resim tasarlayacağız.
  console.log(`✅ Toplam ${unique.length} Mersin haberi bulundu (resimli: ${unique.filter(n => n.imageUrl).length}).`);
  return unique;
}

module.exports = { fetchMersinNews };
