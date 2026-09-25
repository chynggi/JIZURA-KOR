"""Serve JIZURA locally and forward 「AI로 고르기」 to a decision model running on this PC.

  systemone (default): Laya (laya-serve, :8000), Kev (python -m kev.serve, :8009) or any /v1/systemone server
  llm: Tev1 or any OpenAI-compatible chat server (Ollama, llama.cpp, LM Studio, vLLM); each choice becomes a one-letter question
       (a question with more than MAX_OPTIONS criteria is decided by a knockout tournament of one-letter sub-questions)

Run: python3 decision_server.py      env: DECISION_BACKEND, DECISION_URL, DECISION_MODEL, DECISION_API_KEY, PORT (8765)
"""
import http.server
import json
import os
from pathlib import Path
import string
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
PAGES_ORIGIN = 'https://chynggi.github.io'
MAX_BODY = 65536
LETTERS = string.ascii_uppercase
MAX_OPTIONS = 24
DEFAULT_URL = {'systemone': 'http://127.0.0.1:8000/v1/systemone', 'llm': 'http://127.0.0.1:11434/v1/chat/completions'}


class BackendError(Exception):
    pass


def to_letter_prompt(state, q):
    keys = list((q.get('criteria') or {}).keys())
    if not 2 <= len(keys) <= MAX_OPTIONS:
        raise BackendError(f'선택지는 2~{MAX_OPTIONS}개여야 합니다')
    options = '\n'.join(f'{LETTERS[i]}: {k}: {q["criteria"][k]}' for i, k in enumerate(keys))
    prompt = (f'State\n{json.dumps(state, ensure_ascii=False)}\n'
              f'Question\n{q.get("instructions", "")}\n'
              f'Options\n{options}\n'
              'Answer with one letter only.')
    return prompt, keys


def letter_to_key(text, keys):
    for ch in (text or '').strip().upper():
        if ch in LETTERS:
            i = LETTERS.index(ch)
            return keys[i] if i < len(keys) else None
        if not ch.isspace():
            return None
    return None


def post_json(url, payload, key):
    headers = {'Content-Type': 'application/json'}
    if key:
        headers['Authorization'] = f'Bearer {key}'
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise BackendError(f'결정 모델 서버가 오류를 돌려주었습니다(HTTP {e.code})') from e
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise BackendError(f'결정 모델 서버에 연결할 수 없습니다: {url}') from e


def ask_llm(state, instructions, criteria, env, url, key):
    """Ask one letter-prompt sub-question (<= MAX_OPTIONS criteria) and return the chosen key or None."""
    prompt, keys = to_letter_prompt(state, {'instructions': instructions, 'criteria': criteria})
    payload = {'messages': [{'role': 'user', 'content': prompt}], 'temperature': 0, 'max_tokens': 2,
               'chat_template_kwargs': {'enable_thinking': False}}
    if env.get('DECISION_MODEL'):
        payload['model'] = env['DECISION_MODEL']
    data = post_json(url, payload, key)
    try:
        text = data['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError) as e:
        raise BackendError('LLM 서버의 응답 형식을 읽을 수 없습니다') from e
    return letter_to_key(text, keys)


def choose(state, q, env, url, key):
    """Return the winning key for a choice question, running a knockout tournament when there are more than
    MAX_OPTIONS criteria: split the keys into consecutive chunks of at most MAX_OPTIONS (a trailing chunk of
    exactly one key skips its own sub-question and advances straight to the final round), ask each chunk once,
    then ask a final question among the chunk winners."""
    criteria = q.get('criteria') or {}
    instructions = q.get('instructions', '')
    keys_all = list(criteria.keys())
    if len(keys_all) <= MAX_OPTIONS:
        return ask_llm(state, instructions, criteria, env, url, key)

    chunks = [keys_all[i:i + MAX_OPTIONS] for i in range(0, len(keys_all), MAX_OPTIONS)]
    trailing_single = None
    if len(chunks) > 1 and len(chunks[-1]) == 1:
        trailing_single = chunks.pop()[0]

    winners = []
    for chunk in chunks:
        w = ask_llm(state, instructions, {k: criteria[k] for k in chunk}, env, url, key)
        if w:
            winners.append(w)
    if trailing_single is not None:
        winners.append(trailing_single)

    if len(winners) == 0:
        return None
    if len(winners) == 1:
        return winners[0]
    return ask_llm(state, instructions, {k: criteria[k] for k in winners}, env, url, key)


def decide(body, env):
    backend = env.get('DECISION_BACKEND', 'systemone')
    if backend not in DEFAULT_URL:
        raise BackendError(f'DECISION_BACKEND는 systemone 또는 llm이어야 합니다(현재: {backend})')
    url = env.get('DECISION_URL') or DEFAULT_URL[backend]
    key = env.get('DECISION_API_KEY', '')
    state, questions = body.get('state', {}), body.get('questions', {})
    if backend == 'systemone':
        data = post_json(url, {'state': state, 'questions': questions}, key)
        answers = data.get('answers')
        if not isinstance(answers, dict):
            raise BackendError('결정 모델 서버의 응답에 answers가 없습니다')
        return answers
    answers = {}
    for qid, q in questions.items():
        if q.get('type') != 'choice':
            continue
        choice = choose(state, q, env, url, key)
        if choice:
            answers[qid] = {'type': 'choice', 'choice': choice}
    return answers


def make_server(host, port, env=None):
    env = os.environ if env is None else env

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def log_message(self, fmt, *args):
            pass

        def allowed_origin(self):
            origin = self.headers.get('Origin')
            port_ = self.server.server_port
            local = {f'http://127.0.0.1:{port_}', f'http://localhost:{port_}', PAGES_ORIGIN}
            return origin if origin in local else None

        def cors(self):
            origin = self.allowed_origin()
            if origin:
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')

        def reply(self, code, data):
            raw = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(code)
            self.cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.path not in ('/', '/index.html', '/favicon.ico'):
                self.send_error(404)
                return
            super().do_GET()

        def do_OPTIONS(self):
            if self.path != '/api/decide' or not self.allowed_origin():
                self.send_error(403)
                return
            self.send_response(204)
            self.cors()
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Content-Length', '0')
            self.end_headers()

        def do_POST(self):
            if self.path != '/api/decide':
                self.send_error(404)
                return
            if self.headers.get('Origin') and not self.allowed_origin():
                self.reply(403, {'error': '허용되지 않은 출처입니다'})
                return
            length = int(self.headers.get('Content-Length') or 0)
            if length > MAX_BODY:
                self.rfile.read(min(length, 1 << 20))
                self.reply(413, {'error': '요청이 너무 큽니다'})
                return
            try:
                body = json.loads(self.rfile.read(length) or b'')
                if not isinstance(body, dict):
                    raise ValueError
            except ValueError:
                self.reply(400, {'error': '요청을 읽을 수 없습니다'})
                return
            try:
                self.reply(200, {'answers': decide(body, env)})
            except BackendError as e:
                self.reply(502, {'error': str(e)})

    return http.server.ThreadingHTTPServer((host, port), Handler)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8765'))
    backend = os.environ.get('DECISION_BACKEND', 'systemone')
    print(f'JIZURA: http://127.0.0.1:{port}/  →  {backend}: {os.environ.get("DECISION_URL") or DEFAULT_URL.get(backend, "?")}')
    make_server('127.0.0.1', port).serve_forever()
