const {test}=require('node:test'),a=require('node:assert/strict'),H=require('../native/host.cjs'),A=require('../native/accounts.cjs');
const crypto=require('node:crypto');
const legacy={host:'urn:uuid:synthetic-host',client_id:'old-client',subject:'old-user',email:'old@example.invalid',access_token:'old-access',refresh_token:'old-refresh',id_token:'old-id-token',scope:'chatgpt.tokens.use.direct',expiresAt:Date.now()+3600000};
const clone=x=>structuredClone(x);
function pending(state,selected){return A.authorization(state,selected,{redirect:'http://127.0.0.1:12345/auth/callback',state:'csrf',nonce:'nonce',verifier:'verifier'});}
test('legacy account migrates without losing credentials or changing host identity',()=>{
 const s=A.normalize(clone(legacy));a.equal(s.host,legacy.host);a.equal(A.active(s).access_token,'old-access');a.equal(A.active(s).client_id,'old-client');a.equal(A.normalize(clone(legacy)).activeId,s.activeId);
 const safe=A.status(s);for(const k of ['access_token','refresh_token','id_token','client_id','subject'])a.ok(!JSON.stringify(safe).includes('"'+k+'"'));
 a.equal(safe.profiles.length,1);a.equal(safe.signedIn,true);
});
test('new account omits previous registration and hints, returning login retains exact binding',()=>{
 const s=A.normalize(clone(legacy)),fresh=pending(s),returning=pending(s,A.active(s));
 a.equal(fresh.get('client_id'),'dynamic_agent_client');a.equal(fresh.get('agent_name_hint'),'OS Reading Guide');a.equal(fresh.has('id_token_hint'),false);a.equal(fresh.has('login_hint'),false);a.equal(fresh.get('ext_agent_host_id'),legacy.host);
 a.equal(returning.get('client_id'),'old-client');a.equal(returning.get('id_token_hint'),'old-id-token');a.equal(returning.has('agent_name_hint'),false);
 const signedOut=A.clearTokens(A.active(s));a.equal(signedOut.client_id,'old-client');a.equal(signedOut.subject,'old-user');a.equal(pending(s,signedOut).has('id_token_hint'),false);
 a.throws(()=>A.assertAccount(s,'other-registration'),/変更/);
});
async function flow({newAccount=true,identity={sub:'new-user',email:'new@example.invalid'},callbackClient='new-client',oauthError,failExchange=false,scope='chatgpt.tokens.use.direct'}={}){
 const state=A.normalize(clone(legacy)),saved=[];let params,body;
 const promise=H.login(state,{newAccount},{
  write:async s=>saved.push(clone(s)),timeoutMs:2000,
  open:async url=>{params=new URL(url).searchParams;const callback=new URL(params.get('redirect_uri'));callback.searchParams.set('state',params.get('state'));if(oauthError)callback.searchParams.set('error',oauthError);else{callback.searchParams.set('code','synthetic-code');callback.searchParams.set('client_id',callbackClient);}const bad=new URL(callback);bad.searchParams.set('state','incorrect');a.equal((await fetch(bad)).status,400);await fetch(callback);},
  exchange:async b=>{body=b;if(failExchange)throw Error('synthetic exchange failure');return {access_token:'new-access',refresh_token:'new-refresh',id_token:'synthetic-id',scope,expires_in:3600};},
  verify:async()=>identity
 });
 try{return {result:await promise,state,saved,params,body};}catch(error){return {error,state,saved,params,body};}
}
test('new registration becomes active only after verification; failed sign-in preserves old account',async()=>{
 const r=await flow();a.equal(r.error,undefined);a.equal(r.params.get('client_id'),'dynamic_agent_client');a.equal(r.body.client_id,'new-client');a.equal(r.body.redirect_uri,r.params.get('redirect_uri'));a.ok(r.body.code_verifier);
 a.equal(r.state.profiles.length,2);a.equal(A.active(r.state).subject,'new-user');a.equal(r.state.profiles[0].refresh_token,'old-refresh');
 a.ok(r.saved.slice(0,-1).every(s=>s.activeId===s.profiles[0].id));a.equal(A.status(r.saved.at(-1)).signedIn,true);
 const failed=await flow({failExchange:true});a.ok(failed.error);a.equal(A.active(failed.state).subject,'old-user');a.equal(A.active(failed.state).access_token,'old-access');a.ok(!failed.state.profiles[1].access_token);
});
test('mismatching identity and client never replace saved credentials',async()=>{
 for(const options of [{newAccount:true,callbackClient:'old-client',identity:{sub:'different-user'}},{newAccount:false,callbackClient:'old-client',identity:{sub:'different-user'}},{newAccount:false,callbackClient:'different-client'}]){
  const r=await flow(options);a.ok(r.error);a.ok(r.saved.every(s=>A.active(s).access_token==='old-access'));a.equal(A.active(r.state).subject,'old-user');
 }
 const denied=await flow({oauthError:'3p_login_workspace_scope_denied'});a.match(denied.error.message,/切り替える/);a.equal(denied.body,undefined);a.equal(denied.state.profiles.length,1);
});
test('DPAPI envelope restores multiple separate accounts and active selection',async()=>{
 const result=await flow();const cipher=await H.protect(JSON.stringify(result.state),'protect');
 a.ok(!cipher.includes('new-access'));const restored=A.normalize(JSON.parse(await H.protect(cipher,'unprotect')));
 a.equal(restored.host,legacy.host);a.equal(A.active(restored).client_id,'new-client');a.equal(restored.profiles[0].refresh_token,'old-refresh');
 restored.activeId=restored.profiles[0].id;a.equal(A.active(restored).access_token,'old-access');a.throws(()=>A.assertAccount(restored,result.state.activeId),/変更/);
});


test('missing plan permission never activates or replaces the previous account',async()=>{const r=await flow({scope:'openid profile'});a.ok(r.error);a.equal(A.active(r.state).subject,'old-user');a.equal(A.active(r.state).access_token,'old-access');a.ok(!r.state.profiles[1].access_token);});

test('status repairs display labels without modifying saved credentials',()=>{const s=A.normalize(clone(legacy));s.profiles[0].label='接綁E';const before=JSON.stringify(s);a.equal(A.status(s).profiles[0].label,'接続1');a.equal(JSON.stringify(s),before);});
