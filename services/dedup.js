/**
 * services/dedup.js
 * Aynı haberin iki kez paylaşılmasını engeller.
 * Paylaşılan haber ID'lerini JSON dosyasında saklar.
 */
const fs = require('fs');
const path = require('path');

const DEDUP_FILE = path.join(__dirname, '..', 'posted_news.json');
const MAX_HISTORY = 500; // Maksimum kayıt sayısı

function loadHistory() {
  try {
    if (fs.existsSync(DEDUP_FILE)) {
      const data = JSON.parse(fs.readFileSync(DEDUP_FILE, 'utf-8'));
      if (data && Array.isArray(data.posted)) {
        return data;
      }
    }
  } catch (e) {}
  return { posted: [], lastUpdated: null };
}

function saveHistory(data) {
  fs.writeFileSync(DEDUP_FILE, JSON.stringify(data, null, 2));
}

/**
 * Bu haber daha önce paylaşıldı mı?
 */
function isAlreadyPosted(newsId) {
  const history = loadHistory();
  return Array.isArray(history.posted) ? history.posted.some(p => p.id === newsId) : false;
}

/**
 * Haberi paylaşıldı olarak işaretle
 */
function markAsPosted(news, postId) {
  const history = loadHistory();
  
  history.posted.unshift({
    id: news.id,
    title: news.title.substring(0, 100),
    postId,
    postedAt: new Date().toISOString(),
  });

  // Maksimum kayıt sınırını uygula
  if (history.posted.length > MAX_HISTORY) {
    history.posted = history.posted.slice(0, MAX_HISTORY);
  }

  history.lastUpdated = new Date().toISOString();
  saveHistory(history);
}

/**
 * Son N paylaşımın özetini göster
 */
function getRecentPosts(n = 5) {
  const history = loadHistory();
  return history.posted.slice(0, n);
}

module.exports = { isAlreadyPosted, markAsPosted, getRecentPosts };
