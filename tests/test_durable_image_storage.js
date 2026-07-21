const assert = require('assert');
const path = require('path');

const { resolveDurablePublicUrl } = require('./services/instagram_poster');
const { selectMansetImage } = require('./services/manset_poster');

async function run() {
  const previousPublicUrl = process.env.PUBLIC_URL;
  const previousDataDir = process.env.DATA_DIR;

  process.env.PUBLIC_URL = 'https://bot.example.com/';
  process.env.DATA_DIR = '/data';

  const durable = await resolveDurablePublicUrl(path.join('output', 'haber_test.png'));
  assert.deepStrictEqual(durable, {
    url: 'https://bot.example.com/output/haber_test.png',
    keepLocalFile: true
  });

  const selected = selectMansetImage(
    { webImageUrl: 'https://source.example.com/temporary.jpg' },
    durable.url
  );
  assert.strictEqual(selected, durable.url, 'Portal kalıcı kart URL\'sini tercih etmeli');

  if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
  else process.env.PUBLIC_URL = previousPublicUrl;
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;

  console.log('Kalıcı görsel depolama testleri başarılı.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
