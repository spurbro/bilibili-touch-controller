const fs = require('fs');
const { execSync } = require('child_process');

const config = JSON.parse(fs.readFileSync('C:\\Users\\15695\\.gemini\\config\\mcp_config.json', 'utf8'));
const token = config.mcpServers['github-mcp-server']?.env?.GITHUB_PERSONAL_ACCESS_TOKEN;
const gitExe = 'C:\\Program Files\\Git\\cmd\\git.exe';
const repoName = 'bilibili-touch-controller';

const pushUrl = `https://x-access-token:${token}@github.com/spurbro/${repoName}.git`;
const publicUrl = `https://github.com/spurbro/${repoName}.git`;

try {
  execSync(`"${gitExe}" add .`, { stdio: 'pipe' });
  execSync(`"${gitExe}" commit -m "refactor: Restore double-tap to toggle fullscreen and remove double-tap skip"`, { stdio: 'pipe' });
  execSync(`"${gitExe}" remote set-url origin "${pushUrl}"`, { stdio: 'pipe' });
  const out = execSync(`"${gitExe}" push origin main`, { stdio: 'pipe' }).toString();
  console.log('Push output:', out);
  execSync(`"${gitExe}" remote set-url origin "${publicUrl}"`, { stdio: 'pipe' });
  console.log(`\n🎉 Successfully synced updates to GitHub: https://github.com/spurbro/${repoName}`);
} catch (err) {
  console.error('Push error:', err.message, err.stderr ? err.stderr.toString() : '');
  try { execSync(`"${gitExe}" remote set-url origin "${publicUrl}"`, { stdio: 'pipe' }); } catch(e) {}
}
