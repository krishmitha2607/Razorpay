from pathlib import Path
import subprocess, sys, os

ROOT=Path(__file__).resolve().parent
FRONT=ROOT/'frontend'

def run(cmd,cwd=None):
    print('>', ' '.join(map(str,cmd)))
    subprocess.check_call(cmd,cwd=cwd)

if '--setup' in sys.argv:
    try:
        import fastapi, uvicorn
    except Exception:
        run([sys.executable,'-m','pip','install','-r',str(ROOT/'backend'/'requirements.txt')])
    if not (FRONT/'node_modules').exists(): run(['npm','install'],cwd=FRONT)
    run(['npm','run','build'],cwd=FRONT)
    print('\nSetup complete. Run: python run.py')
    raise SystemExit(0)

if not (FRONT/'dist').exists():
    print('Frontend build not found. Running setup first...')
    run([sys.executable,str(ROOT/'run.py'),'--setup'])

os.chdir(ROOT)
from uvicorn import run as uv_run
print('\nRevX-Agent running at http://127.0.0.1:8000')
print('API docs: http://127.0.0.1:8000/docs\n')
uv_run('backend.app:app',host='127.0.0.1',port=8000,reload=False)
