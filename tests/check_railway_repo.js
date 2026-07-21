const https = require('https');
const token = 'c3c8f43a-7e58-4420-854e-cff386e8551c';

const postData = JSON.stringify({
  query: `query {
    service(id: "9d380361-e5bd-4431-a02f-c0f1fa19f42e") {
      id
      name
      source {
        repo
      }
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
    console.log(data);
  });
});

req.write(postData);
req.end();
