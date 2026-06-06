#!/usr/bin/env python3
"""
Dev server for sprite tools.
Serves the project root as static files on port 8777, plus:
  POST /api/crop  — save annotations.json and re-run crop.py
"""
import json, os, subprocess, sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8777

CROP_SCRIPT = os.path.join(ROOT, 'tools', 'sprite-annotator', 'crop.py')
ANN_PATH    = os.path.join(ROOT, 'asset', 'annotations.json')
IMG_PATH    = os.path.join(ROOT, 'asset', 'asset.png')
OUT_DIR     = os.path.join(ROOT, 'asset', 'tiles')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        print(fmt % args)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/crop':
            self._handle_crop()
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

    def _handle_crop(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)

            # save annotations.json
            os.makedirs(os.path.dirname(ANN_PATH), exist_ok=True)
            with open(ANN_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f'[crop] saved {len(data.get("annotations", []))} annotations')

            # run crop.py
            result = subprocess.run(
                [sys.executable, CROP_SCRIPT, ANN_PATH, IMG_PATH, OUT_DIR],
                capture_output=True, text=True
            )
            print(result.stdout.strip())
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip())

            # read updated tiles list
            tiles_json = os.path.join(OUT_DIR, 'tiles.json')
            with open(tiles_json, encoding='utf-8') as f:
                tiles = json.load(f)

            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'tiles': tiles}).encode())

        except Exception as e:
            self.send_response(500)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


if __name__ == '__main__':
    os.chdir(ROOT)
    httpd = HTTPServer(('', PORT), Handler)
    print(f'Sprite tools server → http://localhost:{PORT}')
    print(f'  Static root : {ROOT}')
    print(f'  POST /api/crop to annotate + crop in one step')
    httpd.serve_forever()
