/**
 * 8 farklı temada haber kartı üretir — görsel karşılaştırma için.
 */
require('dotenv').config();
const path = require('path');
const { generateNewsCard, OUTPUT_DIR, THEMES } = require('./services/image_generator');

const sampleNews = {
  id:      'test-haber-001',
  title:   'Mersin\'de büyük gelişme: Akkuyu NGS tarihi eşiğe yaklaşıyor',
  snippet: 'Türkiye\'nin ilk nükleer enerji santrali Akkuyu\'da kritik süreç tamamlanmak üzere.',
  date:    '28 Mayıs 2026',
  source:  'Mersin Manşet',
  imageUrl: null,
};

(async function() {
  console.log('8 temada kart üretiliyor...\n');
  for (let i = 0; i < THEMES.length; i++) {
    const theme = THEMES[i];
    const outPath = path.join(OUTPUT_DIR, 'tema_' + theme.name + '.png');
    await generateNewsCard(sampleNews, outPath, theme);
    console.log('✅ ' + theme.name + ' — accent: ' + theme.accent);
  }
  console.log('\nTüm kartlar: ' + OUTPUT_DIR);
})().catch(console.error);
