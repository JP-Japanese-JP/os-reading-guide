'use strict';
const crypto=require('node:crypto');
const tokenKeys=['access_token','refresh_token','id_token','expiresAt','expires_in','scope','token_type'];
function profileId(client){return 'account-'+crypto.createHash('sha256').update(client).digest('hex').slice(0,20);}
function normalize(state){
 if(state.version&&state.version!==2)throw Error('対応していない認証設定の形式です。');
 if(state.version===2){if(!state.host||!Array.isArray(state.profiles))throw Error('認証設定の形式が不正です。');return state;}
 const {host,...legacy}=state;
 const profiles=legacy.client_id?[{...legacy,id:profileId(legacy.client_id),label:'接続1'}]:[];
 return {version:2,host:host||'urn:uuid:'+crypto.randomUUID(),activeId:profiles[0]?.id||'',profiles};
}
function active(state){return state.profiles.find(p=>p.id===state.activeId);}
function status(state){const p=active(state);return {signedIn:!!p?.access_token,email:p?.email||'',accountId:p?.id||'',profiles:state.profiles.map((p,index)=>({id:p.id,label:'接続'+(index+1),email:p.email||'',signedIn:!!p.access_token,active:p.id===state.activeId}))};}
function authorization(state,selected,{redirect,state:csrf,nonce,verifier}){
 const params=new URLSearchParams({client_id:selected?.client_id||'dynamic_agent_client',ext_agent_host_id:state.host,response_type:'code',redirect_uri:redirect,scope:'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',resource:'https://api.openai.com/v1',state:csrf,nonce,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
 if(!selected)params.set('agent_name_hint','OS Reading Guide');
 else if(selected.id_token)params.set('id_token_hint',selected.id_token);
 return params;
}
function clearTokens(profile){const next={...profile};for(const k of tokenKeys)delete next[k];return next;}
function assertAccount(state,id){const p=active(state);if(!p||id!==p.id)throw Error('ChatGPTアカウントが変更されました。AI設定を開き、モデルとクレジット利用OFFを確認して設定を保存してください。');return p;}
module.exports={normalize,active,status,authorization,clearTokens,assertAccount,profileId};
