import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {makeZip} from '../test/zip-fixtures.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('.'), temp=await mkdtemp(path.join(os.tmpdir(),'skill-zip-ui-'));
const good=path.join(temp,'single.zip'), bad=path.join(temp,'fictional-problem.zip'), corrupt=path.join(temp,'broken.zip');
await writeFile(good,makeZip([{name:'sample/SKILL.md'}]));
await writeFile(bad,makeZip([{name:'sample/SKILL.md'},{name:'nested/SKILL.md',mode:0o120777},{name:'<img src=x onerror=alert(1)>/SKILL.md'}]));
await writeFile(corrupt,'not a ZIP');
const server=createServer(async(req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://local').pathname);const file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end()}try{res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}))});
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),requests=[],errors=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}/web/zip.html`);
 assert.match(await page.locator('#guide').getAttribute('href'),/zip-clean-but-upload-fails\.md$/);
 assert.equal(await page.getByLabel('Choose ZIP').count(),1);
 await page.getByLabel('Choose ZIP').setInputFiles(bad);
 await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('need review'));
 assert.match(await page.locator('#results').innerText(),/Symbolic link/);
 assert.match(await page.locator('#results').innerText(),/SKILL\.md entries found: 3/);
 assert.equal(await page.locator('#results img').count(),0);
 await page.locator('#example').click();
 await page.waitForFunction(()=>document.querySelector('#results').textContent.includes('example/alias/SKILL.md'));
 assert.match(await page.locator('#filename').innerText(),/Fictional example/);
 await page.screenshot({path:path.join(os.tmpdir(),'skill-zip-desktop.png'),fullPage:true});
 await page.locator('#language').click();
 assert.match(await page.locator('#guide').getAttribute('href'),/zip-clean-but-upload-fails\.zh-CN\.md$/);
 assert.match(await page.locator('#summary').innerText(),/需要检查/);
 assert.match(page.url(),/lang=zh/);
 await page.screenshot({path:path.join(os.tmpdir(),'skill-zip-desktop-zh.png'),fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844}});
 mobile.on('request',r=>requests.push({url:r.url(),method:r.method()}));mobile.on('pageerror',e=>errors.push(String(e)));
 await mobile.goto(`http://127.0.0.1:${server.address().port}/web/zip.html?lang=zh`);
 await mobile.getByRole('button',{name:'试用虚构示例'}).click();
 await mobile.waitForFunction(()=>document.querySelector('#summary').textContent.includes('需要检查'));
 assert.match(await mobile.locator('#filename').innerText(),/虚构示例/);
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mobile.screenshot({path:path.join(os.tmpdir(),'skill-zip-mobile.png'),fullPage:true});await mobile.close();
 await page.getByLabel('选择 ZIP').setInputFiles(good);
 await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('未发现结构问题'));
 await page.getByLabel('选择 ZIP').setInputFiles(corrupt);
 await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('无法检查'));
 assert.equal(await page.locator('#results li').count(),0);
 // A slow earlier selection must not overwrite a later result.
 await page.evaluate(()=>{window.originalArrayBuffer=Blob.prototype.arrayBuffer;let first=true;Blob.prototype.arrayBuffer=function(){if(first){first=false;return new Promise(r=>setTimeout(()=>r(window.originalArrayBuffer.call(this)),200))}return window.originalArrayBuffer.call(this)}});
 await page.getByLabel('选择 ZIP').setInputFiles(bad);
 await page.getByLabel('选择 ZIP').setInputFiles(good);
 await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('未发现结构问题'));
 await page.waitForTimeout(300);
 assert.match(await page.locator('#summary').innerText(),/未发现结构问题/);
 await page.evaluate(()=>{Blob.prototype.arrayBuffer=window.originalArrayBuffer});
 await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
 if(process.env.REAL_OLD_ZIP&&process.env.REAL_FIXED_ZIP&&process.env.REAL_PERSONAL_ZIP){
  await page.getByLabel('选择 ZIP').setInputFiles(process.env.REAL_OLD_ZIP);
  await page.waitForFunction(()=>document.querySelector('#results').textContent.includes('符号链接'));
  assert.match(await page.locator('#results').innerText(),/发现 2 个 SKILL\.md/);
  for(const file of [process.env.REAL_FIXED_ZIP,process.env.REAL_PERSONAL_ZIP]){
   await page.getByLabel('选择 ZIP').setInputFiles(file);
   await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('未发现结构问题'));
   assert.equal(await page.locator('#count').innerText(),'0');
  }
 }
 assert(requests.every(r=>r.method==='GET'&&r.url.startsWith(`http://127.0.0.1:${server.address().port}/`)));
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS: single ZIP, findings, invalid ZIP, language, mobile, local GET only');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true})}
