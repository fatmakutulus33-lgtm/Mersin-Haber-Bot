require('dotenv').config();
const axios = require('axios');

const IG_TOKEN = process.env.IG_ACCESS_TOKEN;
const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

async function checkIGAccounts() {
  if (!IG_TOKEN) {
    console.error('❌ Error: IG_ACCESS_TOKEN is missing in .env');
    return;
  }

  try {
    console.log('🔍 Fetching Facebook Pages and linked Instagram accounts...');
    const pagesRes = await axios.get(`${GRAPH_BASE}/me/accounts`, {
      params: { access_token: IG_TOKEN, fields: 'name,id,instagram_business_account{id,username,name}' }
    });

    console.log('✅ Connected Pages found:');
    const pages = pagesRes.data.data || [];
    console.log(JSON.stringify(pages, null, 2));

    let foundAny = false;
    for (const page of pages) {
      if (page.instagram_business_account) {
        console.log(`\n🎉 Linked Instagram account found on page "${page.name}":`);
        console.log(`   Instagram ID      : ${page.instagram_business_account.id}`);
        console.log(`   Instagram Username: @${page.instagram_business_account.username}`);
        console.log(`   Instagram Name    : ${page.instagram_business_account.name}`);
        foundAny = true;
      }
    }

    if (!foundAny) {
      console.log('\n❌ No Facebook Page has a linked Instagram Business Account returned.');
    }
  } catch (err) {
    console.error('❌ Error checking accounts:');
    if (err.response) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

checkIGAccounts();
