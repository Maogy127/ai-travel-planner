/* Wu Xing play copy and community element tags, without a browser. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={console,Date,Intl,Set,Map,JSON};c.window=c;c.globalThis=c;vm.createContext(c);
for(const file of ['v2','pickcatalog','elements','oahu','community'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),c);
vm.runInContext(fs.readFileSync('js/community-examples.js','utf8'),c);
vm.runInContext(fs.readFileSync('js/wuxing.js','utf8'),c);
const tag=c.GoNowCommunity.tagPost(c.GONOW_COMMUNITY_EXAMPLES[0]);
assert.deepEqual(tag.elements,['water','fire','wood','wind','earth']);
assert.equal(tag.allFive,true);
const lisbon=c.GoNowCommunity.tagPost(c.GONOW_COMMUNITY_EXAMPLES[1]);
assert.equal(lisbon.allFive,false);
assert(lisbon.elements.includes('earth')&&lisbon.elements.includes('wood'));
const W=c.GoNowWuXing;
const text=W.challengeText('water',[{title:'Kahala Beach sunset photos',kind:'sight'}]);
assert(/water/i.test(text)&&/only as deep as feels easy/.test(text));
assert(!/north shore|swim out|cliff/i.test(text));
assert.equal(W.summaryLine({checks:{},challenges:{},badges:{}}),'Check in a few stops and this recap will fill in.');
console.log('PASS community tags and safe challenge copy', tag.elements.join(','), 'lisbon', lisbon.elements.join(','));
