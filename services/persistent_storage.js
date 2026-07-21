const fs = require('fs');
const path = require('path');

function ensureParent(target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

function replaceWithSymlink(source, target, isDirectory = false) {
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) return;
    fs.rmSync(target, { recursive: stat.isDirectory(), force: true });
  }
  ensureParent(target);
  fs.symlinkSync(source, target, isDirectory ? 'dir' : 'file');
}

function seedFile(seedPath, persistentPath, fallback) {
  if (fs.existsSync(persistentPath)) return;
  ensureParent(persistentPath);
  if (fs.existsSync(seedPath)) {
    fs.copyFileSync(seedPath, persistentPath);
  } else {
    fs.writeFileSync(persistentPath, fallback, 'utf8');
  }
}

function migrateSettingsDomain(settingsPath) {
  if (!fs.existsSync(settingsPath)) return;

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (typeof settings.watermarkText !== 'string') return;

    const migratedWatermark = settings.watermarkText.replace(/mersinmanset\.com/gi, 'mersinmanset.tr');
    if (migratedWatermark === settings.watermarkText) return;

    settings.watermarkText = migratedWatermark;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`Filigran alan adı güncellendi: ${migratedWatermark}`);
  } catch (error) {
    console.warn(`Kalıcı tasarım ayarı güncellenemedi: ${error.message}`);
  }
}

function initPersistentStorage(projectRoot) {
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) return;

  const seedDir = path.join(projectRoot, 'seed');
  fs.mkdirSync(dataDir, { recursive: true });

  const files = [
    ['posted_news.json', '{"posted":[],"lastUpdated":""}'],
    ['settings.json', '{}'],
    ['pending_approval.json', '{}']
  ];

  for (const [name, fallback] of files) {
    const persistentPath = path.join(dataDir, name);
    seedFile(path.join(seedDir, name), persistentPath, fallback);
    if (name === 'settings.json') migrateSettingsDomain(persistentPath);
    replaceWithSymlink(persistentPath, path.join(projectRoot, name));
  }

  const persistentOutput = path.join(dataDir, 'output');
  fs.mkdirSync(persistentOutput, { recursive: true });
  replaceWithSymlink(persistentOutput, path.join(projectRoot, 'output'), true);

  const seedLogo = path.join(seedDir, 'custom_logo.png');
  if (fs.existsSync(seedLogo)) {
    const persistentLogo = path.join(dataDir, 'custom_logo.png');
    if (!fs.existsSync(persistentLogo)) fs.copyFileSync(seedLogo, persistentLogo);
    replaceWithSymlink(
      persistentLogo,
      path.join(projectRoot, 'dashboard', 'assets', 'custom_logo.png')
    );
  }

  console.log(`Kalıcı veri alanı hazır: ${dataDir}`);
}

module.exports = { initPersistentStorage, migrateSettingsDomain };
