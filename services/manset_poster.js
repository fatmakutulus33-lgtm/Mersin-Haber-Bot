const axios = require('axios');

function mapCategoryToManset(botCategory) {
  const mapping = {
    'sports': 'Spor',
    'accident': 'Yerel',
    'city': 'Siyaset',
    'culture': 'Yaşam',
    'finance': 'Ekonomi',
    'agriculture': 'Yerel',
    'general': 'Güncel'
  };
  return mapping[botCategory] || 'Güncel';
}

function getThemeCategory(title) {
  const lowerTitle = (title || '').toLowerCase();
  if (lowerTitle.includes('spor') || lowerTitle.includes('futbol') || lowerTitle.includes('maç') || lowerTitle.includes('yendi') || lowerTitle.includes('galibiyet')) {
    return 'sports';
  }
  if (lowerTitle.includes('kaza') || lowerTitle.includes('cinayet') || lowerTitle.includes('öldü') || lowerTitle.includes('yaralandı') || lowerTitle.includes('yangın') || lowerTitle.includes('operasyon')) {
    return 'accident';
  }
  if (lowerTitle.includes('belediye') || lowerTitle.includes('başkan') || lowerTitle.includes('vali') || lowerTitle.includes('seçim') || lowerTitle.includes('meclis')) {
    return 'city';
  }
  if (lowerTitle.includes('festival') || lowerTitle.includes('konser') || lowerTitle.includes('etkinlik') || lowerTitle.includes('sergi') || lowerTitle.includes('tiyatro')) {
    return 'culture';
  }
  if (lowerTitle.includes('altın') || lowerTitle.includes('dolar') || lowerTitle.includes('fiyat') || lowerTitle.includes('zam') || lowerTitle.includes('ekonomi')) {
    return 'finance';
  }
  if (lowerTitle.includes('tarım') || lowerTitle.includes('çiftçi') || lowerTitle.includes('hal') || lowerTitle.includes('meyve')) {
    return 'agriculture';
  }
  return 'general';
}

async function postToMersinManset(news, resolvedCardImageUrl) {
  const websiteUrl = (process.env.MERSIN_MANSET_API_URL || 'https://mersinmanset.tr').replace(/\/$/, '');
  const apiUrl = `${websiteUrl}/api/news`;
  
  console.log(`🌐 Mersin Manşet API'sine gönderiliyor: ${apiUrl}`);
  
  const botCategory = getThemeCategory(news.title);
  const category = mapCategoryToManset(botCategory);
  const image = resolvedCardImageUrl || news.webImageUrl || 'images/hero.png';
  const content = `${news.snippet}\n\nKaynak: ${news.source}\nDetaylar: ${news.link}`;
  
  const payload = {
    title: news.title,
    category: category,
    image: image,
    excerpt: news.snippet,
    content: content,
    date: news.date || new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Mersin Manşet web portalına haber başarıyla eklendi!');
      return true;
    } else {
      console.warn('⚠️ Mersin Manşet API yanıtı olumsuz:', response.data);
      return false;
    }
  } catch (err) {
    console.error('❌ Mersin Manşet API gönderim hatası:', err.message);
    return false;
  }
}

module.exports = { postToMersinManset };
