const https = require('https');
const token = 'c3c8f43a-7e58-4420-854e-cff386e8551c';

const postData = JSON.stringify({
  query: `query {
    deployment(id: "ecddce40-7771-4dd6-a144-1a301b6c06eb") {
      id
      status
      meta
    }
  }`
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
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch(e) {
      console.log(data);
    }
  });
});

req.write(postData);
req.end();
