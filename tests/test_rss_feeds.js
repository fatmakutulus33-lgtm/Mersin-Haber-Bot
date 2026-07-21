/**
 * Mersin haber sitelerinin RSS feed'lerini test et
 */
const Parser = require('rss-parser');
const parser = new Parser({
  customFields: { item: [['media:content', 'mediaContent'], ['enclosure', 'enclosure'], ['media:thumbnail', 'mediaThumbnail']] },
  timeout: 10000
});

const feeds = [
  ['AA Gundem', 'https://www.aa.com.tr/tr/rss/default?cat=gundem'],
  ['AA Yerel', 'https://www.aa.com.tr/tr/rss/default?cat=yerel'],
  ['Sabah', 'https://www.sabah.com.tr/rss/mersin.xml'],
  ['Hurriyet Mersin', 'https://www.hurriyet.com.tr/rss/mersin'],
  ['NTV', 'https://www.ntv.com.tr/gundem.rss'],
  ['Mersin Haber (gundemmersin)', 'https://www.gundemmersin.com/feed'],
  ['Mersin Gazetesi', 'https://www.mersingazetesi.com.tr/rss'],
  ['Mersin Son Haber', 'https://www.mersinsonhaber.com/feed'],
];

(async function() {
  for (const [label, url] of feeds) {
    try {
      const feed = await parser.parseURL(url);
      const item = feed.items[0];
      if (!item) { console.log('[' + label + '] ❌ Item yok'); continue; }
      
      const hasMedia = item.mediaContent || item.enclosure || item.mediaThumbnail;
      const hasMersin = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase().includes('mersin');
      console.log('[' + label + '] ✅ ' + feed.items.length + ' haber | Gorsel: ' + (hasMedia ? 'VAR' : 'YOK') + ' | Mersin filter gerekli: ' + !hasMersin);
      console.log('   Ornek URL: ' + item.link);
      if (item.mediaContent) console.log('   Media URL:', JSON.stringify(item.mediaContent).substring(0, 100));
    } catch(e) {
      console.log('[' + label + '] ❌ ' + e.message.substring(0, 60));
    }
  }
})();
