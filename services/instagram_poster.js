const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { spawnSync } = require('child_process');

const IG_USER_ID = process.env.IG_USER_ID || '17841437317502735';
const IG_TOKEN   = process.env.IG_ACCESS_TOKEN;
const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildHashtags(news) {
  const base = [
    '#mersin', '#mersinhaber', '#mersinsondakika', '#mersinmanset',
    '#sondakika', '#turkiye', '#haberpaylas'
  ];
  const text = ((news.title || '') + ' ' + (news.snippet || '')).toLowerCase();
  if (text.includes('tarsus')) base.push('#tarsus');
  if (text.includes('mezitli')) base.push('#mezitli');
  if (text.includes('yenişehir')) base.push('#yenisehir');
  if (text.includes('silifke')) base.push('#silifke');
  if (text.includes('erdemli')) base.push('#erdemli');
  if (text.includes('anamur')) base.push('#anamur');
  if (text.includes('trafik')) base.push('#trafik', '#trafikkaza');
  if (text.includes('yangın') || text.includes('yangin')) base.push('#yangin');
  return [...new Set(base)].join(' ');
}

async function uploadTo0x0(imagePath) {
  try {
    const result = spawnSync('curl', ['-s', '-F', `file=@${imagePath}`, 'https://0x0.st'], { encoding: 'utf-8', timeout: 20000 });
    const stdout = (result.stdout || '').trim();
    if (stdout.startsWith('https://')) return stdout;
    throw new Error(stdout);
  } catch (e) {
    throw new Error('0x0.st failed: ' + e.message);
  }
}

async function uploadToCatbox(imagePath) {
  try {
    const result = spawnSync('curl', ['-s', '-F', 'reqtype=fileupload', '-F', `fileToUpload=@${imagePath}`, 'https://catbox.moe/user/api.php'], { encoding: 'utf-8', timeout: 15000 });
    const stdout = (result.stdout || '').trim();
    if (stdout.startsWith('https://')) return stdout;
  } catch (_) {}

  try { return await uploadTo0x0(imagePath); } catch (_) {}

  try {
    const result = spawnSync('curl', ['-s', '-F', 'reqtype=fileupload', '-F', 'time=1h', `-F`, `fileToUpload=@${imagePath}`, 'https://litterbox.catbox.moe/resources/internals/api.php'], { encoding: 'utf-8', timeout: 15000 });
    const stdout = (result.stdout || '').trim();
    if (stdout.startsWith('https://')) return stdout;
    throw new Error(stdout);
  } catch (e) {
    throw new Error('All image upload mechanisms failed: ' + e.message);
  }
}

async function uploadToImgbb(imagePath) {
  const key = process.env.IMGBB_API_KEY;
  if (!key) throw new Error('No IMGBB_API_KEY');
  const imageData = fs.readFileSync(imagePath).toString('base64');
  const form = new FormData();
  form.append('key', key);
  form.append('image', imageData);
  const res = await axios.post('https://api.imgbb.com/1/upload', form, { headers: form.getHeaders(), timeout: 30000 });
  return res.data?.data?.url;
}

async function resolvePublicUrl(imagePath) {
  const baseUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (baseUrl && baseUrl.startsWith('https://')) {
    return baseUrl + '/output/' + path.basename(imagePath);
  }
  if (process.env.IMGBB_API_KEY) {
    try { return await uploadToImgbb(imagePath); } catch (_) {}
  }
  return await uploadToCatbox(imagePath);
}

async function resolveDurablePublicUrl(imagePath) {
  const baseUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (baseUrl.startsWith('https://') && process.env.DATA_DIR) {
    return { url: baseUrl + '/output/' + path.basename(imagePath), keepLocalFile: true };
  }
  if (process.env.IMGBB_API_KEY) {
    try { return { url: await uploadToImgbb(imagePath), keepLocalFile: false }; } catch (_) {}
  }
  return { url: await uploadToCatbox(imagePath), keepLocalFile: false };
}

async function publishMedia(imageUrl, caption, mediaType = 'IMAGE') {
  let containerId;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const params = { image_url: imageUrl, access_token: IG_TOKEN };
      if (mediaType === 'IMAGE') params.caption = caption;
      if (mediaType === 'STORIES') params.media_type = 'STORIES';

      const res = await axios.post(`${GRAPH_BASE}/${IG_USER_ID}/media`, null, { params, timeout: 20000 });
      containerId = res.data.id;
      break;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      if (attempt === 3) throw new Error(msg);
      await sleep(4000);
    }
  }

  for (let i = 0; i < 15; i++) {
    await sleep(5000);
    const statusRes = await axios.get(`${GRAPH_BASE}/${containerId}`, { params: { fields: 'status_code,status', access_token: IG_TOKEN } });
    const code = statusRes.data.status_code;
    if (code === 'FINISHED') break;
    if (code === 'ERROR') throw new Error(statusRes.data.status);
  }

  const publishRes = await axios.post(`${GRAPH_BASE}/${IG_USER_ID}/media_publish`, null, { params: { creation_id: containerId, access_token: IG_TOKEN }, timeout: 20000 });
  return publishRes.data.id;
}

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
    '🔗 www.mersinmanset.tr',
    '',
    hashtags
  ].filter(Boolean).join('\n');

  const imageUrl = imagePathOrUrl.startsWith('http') ? imagePathOrUrl : await resolvePublicUrl(imagePathOrUrl);
  const feedId = await publishMedia(imageUrl, caption, 'IMAGE');
  console.log('🎉 Instagram Feed yayında: ' + feedId);

  try {
    await publishMedia(imageUrl, null, 'STORIES');
  } catch (e) {
    console.warn('⚠️ Instagram Story paylaşılamadı:', e.message);
  }

  return feedId;
}

module.exports = { postToInstagram, resolvePublicUrl, resolveDurablePublicUrl };
