const https = require('https');
const { execSync } = require('child_process');
const token = 'c3c8f43a-7e58-4420-854e-cff386e8551c';

const serviceId = '9d380361-e5bd-4431-a02f-c0f1fa19f42e';
const environmentId = 'e34aeb1a-05ae-43a5-a9e1-98bed035fa84';

// Get latest commit SHA locally
let commitSha = '';
try {
  commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  console.log('Latest Commit SHA locally:', commitSha);
} catch (e) {
  console.error('Could not get local commit SHA:', e.message);
}

const postData = JSON.stringify({
  query: `mutation serviceInstanceDeploy($serviceId: String!, $environmentId: String!, $commitSha: String, $latestCommit: Boolean) {
    serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId, commitSha: $commitSha, latestCommit: $latestCommit)
  }`,
  variables: {
    serviceId,
    environmentId,
    commitSha: commitSha || null,
    latestCommit: commitSha ? false : true
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
