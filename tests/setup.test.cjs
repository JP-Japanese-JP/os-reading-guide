const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {detect}=require('../scripts/detect-extension.cjs');
test('setup detects only this unpacked folder across Chrome profiles',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'osrg-detect-'));
 const target=path.join(root,'WORKSPACE','extension');
 const old=path.join(root,'OneDrive','extension');
 const currentId='b'.repeat(32),oldId='a'.repeat(32);
 for(const profile of ['Default','Profile 1'])fs.mkdirSync(path.join(root,profile));
 fs.writeFileSync(path.join(root,'Default','Secure Preferences'),JSON.stringify({extensions:{settings:{[currentId]:{path:target},[oldId]:{path:old}}}}));
 fs.writeFileSync(path.join(root,'Profile 1','Preferences'),JSON.stringify({extensions:{settings:{[currentId]:{path:target}}}}));
 assert.deepEqual(detect(target,root),[currentId]);
 assert.deepEqual(detect(path.join(root,'other'),root),[]);
 fs.writeFileSync(path.join(root,'Default','Preferences'),'invalid');
 assert.deepEqual(detect(target,root),[currentId]);
 // Verify the exact temporary directory before recursive test cleanup.
 assert.ok(root.startsWith(path.join(os.tmpdir(),'osrg-detect-')));fs.rmSync(root,{recursive:true});
});
test('Japanese setup scripts parse in Windows PowerShell 5.1 with UTF-8 BOM',()=>{
 for(const file of ['scripts/install-helper.ps1','scripts/uninstall-helper.ps1']){
  assert.deepEqual([...fs.readFileSync(file).subarray(0,3)],[239,187,191]);
  const command='$tokens=$null;$errors=$null;[void][System.Management.Automation.Language.Parser]::ParseFile($env:OSRG_PARSE_FILE,[ref]$tokens,[ref]$errors);if($errors.Count){exit 1}';
  const result=cp.spawnSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',env:{...process.env,OSRG_PARSE_FILE:path.resolve(file)}});
  assert.equal(result.status,0,result.stderr);
 }
});

