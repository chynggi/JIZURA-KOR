"""Offline tests for the local decision server. usage: python3 dev/decision_server_test.py"""
import http.server, json, sys, threading, unittest, urllib.error, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import decision_server as ds

Q = {'mood': {'type': 'choice', 'instructions': '분위기를 고른다', 'criteria': {'calm': '잔잔함', 'pop': '경쾌함'}}}
STATE = {'lyrics': '밤하늘'}

class Fake(http.server.BaseHTTPRequestHandler):
    seen = []
    reply = None
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        Fake.seen.append({'path': self.path, 'auth': self.headers.get('Authorization'), 'body': body})
        code, data = Fake.reply(body)
        raw = json.dumps(data).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)

def start(handler):
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

class Pure(unittest.TestCase):
    def test_prompt_letters(self):
        prompt, keys = ds.to_letter_prompt(STATE, Q['mood'])
        self.assertEqual(keys, ['calm', 'pop'])
        self.assertIn('State\n', prompt); self.assertIn('Question\n분위기를 고른다', prompt)
        self.assertIn('A: calm: 잔잔함', prompt); self.assertIn('B: pop: 경쾌함', prompt)
        self.assertTrue(prompt.rstrip().endswith('Answer with one letter only.'))
    def test_letter_to_key(self):
        self.assertEqual(ds.letter_to_key(' b', ['calm', 'pop']), 'pop')
        self.assertEqual(ds.letter_to_key('A.', ['calm', 'pop']), 'calm')
        self.assertIsNone(ds.letter_to_key('Z', ['calm', 'pop']))
        self.assertIsNone(ds.letter_to_key('', ['calm', 'pop']))
    def test_too_many_options(self):
        many = {'type': 'choice', 'instructions': 'x', 'criteria': {f'k{i}': str(i) for i in range(25)}}
        with self.assertRaises(ds.BackendError): ds.to_letter_prompt(STATE, many)

class Backends(unittest.TestCase):
    def setUp(self): Fake.seen = []
    def test_systemone_forwards(self):
        Fake.reply = lambda body: (200, {'answers': {'mood': {'type': 'choice', 'choice': 'pop'}}})
        srv = start(Fake)
        try:
            env = {'DECISION_BACKEND': 'systemone', 'DECISION_URL': f'http://127.0.0.1:{srv.server_port}/v1/systemone', 'DECISION_API_KEY': 'k1'}
            out = ds.decide({'state': STATE, 'questions': Q}, env)
        finally: srv.shutdown()
        self.assertEqual(out, {'mood': {'type': 'choice', 'choice': 'pop'}})
        self.assertEqual(Fake.seen[0]['path'], '/v1/systemone')
        self.assertEqual(Fake.seen[0]['auth'], 'Bearer k1')
        self.assertEqual(Fake.seen[0]['body'], {'state': STATE, 'questions': Q})
    def test_llm_letters(self):
        Fake.reply = lambda body: (200, {'choices': [{'message': {'content': 'B'}}]})
        srv = start(Fake)
        try:
            env = {'DECISION_BACKEND': 'llm', 'DECISION_URL': f'http://127.0.0.1:{srv.server_port}/v1/chat/completions', 'DECISION_MODEL': 'tev1'}
            out = ds.decide({'state': STATE, 'questions': Q}, env)
        finally: srv.shutdown()
        self.assertEqual(out, {'mood': {'type': 'choice', 'choice': 'pop'}})
        body = Fake.seen[0]['body']
        self.assertEqual(body['model'], 'tev1'); self.assertEqual(body['temperature'], 0)
        self.assertEqual(body['max_tokens'], 2)
        self.assertIsNone(Fake.seen[0]['auth'])
    def test_llm_unknown_letter_skips_question(self):
        Fake.reply = lambda body: (200, {'choices': [{'message': {'content': 'Q'}}]})
        srv = start(Fake)
        try:
            out = ds.decide({'state': STATE, 'questions': Q}, {'DECISION_BACKEND': 'llm', 'DECISION_URL': f'http://127.0.0.1:{srv.server_port}/v1/chat/completions'})
        finally: srv.shutdown()
        self.assertEqual(out, {})
    def test_backend_down(self):
        with self.assertRaises(ds.BackendError):
            ds.decide({'state': STATE, 'questions': Q}, {'DECISION_BACKEND': 'systemone', 'DECISION_URL': 'http://127.0.0.1:9/v1/systemone'})
    def test_llm_tournament(self):
        Fake.reply = lambda body: (200, {'choices': [{'message': {'content': 'A'}}]})
        srv = start(Fake)
        big = {'type': 'choice', 'instructions': '스타일을 고른다', 'criteria': {f'k{i}': f'style {i}' for i in range(30)}}
        try:
            env = {'DECISION_BACKEND': 'llm', 'DECISION_URL': f'http://127.0.0.1:{srv.server_port}/v1/chat/completions'}
            out = ds.decide({'state': STATE, 'questions': {'style': big}}, env)
        finally: srv.shutdown()
        self.assertEqual(out, {'style': {'type': 'choice', 'choice': 'k0'}})
        self.assertEqual(len(Fake.seen), 3)
        final_prompt = Fake.seen[2]['body']['messages'][0]['content']
        options_line_start = final_prompt.index('Options\n')
        options_block = final_prompt[options_line_start:final_prompt.index('Answer with one letter only.')]
        option_lines = [l for l in options_block.splitlines() if l and ':' in l and l != 'Options']
        self.assertEqual(len(option_lines), 2)
        self.assertTrue(option_lines[0].startswith('A: k0'))
        self.assertTrue(option_lines[1].startswith('B: k24'))

class Http(unittest.TestCase):
    def setUp(self):
        self.srv = ds.make_server('127.0.0.1', 0, env={'DECISION_BACKEND': 'systemone', 'DECISION_URL': 'http://127.0.0.1:9/x'})
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.srv.server_port}'
    def tearDown(self): self.srv.shutdown()
    def post(self, data, origin=None):
        req = urllib.request.Request(self.base + '/api/decide', data=data, method='POST', headers={'Content-Type': 'application/json', **({'Origin': origin} if origin else {})})
        try:
            with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
    def test_too_large(self):
        self.assertEqual(self.post(b'{' + b' ' * 70000 + b'}')[0], 413)
    def test_bad_json(self):
        self.assertEqual(self.post(b'not json')[0], 400)
    def test_backend_error_is_502_korean(self):
        code, data = self.post(json.dumps({'state': STATE, 'questions': Q}).encode())
        self.assertEqual(code, 502); self.assertRegex(data['error'], '[가-힣]')
    def test_foreign_origin_rejected(self):
        self.assertEqual(self.post(b'{}', origin='https://evil.example')[0], 403)
    def test_preflight_pages_origin(self):
        req = urllib.request.Request(self.base + '/api/decide', method='OPTIONS', headers={'Origin': 'https://chynggi.github.io'})
        with urllib.request.urlopen(req) as r:
            self.assertEqual(r.status, 204)
            self.assertEqual(r.headers['Access-Control-Allow-Origin'], 'https://chynggi.github.io')
            self.assertEqual(r.headers['Access-Control-Allow-Private-Network'], 'true')
    def test_serves_index_only(self):
        with urllib.request.urlopen(self.base + '/') as r: self.assertIn(b'<html', r.read()[:200].lower())
        with self.assertRaises(urllib.error.HTTPError): urllib.request.urlopen(self.base + '/decision_server.py')

if __name__ == '__main__': unittest.main()
