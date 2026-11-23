"""Inlines dist-preview into one HTML page (scripts, styles and images) for the shareable preview link."""
import base64, mimetypes, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent / 'dist-preview'
html = (root / 'index.html').read_text()


def data_uri(rel: str) -> str:
    f = root / rel.lstrip('./')
    mime = mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(f.read_bytes()).decode()


def inline_script(m):
    js = (root / m.group(1).lstrip('./')).read_text()
    # Asset URLs the bundle builds at run time ("./letterhead.jpg") become data URIs.
    for name in ('letterhead.jpg', 'icon.svg'):
        js = js.replace(f'"{name}"', f'"{data_uri(name)}"').replace(f"'{name}'", f"'{data_uri(name)}'")
    js = js.replace('</script', '<\\/script')
    return f'<script type="module">{js}</script>'


def inline_style(m):
    return '<style>' + (root / m.group(1).lstrip('./')).read_text() + '</style>'


html = re.sub(r'<script type="module" crossorigin src="([^"]+)"></script>', inline_script, html)
html = re.sub(r'<link rel="stylesheet" crossorigin href="([^"]+)">', inline_style, html)
html = re.sub(r'<link rel="(?:icon|apple-touch-icon)"[^>]*>', '', html)
# The artifact host adds its own doctype, html, head and body.
html = re.sub(r'<!doctype html>|</?html[^>]*>|</?head>|</?body>|<meta charset[^>]*>|<meta name="viewport"[^>]*>', '', html, flags=re.I)
out = root / 'patience-pos-preview.html'
out.write_text(html.strip() + '\n')
print(out, round(out.stat().st_size / 1024), 'KB')
