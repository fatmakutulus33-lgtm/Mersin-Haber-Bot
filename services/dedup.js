const fs = require('fs');
const path = require('path');

const POSTED_FILE = path.join(__dirname, '..', 'posted_news.json');

function loadPostedNews() {
  if (!fs.existsSync(POSTED_FILE)) {
    return { posted: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8'));
  } catch (e) {
    console.error('⚠️ posted_news.json reading failed, resetting:', e.message);
    return { posted: [] };
  }
}

function savePostedNews(data) {
  try {
    fs.writeFileSync(POSTED_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ posted_news.json writing failed:', e.message);
  }
}

function isAlreadyPosted(news) {
  const data = loadPostedNews();
  const id = news.id || generateId(news);
  return data.posted.some(item => item.id === id);
}

function markAsPosted(news, postId = 'PUBLISHED') {
  const data = loadPostedNews();
  const id = news.id || generateId(news);
  
  // Deduplicate
  data.posted = data.posted.filter(item => item.id !== id);
  
  data.posted.push({
    id,
    title: news.title,
    postId,
    postedAt: new Date().toISOString()
  });

  // Limit cache size to 1000 items to avoid infinite growth
  if (data.posted.length > 1000) {
    data.posted.shift();
  }

  savePostedNews(data);
}

function getRecentPosts(limit = 5) {
  const data = loadPostedNews();
  return [...data.posted].reverse().slice(0, limit);
}

function generateId(news) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(news.title).digest('hex');
}

module.exports = { isAlreadyPosted, markAsPosted, getRecentPosts, generateId };
