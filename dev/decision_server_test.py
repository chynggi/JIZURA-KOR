"""Offline tests for the local decision server. usage: python3 dev/decision_server_test.py"""
import http.client, http.server, json, sys, threading, unittest, urllib.error, urllib.request
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
        keys = ['calm', 'pop', 'x']
        self.assertEqual(ds.letter_to_key('A.', keys), 'calm')
        self.assertEqual(ds.letter_to_key(' b', keys), 'pop')
        self.assertEqual(ds.letter_to_key('**B**', keys), 'pop')
        self.assertEqual(ds.letter_to_key('(C)', keys), 'x')
        self.assertEqual(ds.letter_to_key('Answer: C', keys), 'x')
        self.assertEqual(ds.letter_to_key('The answer is B', keys), 'pop')
        self.assertEqual(ds.letter_to_key('answer: b.', keys), 'pop')
        self.assertIsNone(ds.letter_to_key('Apple', keys))
        self.assertIsNone(ds.letter_to_key('A or B', keys))
        self.assertIsNone(ds.letter_to_key('Z', keys))
        self.assertIsNone(ds.letter_to_key('', keys))
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
    def raw_post(self, content_length, body=b'{}', timeout=3):
        """Send a POST with a literal (possibly malformed) Content-Length header. Returns the status code,
        or None if the connection was dropped or timed out instead of getting a response."""
        conn = http.client.HTTPConnection('127.0.0.1', self.srv.server_port, timeout=timeout)
        try:
            conn.connect()
            conn.putrequest('POST', '/api/decide', skip_host=True, skip_accept_encoding=True)
            conn.putheader('Host', '127.0.0.1')
            conn.putheader('Content-Type', 'application/json')
            conn.putheader('Content-Length', content_length)
            conn.endheaders()
            conn.send(body)
            resp = conn.getresponse()
            status = resp.status
            resp.read()
        except (http.client.HTTPException, OSError):
            status = None
        finally:
            conn.close()
        return status
    def test_malformed_content_length_non_numeric(self):
        self.assertEqual(self.raw_post('abc'), 400)
    def test_malformed_content_length_negative(self):
        self.assertEqual(self.raw_post('-1'), 400)
    def test_questions_not_dict(self):
        code, _ = self.post(json.dumps({'state': STATE, 'questions': 'nope'}).encode())
        self.assertEqual(code, 400)
    def test_question_value_not_dict(self):
        code, _ = self.post(json.dumps({'state': STATE, 'questions': {'mood': 'nope'}}).encode())
        self.assertEqual(code, 400)
    def test_choice_criteria_not_dict(self):
        bad_q = {'mood': {'type': 'choice', 'instructions': 'x', 'criteria': 'nope'}}
        code, _ = self.post(json.dumps({'state': STATE, 'questions': bad_q}).encode())
        self.assertEqual(code, 400)
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
        with urllib.request.urlopen(self.base + '/index.html?v=1') as r: self.assertIn(b'<html', r.read()[:200].lower())
        with self.assertRaises(urllib.error.HTTPError): urllib.request.urlopen(self.base + '/decision_server.py')

class BadShapes(unittest.TestCase):
    """예상 밖 모양의 백엔드 응답은 연결을 끊지 말고 한국어 502로 답해야 한다."""
    MSG = '결정 모델 서버의 응답을 처리하지 못했습니다'
    def run_case(self, backend, reply):
        Fake.seen = []; Fake.reply = reply
        fake = start(Fake)
        path = '/v1/systemone' if backend == 'systemone' else '/v1/chat/completions'
        srv = ds.make_server('127.0.0.1', 0, env={'DECISION_BACKEND': backend, 'DECISION_URL': f'http://127.0.0.1:{fake.server_port}{path}'})
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            req = urllib.request.Request(f'http://127.0.0.1:{srv.server_port}/api/decide', data=json.dumps({'state': STATE, 'questions': Q}).encode(), method='POST', headers={'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(req, timeout=5) as r: return r.status, json.loads(r.read())
            except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
        finally: srv.shutdown(); srv.server_close(); fake.shutdown(); fake.server_close()
    def test_llm_content_is_list(self):
        code, data = self.run_case('llm', lambda body: (200, {'choices': [{'message': {'content': ['B']}}]}))
        self.assertEqual((code, data), (502, {'error': self.MSG}))
    def test_systemone_response_not_dict(self):
        code, data = self.run_case('systemone', lambda body: (200, ['answers']))
        self.assertEqual((code, data), (502, {'error': self.MSG}))

if __name__ == '__main__': unittest.main()
