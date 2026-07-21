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
  timeout: 5000, // fast timeout!
  requestOptions: {
    rejectUnauthorized: false,
    agent: new https.Agent({
      rejectUnauthorized: false,
      ciphers: 'DEFAULT@SECLEVEL=1'
    })
  }
});

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

function removeSourceFromTitle(title) {
  if (!title) return '';
  return title.trim().replace(/\s+[-\|]\s+[^-|]+$/, '').replace(/\s+[-\|]\s+[^-|]+$/, '');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function extractImageFromItem(item, feedUrl) {
  if (feedUrl.includes('news.google.com')) return null;
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) return item.mediaContent.$.url;
  if (item.enclosure && (item.enclosure.url || item.enclosure.link)) {
    const url = item.enclosure.url || item.enclosure.link;
    if (url.startsWith('http')) return url;
  }
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) return item.mediaThumbnail.$.url;
  return null;
}

function extractImageFromContent(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=['"]([^'"]+)['"]/i);
  return match ? match[1] : null;
}

async function fetchMersinNews() {
  const allNews = [];

  for (const feed of ALL_RSS_FEEDS) {
    try {
      console.log(`📡 RSS çekiliyor: [${feed.label}]`);
      let parsed;
      try {
        parsed = await parser.parseURL(feed.url);
      } catch (parserErr) {
        console.warn(`⚠️  rss-parser hatası (${feed.label}): ${parserErr.message}, atlanıyor.`);
        continue;
      }

      // Google News paralel çözücü: Hız için maksimum son 10 haber çözülecek!
      const itemsToDecode = (parsed.items || []).slice(0, 10).filter(item => {
        const link = item.link || item.guid || '';
        return link.includes('news.google.com');
      });

      if (itemsToDecode.length > 0) {
        console.log(`🌐 Google News paralel çözücü aktif: Son ${itemsToDecode.length} haber çözülüyor...`);
        const decodePromises = itemsToDecode.map(async (item) => {
          let link = item.link || item.guid || '';
          try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
            const decodeResult = await Promise.race([decoder.decodeGoogleNewsUrl(link), timeout]);
            const decoded = decodeResult && decodeResult.decodedUrl;
            if (decoded && typeof decoded === 'string' && decoded.startsWith('http')) {
              item.decodedLink = decoded;
            } else if (decoded && typeof decoded === 'object' && decoded.url) {
              item.decodedLink = decoded.url;
            }
          } catch (_) {}
        });
        await Promise.all(decodePromises);
      }

      const itemsToProcess = feed.url.includes('news.google.com') ? parsed.items.slice(0, 10) : parsed.items;

      for (const item of itemsToProcess || []) {
        const title   = removeSourceFromTitle(cleanText(item.title));
        const snippet = cleanText(item.contentSnippet || item.content || '');
        const rawSource = item.creator || item['dc:creator'] || parsed.title || '';
        const source  = cleanText(rawSource.length > 60 ? feed.label : (rawSource || feed.label));
        const link    = item.decodedLink || item.link || item.guid || '';
        const pubDate = item.pubDate || item.isoDate || '';

        const newsItem = { title, snippet, source, link, pubDate };
        if (feed.needsMersinFilter && !isMersinRelated(newsItem)) continue;
        if (title.length < 15) continue;

        let imageUrl = extractImageFromItem(item, feed.url) || extractImageFromContent(item.contentSnippet || item.contentSnippet || '') || null;
        if (imageUrl && (imageUrl.includes('googleusercontent.com') || imageUrl.includes('news.google.com'))) imageUrl = null;

        if (imageUrl) {
          imageUrl = imageUrl.trim();
          if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        }

        allNews.push({
          title,
          snippet: snippet.substring(0, 200),
          source,
          link,
          pubDate,
          date: formatDate(pubDate),
          imageUrl,
          id: crypto.createHash('md5').update(link || title).digest('hex'),
        });
      }
    } catch (err) {
      console.warn(`⚠️  RSS hatası (${feed.label}): ${err.message}`);
    }
  }

  // Tekrar edenleri kaldır
  const seen = new Set();
  const unique = allNews.filter(n => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  // Tarihe göre sırala
  unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  console.log(`✅ Toplam ${unique.length} Mersin haberi bulundu.`);
  return unique;
}

module.exports = { fetchMersinNews };
