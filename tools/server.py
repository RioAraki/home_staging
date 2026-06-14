#!/usr/bin/env python3
"""
Dev server for sprite tools.
Serves the project root as static files on port 8777, plus:
  GET  /api/sheets — list the *.png sprite sheets in asset/
  POST /api/crop   — save <stem>.annotations.json and re-run crop.py for one sheet
"""
import json, os, subprocess, sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8777

CROP_SCRIPT = os.path.join(ROOT, 'tools', 'sprite-annotator', 'crop.py')
ASSET_DIR   = os.path.join(ROOT, 'asset')
OUT_DIR     = os.path.join(ASSET_DIR, 'tiles')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        print(fmt % args)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.split('?', 1)[0] == '/api/sheets':
            self._handle_sheets()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/crop':
            self._handle_crop()
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

    def _send_json(self, status, payload):
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode())

    def _resolve_sheet(self, image_name):
        """Resolve a client-supplied image name to an absolute path inside
        asset/. Rejects path traversal and missing files."""
        name = os.path.basename((image_name or 'asset.png').strip())
        path = os.path.realpath(os.path.join(ASSET_DIR, name))
        if os.path.commonpath([path, os.path.realpath(ASSET_DIR)]) != os.path.realpath(ASSET_DIR):
            raise RuntimeError(f'invalid image path: {image_name!r}')
        if not os.path.isfile(path):
            raise RuntimeError(f'image not found in asset/: {name}')
        return name, path

    def _handle_sheets(self):
        try:
            sheets = sorted(
                f for f in os.listdir(ASSET_DIR)
                if f.lower().endswith('.png') and os.path.isfile(os.path.join(ASSET_DIR, f))
            )
            self._send_json(200, {'ok': True, 'sheets': sheets})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    def _handle_crop(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)

            # which sheet — honour the client's `image` field (defaults asset.png)
            sheet_name, img_path = self._resolve_sheet(data.get('image'))
            stem = os.path.splitext(sheet_name)[0]
            ann_path = os.path.join(ASSET_DIR, f'{stem}.annotations.json')

            # save this sheet's annotations
            os.makedirs(ASSET_DIR, exist_ok=True)
            with open(ann_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f'[crop] {sheet_name}: saved {len(data.get("annotations", []))} annotations')

            # run crop.py for this sheet into the shared tiles dir
            result = subprocess.run(
                [sys.executable, CROP_SCRIPT, ann_path, img_path, OUT_DIR],
                capture_output=True, text=True
            )
            print(result.stdout.strip())
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip())

            # read updated (shared) tiles list
            tiles_json = os.path.join(OUT_DIR, 'tiles.json')
            with open(tiles_json, encoding='utf-8') as f:
                tiles = json.load(f)

            self._send_json(200, {'ok': True, 'tiles': tiles})

        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


if __name__ == '__main__':
    os.chdir(ROOT)
    httpd = HTTPServer(('', PORT), Handler)
    print(f'Sprite tools server → http://localhost:{PORT}')
    print(f'  Static root : {ROOT}')
    print(f'  GET  /api/sheets  → list asset/*.png')
    print(f'  POST /api/crop    → annotate + crop one sheet (shared tiles/)')
    httpd.serve_forever()
