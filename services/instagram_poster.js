/**
 * services/instagram_poster.js
 * Instagram Graph API ile fotoğraf paylaşır.
 * 
 * Görsel yükleme stratejisi:
 *   1. image_url (PUBLIC_URL varsa Railway/Heroku'dan serve)
 *   2. form-data multipart upload (LOCAL_FILE source type) — URL gerekmez
 *   3. Catbox.moe'ya upload edip URL al
 */
const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');
const FormData = require('form-data');
const { spawnSync } = require('child_process');

const IG_USER_ID = process.env.IG_USER_ID  || '17841437317502735';
const IG_TOKEN   = process.env.IG_ACCESS_TOKEN;
const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Hashtag üret ─────────────────────────────────────────────────────────────
function buildHashtags(news) {
  const base = [
    '#mersin', '#mersinhaber', '#mersinsondakika', '#mersinmanset',
    '#sondakika', '#turkiye', '#haberpaylas'
  ];
  const text = ((news.title || '') + ' ' + (news.snippet || '')).toLowerCase();
  if (text.includes('tarsus'))                          base.push('#tarsus');
  if (text.includes('mezitli'))                         base.push('#mezitli');
  if (text.includes('yenişehir'))                       base.push('#yenisehir');
  if (text.includes('silifke'))                         base.push('#silifke');
  if (text.includes('erdemli'))                         base.push('#erdemli');
  if (text.includes('anamur'))                          base.push('#anamur');
  if (text.includes('trafik'))                          base.push('#trafik', '#trafikkaza');
  if (text.includes('yangın') || text.includes('yangin')) base.push('#yangin');
  if (text.includes('deprem'))                          base.push('#deprem');
  if (text.includes('sel') || text.includes('taşkın')) base.push('#sel', '#afet');
  if (text.includes('bayram'))                          base.push('#kurbanbayrami', '#bayram');
  if (text.includes('akkuyu'))                          base.push('#akkuyu', '#nukleer');
  return [...new Set(base)].join(' ');
}

// ── Yardımcı: 0x0.st'ye yükle (ücretsiz, anonim, güvenilir CDN) ──────────────
async function uploadTo0x0(imagePath) {
  try {
    console.log('📤 0x0.st curl ile yükleniyor...');
    const result = spawnSync('curl', [
      '-s',
      '-F', `file=@${imagePath}`,
      'https://0x0.st'
    ], { encoding: 'utf-8', timeout: 20000 });

    const stdout = (result.stdout || '').trim();
    if (stdout.startsWith('https://')) {
      console.log('📤 0x0.st URL: ' + stdout);
      return stdout;
    }
    throw new Error('0x0.st yanıtı geçersiz: ' + stdout);
  } catch (e) {
    throw new Error('0x0.st yükleme başarısız: ' + e.message);
  }
}

// ── Yardımcı: Catbox'a yükle (yedek, Meta tarafından engellenmiyor) ──────────
async function uploadToCatbox(imagePath) {
  // Catbox.moe — userhash olmadan anonim yüklemeyi kapatmış olabilir; önce dene
  try {
    console.log('📤 Catbox.moe curl (spawn) ile yükleniyor...');
    const result = spawnSync('curl', [
      '-s',
      '-F', 'reqtype=fileupload',
      '-F', `fileToUpload=@${imagePath}`,
      'https://catbox.moe/user/api.php'
    ], { encoding: 'utf-8', timeout: 15000 });

    const stdout = (result.stdout || '').trim();
    if (stdout.startsWith('https://')) {
      console.log('📤 Catbox URL: ' + stdout);
      return stdout;
    }
    console.warn('⚠️ Catbox curl başarısız ("Invalid uploader" olabilir). stdout: ' + stdout);
  } catch (e) {
    console.warn('⚠️ Catbox curl hatası: ' + e.message);
  }

  // Fallback: 0x0.st (güvenilir, anonim CDN)
  try {
    return await uploadTo0x0(imagePath);
  } catch (e) {
    console.warn('⚠️ 0x0.st başarısız: ' + e.message);
  }

  // Son çare: Litterbox (1 saatlik geçici)
  try {
    console.log('📤 Litterbox curl (spawn) ile yükleniyor (1h geçici)...');
    const result = spawnSync('curl', [
      '-s',
      '-F', 'reqtype=fileupload',
      '-F', 'time=1h',
      '-F', `fileToUpload=@${imagePath}`,
      'https://litterbox.catbox.moe/resources/internals/api.php'
    ], { encoding: 'utf-8', timeout: 15000 });

    const stdout = (result.stdout || '').trim();
    if (stdout.startsWith('https://')) {
      console.log('📤 Litterbox URL: ' + stdout);
      return stdout;
    }
    throw new Error('Litterbox curl başarısız. stdout: ' + stdout + ' stderr: ' + (result.stderr || ''));
  } catch (e) {
    throw new Error('Tüm upload yöntemleri başarısız oldu: ' + e.message);
  }
}

// ── Yardımcı: ImgBB'ye yükle (API key varsa) ─────────────────────────────────
async function uploadToImgbb(imagePath) {
  const key = process.env.IMGBB_API_KEY;
  if (!key) throw new Error('IMGBB_API_KEY yok');

  const imageData = fs.readFileSync(imagePath).toString('base64');
  const form = new FormData();
  form.append('key', key);
  form.append('image', imageData);

  const res = await axios.post('https://api.imgbb.com/1/upload', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  const url = res.data?.data?.url;
  if (!url) throw new Error('ImgBB URL alınamadı');
  console.log('📤 ImgBB URL: ' + url);
  return url;
}

// ── Görsel URL'sini karar ver ─────────────────────────────────────────────────
async function resolvePublicUrl(imagePath) {
  // 1. PUBLIC_URL env varsa ve HTTPS ise kullan (Meta HTTP'yi kabul etmez)
  const baseUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (baseUrl && baseUrl.startsWith('https://')) {
    const url = baseUrl + '/output/' + path.basename(imagePath);
    console.log('🌐 Railway/Sunucu URL (HTTPS): ' + url);
    return url;
  }

  // 2. ImgBB (API key varsa)
  if (process.env.IMGBB_API_KEY) {
    try { return await uploadToImgbb(imagePath); } catch (e) {
      console.warn('⚠️ ImgBB başarısız: ' + e.message);
    }
  }

  // 3. Catbox.moe (her zaman ücretsiz ve HTTPS)
  console.log('📤 Catbox.moe\'ya yükleniyor (HTTPS PUBLIC_URL yok)...');
  return await uploadToCatbox(imagePath);
}

/**
 * WordPress ve web portalı gibi uzun ömürlü yayınlar için kalıcı URL üretir.
 * Railway URL'si ancak output klasörü kalıcı volume'a bağlıysa kullanılır.
 * Aksi halde dosya harici bir görsel servisine yüklenir.
 */
async function resolveDurablePublicUrl(imagePath) {
  const baseUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (baseUrl.startsWith('https://') && process.env.DATA_DIR) {
    const url = baseUrl + '/output/' + path.basename(imagePath);
    console.log('🌐 Kalıcı Railway volume URL: ' + url);
    return { url, keepLocalFile: true };
  }

  if (process.env.IMGBB_API_KEY) {
    try {
      return { url: await uploadToImgbb(imagePath), keepLocalFile: false };
    } catch (e) {
      console.warn('⚠️ Kalıcı ImgBB yüklemesi başarısız: ' + e.message);
    }
  }

  console.log('📤 Kalıcı yayın için Catbox.moe yedeği kullanılıyor...');
  return { url: await uploadToCatbox(imagePath), keepLocalFile: false };
}

// ── Container oluştur + yayınla ───────────────────────────────────────────────
async function publishMedia(imageUrl, caption, mediaType) {
  mediaType = mediaType || 'IMAGE';
  console.log('📦 ' + mediaType + ' container oluşturuluyor...');

  let containerId;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const params = { image_url: imageUrl, access_token: IG_TOKEN };
      if (mediaType === 'IMAGE')   params.caption    = caption;
      if (mediaType === 'STORIES') params.media_type = 'STORIES';

      const res = await axios.post(GRAPH_BASE + '/' + IG_USER_ID + '/media', null, {
        params, timeout: 20000
      });
      containerId = res.data.id;
      console.log('✅ Container ID: ' + containerId);
      break;
    } catch (err) {
      const msg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message;
      console.warn('⚠️ Container deneme ' + attempt + '/3: ' + msg);
      if (attempt === 3) throw new Error('Container oluşturulamadı: ' + msg);
      await sleep(4000);
    }
  }

  // Status polling
  console.log('⏳ Container işleniyor...');
  for (let i = 0; i < 15; i++) {
    await sleep(5000);
    const statusRes = await axios.get(GRAPH_BASE + '/' + containerId, {
      params: { fields: 'status_code,status', access_token: IG_TOKEN }
    });
    const code = statusRes.data.status_code;
    console.log('   Status ' + (i+1) + '/15: ' + code);
    if (code === 'FINISHED') break;
    if (code === 'ERROR') throw new Error('Container hata: ' + statusRes.data.status);
    if (i === 14) throw new Error('Container 75 saniyede hazır olmadı');
  }

  console.log('🚀 Yayınlanıyor...');
  const publishRes = await axios.post(GRAPH_BASE + '/' + IG_USER_ID + '/media_publish', null, {
    params: { creation_id: containerId, access_token: IG_TOKEN },
    timeout: 20000
  });
  return publishRes.data.id;
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────
async function postToInstagram(imagePathOrUrl, news) {
  const hashtags = buildHashtags(news);

  const caption = [
    '📰 ' + news.title,
    '',
    news.snippet || '',
    '',
    news.date ? '📅 ' + news.date : '',
    '─────────────────────',
    '📌 Mersin\'de olup biten her şeyi ilk siz öğrenin!',
    '👉 Sayfamızı takip etmeyi unutmayın: @mersin.manset',
    '🔔 Anlık haberler için bildirimleri açın!',
    '🔗 www.mersinmanset.tr',
    '',
    hashtags
  ].filter(Boolean).join('\n');

  // Görsel URL'sini belirle
  let imageUrl;
  if (imagePathOrUrl.startsWith('http')) {
    // Zaten URL
    imageUrl = imagePathOrUrl;
  } else {
    // Lokal dosya — public URL'e çevir
    imageUrl = await resolvePublicUrl(imagePathOrUrl);
  }

  // 1. Feed paylaşımı
  const feedId = await publishMedia(imageUrl, caption, 'IMAGE');
  console.log('🎉 ANA AKIŞ YAYINDA! Post ID: ' + feedId);

  // 2. Story paylaşımı
  try {
    const storyId = await publishMedia(imageUrl, null, 'STORIES');
    console.log('🎉 HİKAYE YAYINDA! Story ID: ' + storyId);
  } catch (e) {
    console.warn('⚠️ Hikaye paylaşılamadı: ' + e.message);
  }

  return feedId;
}

module.exports = { postToInstagram, resolvePublicUrl, resolveDurablePublicUrl };
