const https = require('https');
const token = 'c3c8f43a-7e58-4420-854e-cff386e8551c';

const postData = JSON.stringify({
  query: `query {
    __schema {
      mutationType {
        fields {
          name
          description
          args {
            name
            type {
              name
              kind
            }
          }
        }
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
    try {
      const parsed = JSON.parse(data);
      const fields = parsed.data.__schema.mutationType.fields;
      const deploys = fields.filter(f => f.name.toLowerCase().includes('deploy') || f.name.toLowerCase().includes('build'));
      console.log(JSON.stringify(deploys, null, 2));
    } catch(e) {
      console.log(data);
    }
  });
});

req.write(postData);
req.end();
