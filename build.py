"""Build the single-file web app (index.html) from src/, app/ and vendor/.
usage: python3 build.py            -> index.html (served by GitHub Pages)
       python3 build.py --dev      -> also dev/www/jizura.js + dev/www/test.html for the test tools"""
import glob, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
read = lambda p: open(p, encoding='utf-8').read()
js = '\n'.join(read(f) for f in sorted(glob.glob('src/*.js')))
mux = '/*! mp4-muxer v5.2.2 | MIT License | (c) 2023 Vanilagy | see THIRD_PARTY_NOTICES.md */\n' + read('vendor/mp4-muxer.min.js')
html = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>JIZURA 字面 — 문자 PV 자동 구성 도구</title>
<meta name="description" content="가사를 넣으면 문자 PV(리릭 모션)를 자동으로 구성해 MP4로 내보내는 브라우저 앱">
<link rel="canonical" href="https://852wa.github.io/JIZURA/">
<meta property="og:type" content="website">
<meta property="og:title" content="JIZURA 字面 — 문자 PV 자동 구성 도구">
<meta property="og:description" content="가사를 넣으면 문자 PV(리릭 모션)를 자동으로 구성해 MP4로 내보내는 브라우저 앱">
<meta property="og:url" content="https://852wa.github.io/JIZURA/">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%230c0c0e'/><text x='32' y='46' font-size='38' text-anchor='middle' fill='%23f5a50c' font-family='serif'>字</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>
{read('app/style.css')}
</style>
</head>
<body>
{read('app/body.html')}
<script>
{mux}
</script>
<script>
{js}
</script>
</body>
</html>
'''
open('index.html', 'w', encoding='utf-8').write(html)
print('index.html', len(html), 'bytes')
if '--dev' in sys.argv:
    os.makedirs('dev/www', exist_ok=True)
    open('dev/www/jizura.js', 'w', encoding='utf-8').write(js)
    open('dev/www/test.html', 'w', encoding='utf-8').write(read('dev/test.html'))
    print('dev/www ready: cd dev/www && python3 -m http.server 8765')
