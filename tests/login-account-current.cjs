const H=require('../native/host.cjs'),A=require('../native/accounts.cjs'),fs=require('fs');
(async()=>{
 const before=await H.read(),previous=A.active(before);
 console.log('公式認証画面を開きます。希望するChatGPT Plusアカウントを選択してください。認証URL・トークンは表示しません。');
 const result=await H.handle({action:'switch_account'}),after=await H.read(),current=A.active(after);
 const models=await H.handle({action:'models',accountId:result.accountId});
 const report={date:'2026-11-02',signedIn:result.signedIn,activeRegistrationChanged:before.activeId!==after.activeId,identityChanged:previous?.subject!==current.subject,hostPreserved:before.host===after.host,previousRegistrationPreserved:after.profiles.some(p=>p.id===previous?.id&&p.client_id===previous.client_id&&p.subject===previous.subject),savedRegistrations:after.profiles.length,modelsRetrieved:true,modelCount:models.models.length,gpt61SolAvailable:models.models.some(m=>m.slug==='gpt-6.1-sol'),generationPerformed:false};
 fs.writeFileSync('tests/evidence/account-switch-live-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{const error=/^[一-龯ぁ-んァ-ヶ]/u.test(e.message)?e.message:'認証確認に失敗しました。認証情報は出力していません。';fs.writeFileSync('tests/evidence/account-switch-live-report.json',JSON.stringify({date:'2026-11-02',ok:false,error,generationPerformed:false},null,2));console.log(error);process.exitCode=1;});
