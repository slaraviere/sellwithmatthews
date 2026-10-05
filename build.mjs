import { readFileSync, writeFileSync } from 'node:fs';
const r = f => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const js = ['core.js', 'ui.js', 'import.js', 'outreach.js', 'app.js'].map(r).join('\n');
if (js.includes('</script')) throw new Error('script close tag inside JS');
const html = r('shell.html').replace('/*__CSS__*/', () => r('style.css')).replace('/*__JS__*/', () => js);
writeFileSync(new URL('./dist/matthews-consignment-crm.html', import.meta.url), html);
console.log('built', (html.length / 1024).toFixed(1) + ' KB');
