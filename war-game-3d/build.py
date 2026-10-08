#!/usr/bin/env python3
"""Builds index.html: inlines src/*.js and embeds assets/Soldier.glb (base64) so the page is a single file.
Usage: python3 build.py            -> index.html
       python3 build.py --artifact out.html   -> the same game wrapped for the artifact viewer"""
import base64, os, sys
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(here, p), encoding='utf-8').read()
code = '\n'.join(rd('src/' + n) for n in ['core.js', 'human.js', 'render.js', 'sky.js', 'world.js', 'interior.js', 'vehicles.js', 'destruct.js', 'audio.js', 'realmap_data.js', 'realmap.js', 'game.js'])
glb = base64.b64encode(open(os.path.join(here, 'assets/Soldier.glb'), 'rb').read()).decode()
html = rd('src/template.html').replace('/*SOLDIER*/', glb).replace('/*CODE*/', code)
if len(sys.argv) > 2 and sys.argv[1] == '--artifact':
    i = html.index('<script src="https://cdnjs')
    head = '''<title>War 3D</title>
<style>
  /* One look by choice: a dark field-green game screen, same in light and dark themes. */
  :root { --ground: #14170f; --ink: #e4e9d2; --muted: #9aa586; color-scheme: dark; }
  html, body { height: 100%; }
  body { margin: 0; background: var(--ground); color: var(--ink); font-family: ui-monospace, Menlo, Consolas, monospace;
         display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
         padding-inline: 16px; box-sizing: border-box; }
  #stage { position: relative; width: min(100%, 150vh, 1280px); aspect-ratio: 3 / 2; background: #9db9d4; }
  #stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #game { cursor: crosshair; touch-action: none; -webkit-user-select: none; user-select: none; }
  .note { display: none; margin: 0; font-size: 12px; color: var(--muted); text-align: center; }
  @media (pointer: coarse) and (orientation: portrait) { .note { display: block; } }
</style>
<div id="stage">
  <canvas id="gl"></canvas>
  <canvas id="game" width="1800" height="1200"></canvas>
</div>
<p class="note">Rotate your phone sideways for a larger view.</p>
'''
    open(sys.argv[2], 'w', encoding='utf-8').write(head + html[i:html.index('</body>')] + '\n')
else:
    open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(html)
print('built', len(html))
