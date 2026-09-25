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
    print('Preview: http://127.0.0.1:8765/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
