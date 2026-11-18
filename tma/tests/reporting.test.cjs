const test = require('node:test');
const assert = require('node:assert/strict');
const { initReporting, reportError, safeEvent, flush } = require('../monitoring');
const Sentry = require('@sentry/node');
const envelopes = [];
initReporting({enabled:true,transport:()=>({send: envelope=>{envelopes.push(envelope);return Promise.resolve({statusCode:200});},flush:()=>Promise.resolve(true)})});
test('final real-SDK envelope excludes all disallowed canaries and attachments', async()=>{
 const canary='PRIVATE_CANARY_123';
 Sentry.setUser({email:canary}); Sentry.setContext('secret',{payload:canary});
 Sentry.addBreadcrumb({message:canary}); Sentry.getCurrentScope().addAttachment({filename:canary,data:canary});
 Sentry.captureEvent({message:canary,exception:{values:[{type:canary,value:canary,stacktrace:{frames:[{filename:canary,vars:{x:canary}}]}}]},request:{url:'https://example.invalid/?secret='+canary,headers:{Authorization:canary},data:canary},extra:{x:canary},tags:{boundary:'api.stats',secret:canary},contexts:{secret:{secret:canary}},user:{id:canary}},{attachments:[{filename:canary,data:canary}]});
 await flush(2000);
 const wire=JSON.stringify(envelopes);assert.equal(wire.includes(canary),false,wire);
 const items=envelopes.flatMap(e=>e[1]);assert.equal(items.length,1);assert.equal(items[0][0].type,'event');
 assert.equal(items[0][1].tags.boundary,'api.stats');
 assert.deepEqual(Object.keys(items[0][1]).sort(),['event_id','fingerprint','level','message','sdk','tags','timestamp','type']);
});
test('boundary allowlist rejects arbitrary input',async()=>{
 await reportError('token=PRIVATE_CANARY');await reportError('api.webhook');await flush(2000);
 assert.equal(envelopes.length,2);assert.equal(envelopes[1][1][0][1].tags.boundary,'api.webhook');
 const hint={attachments:[{filename:'secret',data:'secret'}]};const safe=safeEvent({tags:{boundary:'raw-user-input'},message:'secret'},hint);
 assert.equal(safe.tags.boundary,'unhandled');assert.deepEqual(hint.attachments,[]);
});

test('helper isolates SDK init and capture failures', async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 for(const failure of ['init','capture','hang']){
  const fake={init(){if(failure==='init')throw Error('sdk down')},onUncaughtExceptionIntegration(){return {}},onUnhandledRejectionIntegration(){return {}},captureEvent(){if(failure==='capture')throw Error('sdk down')},flush(){return failure==='hang'?new Promise(()=>{}):Promise.reject(Error('sdk rejected'))}};
  const sandbox={module:{exports:{}},require:()=>fake,process:{env:{NODE_ENV:'test'}},Set,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(require.resolve('../monitoring'),'utf8'),sandbox);
  assert.doesNotThrow(()=>sandbox.module.exports.initReporting({enabled:true}));
  const began=Date.now();
  await assert.doesNotReject(()=>sandbox.module.exports.reportError('api.webhook'));
  assert.ok(Date.now()-began<1000,'outer deadline exceeded');
 }
});

test('untrusted event identity/timestamp cannot carry free text',()=>{const e=safeEvent({event_id:'PRIVATE_ID',timestamp:'PRIVATE_TIME'});assert.equal(e.event_id,undefined);assert.equal(typeof e.timestamp,'number');assert.ok(Math.abs(e.timestamp-Date.now()/1000)<1);});

test('development is inert without explicit test enablement',()=>{
 const vm=require('node:vm'),fs=require('node:fs');let calls=0;
 const fake={init(){calls++}};
 const box={module:{exports:{}},require:()=>fake,process:{env:{NODE_ENV:'development'}},Set,setTimeout,clearTimeout};box.exports=box.module.exports;
 vm.runInNewContext(fs.readFileSync(require.resolve('../monitoring'),'utf8'),box);box.module.exports.initReporting();assert.equal(calls,0);
});
