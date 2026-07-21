require('dotenv').config();
const axios = require('axios');

const PAGE_ID = '110175254806613';
const IG_TOKEN = process.env.IG_ACCESS_TOKEN;
const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

async function checkLink() {
  console.log(`🔍 Checking Instagram Business Account link for Page ${PAGE_ID}...`);
  console.log(`Token Prefix: ${IG_TOKEN ? IG_TOKEN.substring(0, 15) + '...' : 'MISSING'}`);

  if (!IG_TOKEN) {
    console.error('❌ Error: IG_ACCESS_TOKEN is missing in .env');
    return;
  }

  // 1. Query the page details specifically for instagram_business_account
  try {
    const res = await axios.get(`${GRAPH_BASE}/${PAGE_ID}`, {
      params: {
        fields: 'name,id,instagram_business_account{id,username,name}',
        access_token: IG_TOKEN
      }
    });
    console.log('\n✅ Page details retrieved successfully:');
    console.log(JSON.stringify(res.data, null, 2));

    if (res.data.instagram_business_account) {
      console.log('\n🎉 FOUND LINKED INSTAGRAM BUSINESS ACCOUNT!');
      console.log(`   ID      : ${res.data.instagram_business_account.id}`);
      console.log(`   Username: @${res.data.instagram_business_account.username}`);
      console.log(`   Name    : ${res.data.instagram_business_account.name}`);
    } else {
      console.log('\n❌ No Instagram Business Account is linked to this Facebook Page.');
      console.log('   Please make sure the link is set up in Page Settings -> Linked Accounts -> Instagram.');
    }
  } catch (err) {
    console.error('❌ Failed to fetch page details.');
    if (err.response) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

checkLink();
