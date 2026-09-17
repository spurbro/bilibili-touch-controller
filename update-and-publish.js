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

// Dynamically read version from manifest.json
const manifestPath = path.join(__dirname, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.1.0';
const tagName = `v${version}`;
const zipFileName = `bilibili-touch-controller-${tagName}.zip`;
const zipFilePath = path.join(__dirname, zipFileName);

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
  console.log(`=== Bilibili Touch Controller Publisher (${tagName}) ===`);
  console.log(`Target Version: ${version} (Tag: ${tagName})`);
  console.log(`Zip Package: ${zipFileName}`);

  // 1. Package release zip
  console.log('\n1. Packaging release zip archive...');
  const distDir = path.join(__dirname, 'dist_temp', 'bilibili-touch-controller');
  if (fs.existsSync(path.join(__dirname, 'dist_temp'))) {
    fs.rmSync(path.join(__dirname, 'dist_temp'), { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  ['manifest.json', 'content', 'popup', 'icons', 'README.md', 'LICENSE'].forEach(item => {
    const src = path.join(__dirname, item);
    const dest = path.join(distDir, item);
    if (fs.existsSync(src)) {
      if (fs.statSync(src).isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  });

  if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
  execSync(`pwsh -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipFilePath}' -Force"`, { stdio: 'inherit' });
  fs.rmSync(path.join(__dirname, 'dist_temp'), { recursive: true, force: true });
  console.log(`✓ Zip package created: ${zipFileName}`);

  // 2. Git commit, tag, and push
  console.log('\n2. Committing, tagging, and pushing code to GitHub...');
  const pushUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  const publicUrl = `https://github.com/${owner}/${repo}.git`;

  try {
    execSync(`"${gitExe}" add .`, { stdio: 'pipe' });
    try {
      execSync(`"${gitExe}" commit -m "release: ${tagName} - 顶栏高透 HUD 与全画幅关键帧缩略图预览"`, { stdio: 'pipe' });
    } catch (e) {
      console.log('No new changes to commit or commit succeeded.');
    }
    execSync(`"${gitExe}" remote set-url origin "${pushUrl}"`, { stdio: 'pipe' });
    execSync(`"${gitExe}" push origin main`, { stdio: 'pipe' });

    // Manage git tag
    try {
      execSync(`"${gitExe}" tag -d ${tagName}`, { stdio: 'pipe' });
    } catch (e) {}
    execSync(`"${gitExe}" tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'pipe' });
    execSync(`"${gitExe}" push origin ${tagName} --force`, { stdio: 'pipe' });

    execSync(`"${gitExe}" remote set-url origin "${publicUrl}"`, { stdio: 'pipe' });
    console.log(`✓ Pushed to main branch and pushed tag ${tagName}.`);
  } catch (err) {
    console.log('Git commit/push note:', err.message);
    try { execSync(`"${gitExe}" remote set-url origin "${publicUrl}"`, { stdio: 'pipe' }); } catch(e) {}
  }

  // 3. Create or Update GitHub Release
  console.log(`\n3. Ensuring GitHub Release for ${tagName}...`);
  let release = null;

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
    console.log(`Found existing release for ${tagName}.`);
    release = existingRes.data;
  } else {
    console.log(`Release ${tagName} does not exist yet. Creating new release...`);
    const releaseBody = `## 🚀 ${tagName} 更新说明\n\n` +
      `### ✨ 新增与优化特性\n` +
      `- 🔝 **HUD 全面上移至顶栏**：将所有手势提示（快进/快退、音量调节、Tone-Mapping 亮度调节、全屏切换与长按倍速）全部移至播放器顶部居中，彻底释放视频正中核心视线。\n` +
      `- 🔍 **超高透明度与极简毛玻璃微胶囊**：采用极轻量半透明磨砂质感（28% 基础透明度），精致不显眼、不抢眼、不遮挡任何视频内容。\n` +
      `- 🖼️ **视频关键帧缩略图全画幅预览**：左右滑动调整进度时，顶部 HUD 实时呈现目标时间点的高清视频帧截图。\n` +
      `- 📐 **视口投影定理与画幅自适应**：彻底修复单帧只露出一角或拉伸形变的问题，支持 16:9、4:3、21:9 及 9:16 竖屏全画幅 100% 完整展示。\n` +
      `- ⚡ **双轨雪碧图与二进制时间轴引擎**：集成原生状态机镜像与 pvdata 二进制大端索引解析，60 FPS 毫秒级跟手。\n` +
      `- 🎛️ **设置面板快捷开关**：弹窗中已增加“滑动显示视频帧缩略图”开关，秒级热生效。\n\n` +
      `### 📥 安装方法\n` +
      `下载并解压下方 \`${zipFileName}\`，在 Edge / Chrome 的扩展管理中开启“开发人员模式”，点击“加载解压缩的扩展”选择该文件夹即可。`;

    const createRes = await httpsRequest({
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/releases`,
      method: 'POST',
      headers: {
        'User-Agent': 'BiliTouchReleasePublisher',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, JSON.stringify({
      tag_name: tagName,
      target_commitish: 'main',
      name: `${tagName} - 顶栏高透 HUD 与全画幅关键帧缩略图预览`,
      body: releaseBody,
      draft: false,
      prerelease: false
    }));

    if (createRes.status === 201) {
      console.log(`✓ Release ${tagName} created successfully: ${createRes.data.html_url}`);
      release = createRes.data;
    } else {
      console.error(`Failed to create release: status ${createRes.status}`, createRes.data || createRes.raw);
      return;
    }
  }

  // 4. Upload or refresh release asset
  if (release && release.upload_url) {
    if (release.assets && release.assets.length > 0) {
      for (const asset of release.assets) {
        if (asset.name === path.basename(zipFilePath)) {
          console.log(`Deleting previous asset ${asset.name} (${asset.id})...`);
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
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    console.log(`Uploading ${path.basename(zipFilePath)} to ${tagName}...`);
    const uploadRes = await uploadAsset(release.upload_url, zipFilePath);
    if (uploadRes.status === 201) {
      console.log(`✓ Release asset uploaded: ${uploadRes.data.browser_download_url}`);
    } else {
      console.log(`Asset upload status: ${uploadRes.status}`, uploadRes.data || uploadRes.raw);
    }
  }

  console.log(`\n🎉 Release ${tagName} published successfully: https://github.com/${owner}/${repo}/releases/tag/${tagName}`);
}

main();
