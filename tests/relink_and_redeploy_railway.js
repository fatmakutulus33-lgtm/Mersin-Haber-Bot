const https = require('https');
const token = 'c3c8f43a-7e58-4420-854e-cff386e8551c';

const serviceId = '9d380361-e5bd-4431-a02f-c0f1fa19f42e';
const environmentId = 'e34aeb1a-05ae-43a5-a9e1-98bed035fa84';
const repo = 'fatmakutulus33-lgtm/Mersin-Haber-Bot';

function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
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
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('1. Connecting service to GitHub repo: ' + repo);
  const connectRes = await graphqlRequest(`
    mutation serviceConnect($id: String!, $input: ServiceConnectInput!) {
      serviceConnect(id: $id, input: $input) {
        id
        name
      }
    }
  `, {
    id: serviceId,
    input: { repo: repo, branch: 'main' }
  });
  console.log('Connect Response:', JSON.stringify(connectRes, null, 2));

  console.log('2. Triggering redeploy for environment: ' + environmentId);
  const redeployRes = await graphqlRequest(`
    mutation serviceInstanceRedeploy($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
  `, {
    serviceId: serviceId,
    environmentId: environmentId
  });
  console.log('Redeploy Response:', JSON.stringify(redeployRes, null, 2));
})();
