"""Restore only the recorded B followup. Default is a read-only check."""
import argparse,hashlib,json,pathlib,shutil,subprocess,sys,datetime
pkg=pathlib.Path(__file__).resolve().parent
root=pkg.parents[1]
def digest(p):
 if not p.is_file():return None
 return hashlib.sha256(p.read_bytes().replace(b"\r\n",b"\n")).hexdigest()
def inside(base,rel):
 p=(base/rel).resolve()
 if not p.is_relative_to(base.resolve()):raise SystemExit('Unsafe path: '+rel)
 return p
args=argparse.ArgumentParser();args.add_argument('--check',action='store_true');args.add_argument('--apply',action='store_true');opts=args.parse_args()
m=json.loads((pkg/'manifest.json').read_text(encoding='utf8'));errors=[]
for f in m['files']:
 p=inside(root,f['path'])
 if digest(p)!=f['afterSha256']:errors.append(f['path']+' changed since package creation')
 if f['beforeSha256'] and digest(inside(pkg/'before',f['path']))!=f['beforeSha256']:errors.append(f['path']+' backup mismatch')
if errors:raise SystemExit('Nothing restored. Resolve these differences first:\n'+'\n'.join(errors))
print('CHECK OK:',len(m['files']),'files; A backups verified')
if not opts.apply:sys.exit(0)
archive=pkg/'archived-b'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
# All paths and hashes were checked before the first mutation. No Git operation.
for f in m['files']:
 current=inside(root,f['path']);saved=inside(archive,f['path']);saved.parent.mkdir(parents=True,exist_ok=True)
 if f['beforeSha256']:
  shutil.copy2(current,saved);shutil.copy2(inside(pkg/'before',f['path']),current)
 else:shutil.move(str(current),str(saved))
subprocess.run(['node','scripts/build.cjs'],cwd=root,check=True)
print('Restored A-centered data and code. B files archived at',archive)
