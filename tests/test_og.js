const axios = require('axios');
axios.get('https://news.google.com/rss/articles/CBMiugFBVV95cUxORUx6Y3FoVktyQUNzekRKanZpajhfUm1aSUdsbk8tYWctaTFQSnFHWm9RUld6MHRnNkFieklEalZ6YW1WOWRCRUNuY1ZZVlVMUUpud3VoaGRnOTgyYzFYUEdtdVpMbTBuZ0dMM1NYMFU0OGV2d3phMjZzZmRnSS1iNFpyWnpYUnZVWGNXcFFqSjRHNFgwR19NNk42Q0xNM0tyaTIzZ1JTZmZDNGhhblgyLU1fTlU0OXVkU1E?oc=5')
.then(r => {
  const match = r.data.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  console.log('og:image:', match ? match[1] : 'not found');
})
.catch(e => console.error(e.message));
