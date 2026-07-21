/**
 * Guncellenmis news_fetcher + image testi
 */
const { fetchMersinNews } = require('./services/news_fetcher');

(async function() {
  const news = await fetchMersinNews();
  console.log('\nToplam haber: ' + news.length);
  
  const withImg = news.filter(function(n) { return n.imageUrl; });
  const withoutImg = news.filter(function(n) { return !n.imageUrl; });
  
  console.log('Gorsel olan: ' + withImg.length);
  console.log('Gorsel yok:  ' + withoutImg.length);
  
  console.log('\n--- Gorsel olan ilk 5 haber ---');
  withImg.slice(0, 5).forEach(function(n, i) {
    console.log((i+1) + '. ' + n.title.substring(0, 55));
    console.log('   Gorsel: ' + n.imageUrl.substring(0, 80));
    console.log('   Kaynak: ' + n.source);
  });
})().catch(console.error);
