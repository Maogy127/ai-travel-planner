"""Static test server. Serves an empty Google Places key so suites never call the live API
(set GONOW_LIVE_PLACES=1 to use the real js/places-config.js)."""
import os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
EMPTY = b"window.GONOW_PLACES_CONFIG = { GOOGLE_PLACES_KEY: '' };\n"
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.split('?')[0].endswith('/js/places-config.js') and os.environ.get('GONOW_LIVE_PLACES') != '1':
            self.send_response(200); self.send_header('Content-Type', 'text/javascript'); self.send_header('Content-Length', str(len(EMPTY))); self.end_headers(); self.wfile.write(EMPTY); return
        super().do_GET()
if __name__ == '__main__':
    ThreadingHTTPServer((sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1', int(sys.argv[1])), Handler).serve_forever()
