/**
 * services/manset_poster.js
 * Mersin Manşet web portalı API'sine haber gönderir.
 */
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
  
  if (lowerTitle.includes('spor') || lowerTitle.includes('futbol') || lowerTitle.includes('idman') || lowerTitle.includes('maç') || lowerTitle.includes('stadyum') || lowerTitle.includes('yenildi') || lowerTitle.includes('yendi') || lowerTitle.includes('galibiyet') || lowerTitle.includes('basketbol')) {
    return 'sports';
  }
  if (lowerTitle.includes('kaza') || lowerTitle.includes('feci') || lowerTitle.includes('cinayet') || lowerTitle.includes('öldü') || lowerTitle.includes('yaralandı') || lowerTitle.includes('yangın') || lowerTitle.includes('tutuklandı') || lowerTitle.includes('gözaltı') || lowerTitle.includes('operasyon') || lowerTitle.includes('polis')) {
    return 'accident';
  }
  if (lowerTitle.includes('belediye') || lowerTitle.includes('başkan') || lowerTitle.includes('bakan') || lowerTitle.includes('vali') || lowerTitle.includes('seçim') || lowerTitle.includes('parti') || lowerTitle.includes('meclis') || lowerTitle.includes('toplantı')) {
    return 'city';
  }
  if (lowerTitle.includes('festival') || lowerTitle.includes('konser') || lowerTitle.includes('etkinlik') || lowerTitle.includes('sergi') || lowerTitle.includes('tiyatro') || lowerTitle.includes('sanat') || lowerTitle.includes('müzik') || lowerTitle.includes('kültür')) {
    return 'culture';
  }
  if (lowerTitle.includes('altın') || lowerTitle.includes('dolar') || lowerTitle.includes('fiyat') || lowerTitle.includes('zam') || lowerTitle.includes('enflasyon') || lowerTitle.includes('ihracat') || lowerTitle.includes('esnaf') || lowerTitle.includes('ekonomi') || lowerTitle.includes('para') || lowerTitle.includes('ticaret')) {
    return 'finance';
  }
  if (lowerTitle.includes('tarım') || lowerTitle.includes('çiftçi') || lowerTitle.includes('hal') || lowerTitle.includes('meyve') || lowerTitle.includes('sebze') || lowerTitle.includes('portakal') || lowerTitle.includes('limon') || lowerTitle.includes('domates') || lowerTitle.includes('tarla')) {
    return 'agriculture';
  }
  
  return 'general';
}

function selectMansetImage(news, resolvedCardImageUrl) {
  return resolvedCardImageUrl || news.webImageUrl || 'images/hero.png';
}

/**
 * Onaylanıp paylaşılan haberi Mersin Manşet portal API'sine gönderir.
 * @param {object} news - Haber nesnesi
 * @param {string} resolvedCardImageUrl - Çözümlenen kart görseli URL'si (fall back için)
 */
async function postToMersinManset(news, resolvedCardImageUrl) {
  const websiteUrl = (process.env.MERSIN_MANSET_API_URL || 'https://mersinmanset.tr').replace(/\/$/, '');
  const apiUrl = `${websiteUrl}/api/news`;
  
  console.log(`🌐 Mersin Manşet API'sine gönderiliyor: ${apiUrl}`);
  
  const botCategory = getThemeCategory(news.title);
  const category = mapCategoryToManset(botCategory);
  
  // Portalda hotlink yerine botun kalıcı depoya aldığı kartı kullan.
  const image = selectMansetImage(news, resolvedCardImageUrl);
  
  // İçerik: Kısa özet + Detay linki
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
      headers: {
        'Content-Type': 'application/json'
      },
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

module.exports = { postToMersinManset, selectMansetImage };
