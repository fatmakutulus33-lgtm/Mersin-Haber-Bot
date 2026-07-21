const https = require('https');

const token = 'c3c8f43a-7e58-4420-854e-cff386e8551c';
const deploymentId = '82dc0b4f-4136-46ec-9375-d9c8b25436a9';

const postData = JSON.stringify({
  query: `query {
    deploymentLogs(deploymentId: "${deploymentId}", limit: 50) {
      message
      severity
      timestamp
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
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.data && parsed.data.deploymentLogs) {
        // Sort chronologically (oldest to newest)
        const logs = parsed.data.deploymentLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        logs.forEach(log => {
          console.log(`[${log.timestamp}] [${log.severity}] ${log.message}`);
        });
      } else {
        console.log('No data:', parsed);
      }
    } catch (err) {
      console.error('Error parsing:', data);
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(postData);
req.end();
