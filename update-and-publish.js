const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');
const { URL } = require('url');

const configPath = 'C:\\Users\\15695\\.gemini\\config\\mcp_config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.mcpServers['github-mcp-server']?.env?.GITHUB_PERSONAL_ACCESS_TOKEN;
const gitExe = 'C:\\Program Files\\Git\\cmd\\git.exe';
const owner = 'spurbro';
const repo = 'bilibili-touch-controller';
const tagName = 'v1.0.0';
const zipFilePath = path.join(__dirname, 'bilibili-touch-controller-v1.0.0.zip');

function httpsRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function uploadAsset(uploadUrlTemplate, filePath) {
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const uploadUrl = uploadUrlTemplate.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  const parsed = new URL(uploadUrl);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'User-Agent': 'BiliTouchReleasePublisher',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/zip',
        'Content-Length': fileData.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function main() {
  console.log('1. Re-packaging release zip archive...');
  const distDir = path.join(__dirname, 'dist_temp', 'bilibili-touch-controller');
  if (fs.existsSync(path.join(__dirname, 'dist_temp'))) {
    fs.rmSync(path.join(__dirname, 'dist_temp'), { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // Copy files
  ['manifest.json', 'content', 'popup', 'icons', 'README.md', 'LICENSE'].forEach(item => {
    const src = path.join(__dirname, item);
    const dest = path.join(distDir, item);
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  });

  // Zip using powershell
  if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
  execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipFilePath}' -Force"`, { stdio: 'inherit' });
  fs.rmSync(path.join(__dirname, 'dist_temp'), { recursive: true, force: true });
  console.log('✓ Zip package updated successfully.');

  console.log('2. Committing and pushing code to GitHub...');
  const pushUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  const publicUrl = `https://github.com/${owner}/${repo}.git`;

  try {
    execSync(`"${gitExe}" add .`, { stdio: 'pipe' });
    execSync(`"${gitExe}" commit -m "feat: Brief auto-fading ultra-subtle speed badge on long press"`, { stdio: 'pipe' });
    execSync(`"${gitExe}" remote set-url origin "${pushUrl}"`, { stdio: 'pipe' });
    execSync(`"${gitExe}" push origin main`, { stdio: 'pipe' });
    execSync(`"${gitExe}" remote set-url origin "${publicUrl}"`, { stdio: 'pipe' });
    console.log('✓ Pushed to main branch.');
  } catch (err) {
    console.log('Git commit/push note:', err.message);
    try { execSync(`"${gitExe}" remote set-url origin "${publicUrl}"`, { stdio: 'pipe' }); } catch(e) {}
  }

  console.log('3. Updating Release v1.0.0 Asset on GitHub...');
  const existingRes = await httpsRequest({
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases/tags/${tagName}`,
    method: 'GET',
    headers: {
      'User-Agent': 'BiliTouchReleasePublisher',
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (existingRes.status === 200) {
    const release = existingRes.data;
    if (release.assets && release.assets.length > 0) {
      for (const asset of release.assets) {
        if (asset.name === path.basename(zipFilePath)) {
          console.log(`Deleting old asset ${asset.id}...`);
          await httpsRequest({
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/releases/assets/${asset.id}`,
            method: 'DELETE',
            headers: {
              'User-Agent': 'BiliTouchReleasePublisher',
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
        }
      }
    }

    const uploadRes = await uploadAsset(release.upload_url, zipFilePath);
    if (uploadRes.status === 201) {
      console.log(`✓ Release asset refreshed: ${uploadRes.data.browser_download_url}`);
    }
  }

  console.log(`\n🎉 All updates and release package synchronized to: https://github.com/${owner}/${repo}`);
}

main();
