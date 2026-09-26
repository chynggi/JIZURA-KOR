"""Local browser preview: python preview_server.py (no external API)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parent), **kwargs)

    def do_GET(self):
        if self.path.split('?', 1)[0] not in ('/', '/index.html', '/en/', '/en/index.html', '/favicon.ico'):
            self.send_error(404)
            return
        super().do_GET()


if __name__ == '__main__':
    print('Preview: http://127.0.0.1:8766/', flush=True)   # 8765 is the decision server's default (it serves the app too)
    ThreadingHTTPServer(('127.0.0.1', 8766), Handler).serve_forever()
