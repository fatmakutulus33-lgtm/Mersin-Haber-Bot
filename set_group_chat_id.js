/**
 * set_group_chat_id.js
 * Mersin Haber Bot için Telegram Grup Chat ID'sini .env ve Railway değişkenlerine günceller.
 * 
 * Kullanım: node set_group_chat_id.js <grup_chat_id>
 * Örnek:   node set_group_chat_id.js -1001234567890
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const newChatId = process.argv[2];

if (!newChatId) {
  console.error('❌ Lütfen bir Chat ID girin. Örnek: node set_group_chat_id.js -1001234567890');
  process.exit(1);
}

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  let content = fs.readFileSync(envPath, 'utf8');
  if (content.includes('TELEGRAM_CHAT_ID=')) {
    content = content.replace(/TELEGRAM_CHAT_ID=.*/g, `TELEGRAM_CHAT_ID=${newChatId}`);
  } else {
    content += `\nTELEGRAM_CHAT_ID=${newChatId}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf8');
  console.log(`✅ Yerel .env dosyası güncellendi: TELEGRAM_CHAT_ID=${newChatId}`);
} else {
  console.warn('⚠️ .env dosyası bulunamadı, atlaniyor.');
}

// Railway Değişkenini Güncelle
const token = 'c3c8f43a-7e58-4420-854e-cff386e8551c';
const postData = JSON.stringify({
  query: `mutation variableUpsert($input: VariableUpsertInput!) {
    variableUpsert(input: $input)
  }`,
  variables: {
    input: {
      projectId: "4c5c01af-573b-4381-94d8-38b229528b9d",
      serviceId: "9d380361-e5bd-4431-a02f-c0f1fa19f42e",
      environmentId: "e34aeb1a-05ae-43a5-a9e1-98bed035fa84",
      name: "TELEGRAM_CHAT_ID",
      value: newChatId.toString()
    }
  }
});

const req = https.request({
  hostname: 'backboard.railway.app',
  path: '/graphql/v2',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.data && parsed.data.variableUpsert) {
        console.log(`🚀 Railway TELEGRAM_CHAT_ID başarıyla güncellendi: ${newChatId}`);
        console.log('🔄 Railway otomatik redeploy başlatacak.');
      } else {
        console.error('❌ Railway güncelleme yanıtı başarısız:', data);
      }
    } catch (err) {
      console.error('❌ Yanıt ayrıştırılamadı:', data);
    }
  });
});

req.on('error', e => console.error('❌ Railway API Hatası:', e.message));
req.write(postData);
req.end();
