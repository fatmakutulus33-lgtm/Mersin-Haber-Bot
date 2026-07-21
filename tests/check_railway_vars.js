const https = require('https');
const token = 'c3c8f43a-7e58-4420-854e-cff386e8551c';

const postData = JSON.stringify({
  query: `query {
    variables(projectId: "4c5c01af-573b-4381-94d8-38b229528b9d", environmentId: "e34aeb1a-05ae-43a5-a9e1-98bed035fa84", serviceId: "9d380361-e5bd-4431-a02f-c0f1fa19f42e")
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
