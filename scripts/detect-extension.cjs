const fs=require('node:fs'),path=require('node:path');
function detect(extensionPath,userDataRoot){
 const target=path.resolve(extensionPath).replace(/[\\/]+$/,'').toLowerCase(),ids=new Set();
 if(!fs.existsSync(userDataRoot))return [];
 for(const name of fs.readdirSync(userDataRoot).filter(s=>s==='Default'||/^Profile \d+$/.test(s))){
  for(const file of ['Preferences','Secure Preferences']){
   let settings;try{settings=JSON.parse(fs.readFileSync(path.join(userDataRoot,name,file),'utf8')).extensions?.settings||{};}catch{continue;}
   for(const [id,e] of Object.entries(settings)){
    if(!/^[a-p]{32}$/.test(id)||typeof e.path!=='string'||!path.isAbsolute(e.path))continue;
    if(path.resolve(e.path).replace(/[\\/]+$/,'').toLowerCase()===target)ids.add(id);
   }
  }
 }
 return [...ids].sort();
}
module.exports={detect};
if(require.main===module)console.log(JSON.stringify(detect(process.argv[2],process.argv[3])));
