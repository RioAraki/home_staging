#!/usr/bin/env python3
"""
Dev server for sprite + level tools.
Serves the project root as static files on port 8777, plus:
  GET  /api/sheets     — list the *.png sprite sheets in asset/
  POST /api/crop       — save <stem>.annotations.json and re-run crop.py for one sheet
  GET  /api/scenarios  — list level scenarios (md/scenarios/*.json)
  POST /api/scenario   — save one scenario JSON + rebundle maps_data.yaml/json
"""
import json, os, re, subprocess, sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8777

CROP_SCRIPT = os.path.join(ROOT, 'tools', 'sprite-annotator', 'crop.py')
ASSET_DIR   = os.path.join(ROOT, 'asset')
OUT_DIR     = os.path.join(ASSET_DIR, 'tiles')

SCEN_DIR    = os.path.join(ROOT, 'md', 'scenarios')
COCOS_TOOLS = os.path.join(ROOT, 'cocos', 'home-staging-cocos', 'tools')
BUNDLE_JS   = os.path.join(COCOS_TOOLS, 'scenarios-bundle.cjs')
YAML2JSON_JS = os.path.join(COCOS_TOOLS, 'yaml2json.cjs')
SLUG_RE     = re.compile(r'^[a-z0-9_]+$')


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
        route = self.path.split('?', 1)[0]
        if route == '/api/sheets':
            self._handle_sheets()
        elif route == '/api/scenarios':
            self._handle_scenarios()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/crop':
            self._handle_crop()
        elif self.path == '/api/scenario':
            self._handle_save_scenario()
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

    # ── level scenarios ──────────────────────────────────────────────────
    def _read_index(self):
        idx_path = os.path.join(SCEN_DIR, '_index.json')
        if os.path.isfile(idx_path):
            with open(idx_path, encoding='utf-8') as f:
                return json.load(f)
        return []

    def _handle_scenarios(self):
        try:
            index = self._read_index()
            on_disk = sorted(
                f[:-5] for f in os.listdir(SCEN_DIR)
                if f.endswith('.json') and f != '_index.json'
            ) if os.path.isdir(SCEN_DIR) else []
            ordered = list(index) + [i for i in on_disk if i not in index]
            out = []
            for sid in ordered:
                p = os.path.join(SCEN_DIR, f'{sid}.json')
                if not os.path.isfile(p):
                    continue
                try:
                    with open(p, encoding='utf-8') as f:
                        s = json.load(f)
                    out.append({'id': sid, 'title_zh': s.get('title_zh', ''),
                                'difficulty': s.get('difficulty', '')})
                except Exception:
                    out.append({'id': sid, 'title_zh': '(parse error)', 'difficulty': ''})
            self._send_json(200, {'ok': True, 'scenarios': out})
        except Exception as e:
            self._send_json(500, {'ok': False, 'error': str(e)})

    def _handle_save_scenario(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length))
            sid = (data.get('id') or '').strip()
            if not SLUG_RE.match(sid):
                raise RuntimeError(f'invalid scenario id (need slug [a-z0-9_]): {sid!r}')

            os.makedirs(SCEN_DIR, exist_ok=True)
            path = os.path.join(SCEN_DIR, f'{sid}.json')
            is_new = not os.path.isfile(path)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write('\n')

            # keep _index.json append-only for new ids (preserve existing order)
            index = self._read_index()
            if sid not in index:
                index.append(sid)
                with open(os.path.join(SCEN_DIR, '_index.json'), 'w', encoding='utf-8') as f:
                    json.dump(index, f, ensure_ascii=False, indent=2)
                    f.write('\n')

            # rebundle md/maps_data.yaml then regenerate cocos JSON
            for script in (BUNDLE_JS, YAML2JSON_JS):
                r = subprocess.run(['node', script], capture_output=True, text=True)
                print(r.stdout.strip())
                if r.returncode != 0:
                    raise RuntimeError(f'{os.path.basename(script)} failed: {r.stderr.strip()}')

            print(f'[scenario] saved {sid} ({"new" if is_new else "update"}) + rebuilt')
            self._send_json(200, {'ok': True, 'id': sid, 'new': is_new})
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
    print(f'  GET  /api/sheets     → list asset/*.png')
    print(f'  POST /api/crop       → annotate + crop one sheet (shared tiles/)')
    print(f'  GET  /api/scenarios  → list md/scenarios/*.json')
    print(f'  POST /api/scenario   → save one scenario + rebundle')
    httpd.serve_forever()
