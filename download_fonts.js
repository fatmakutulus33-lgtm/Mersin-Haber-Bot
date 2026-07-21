const axios = require('axios');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, 'fonts');
if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR);

async function downloadFont(url, filename) {
  const dest = path.join(FONTS_DIR, filename);
  console.log(`Downloading ${filename}...`);
  const res = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  const writer = fs.createWriteStream(dest);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function run() {
  await downloadFont('https://github.com/google/fonts/raw/main/ofl/roboto/Roboto-Regular.ttf', 'Roboto-Regular.ttf');
  await downloadFont('https://github.com/google/fonts/raw/main/ofl/roboto/Roboto-Bold.ttf', 'Roboto-Bold.ttf');
  console.log('Fonts downloaded.');
}

run();
