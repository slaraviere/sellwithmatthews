// Launches Chromium for the tests. Set CRM_CHROMIUM to an executable path to use a
// browser that is already installed instead of Playwright's own download.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch (e) { ({ chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright')); }
export async function launch() {
  const exe = process.env.CRM_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '');
  return chromium.launch(exe ? { executablePath: exe } : {});
}
