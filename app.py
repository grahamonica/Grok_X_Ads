from flask import Flask, request, Response
import requests
import os
import subprocess
import time
import signal
import sys
import shutil
import socket

app = Flask(__name__)


def _filter_request_headers(headers):
    # Remove hop-by-hop headers that should not be forwarded
    hop_by_hop = {
        'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
        'te', 'trailer', 'transfer-encoding', 'upgrade', 'host'
    }
    return {k: v for k, v in headers.items() if k.lower() not in hop_by_hop}


def proxy_request(target_url):
    """Forward the incoming Flask request to target_url and stream the response back.

    This preserves method, query params, body and most headers, and copies
    essential response headers (content-type, content-encoding, set-cookie, cache control).
    """
    try:
        # Build outgoing headers from incoming request
        out_headers = _filter_request_headers(dict(request.headers))
        # Set a reasonable User-Agent if the client didn't provide one
        out_headers.setdefault('User-Agent', 'Mozilla/5.0 (compatible; GrokXAds/1.0)')

        resp = requests.request(
            method=request.method,
            url=target_url,
            params=request.args,
            data=request.get_data(),
            headers=out_headers,
            cookies=request.cookies,
            stream=True,
            allow_redirects=True,
            timeout=10,
        )

        # Some upstream scripts inject an adblock/overlay message into HTML/JS
        # (e.g. "Something went wrong" + the adblock suggestion). To avoid the
        # overlay blocking the UI in our proxied local experience, rewrite
        # known offending message strings in text/html and JS responses.
        content_type = resp.headers.get('content-type', '') or ''

        text_types = ('text/html', 'application/javascript', 'application/x-javascript', 'text/javascript')
        if any(t in content_type for t in text_types):
            # Read full content into memory and perform safe textual replacements.
            # This is acceptable for the relatively small assets we proxy (JS/HTML).
            raw = resp.content
            try:
                text = raw.decode(resp.encoding or 'utf-8', errors='replace')
            except Exception:
                text = raw.decode('utf-8', errors='replace')

            # Replace the visible error title and message so the overlay won't show
            # (keep replacements minimal to avoid breaking scripts).
            replacements = [
                ("Something went wrong", ""),
                ("Disable any adblockers, related extensions, or adjust your adblock settings to load this page properly.", ""),
                # Sometimes text may include newlines/extra spacing
                ("Disable any adblockers, related extensions, or adjust your adblock settings to load this page properly.\n", ""),
            ]
            for old, new in replacements:
                if old in text:
                    text = text.replace(old, new)

            new_bytes = text.encode('utf-8')

            # Build response headers, excluding hop-by-hop and encoding headers
            excluded_resp_headers = {'content-encoding', 'transfer-encoding', 'connection', 'keep-alive'}
            headers = []
            for k, v in resp.headers.items():
                if k.lower() in excluded_resp_headers:
                    continue
                # update Content-Length to match modified body
                if k.lower() == 'content-length':
                    continue
                headers.append((k, v))
            headers.append(('Content-Length', str(len(new_bytes))))

            resp.close()
            return Response(new_bytes, status=resp.status_code, headers=headers)

        # Fallback: stream binary content back to client for non-text types
        def generate():
            try:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk
            finally:
                resp.close()

        excluded_resp_headers = {'content-encoding', 'transfer-encoding', 'connection', 'keep-alive'}
        headers = []
        for k, v in resp.headers.items():
            if k.lower() in excluded_resp_headers:
                continue
            headers.append((k, v))

        return Response(generate(), status=resp.status_code, headers=headers)

    except requests.RequestException as e:
        return (f"Upstream request failed: {e}", 502)


@app.route('/')
def index():
    # Serve index.html but rewrite external resource URLs so the browser
    # loads them through this proxy. This avoids CORS/adblock issues and
    # ensures resources come from our proxied endpoints.
    with open('index.html', 'r') as f:
        html = f.read()

    # Map external hosts to local proxy paths
    replacements = [
        ('https://ton.twimg.com/web-app-framework/', '/web-app-framework/'),
        ('http://ton.twimg.com/web-app-framework/', '/web-app-framework/'),
        ('https://abs.twimg.com/', '/abs.twimg.com/'),
        ('http://abs.twimg.com/', '/abs.twimg.com/'),
        ('https://static.ads-twitter.com/', '/static.ads-twitter.com/'),
        ('http://static.ads-twitter.com/', '/static.ads-twitter.com/'),
        ('https://www.googletagmanager.com/', '/www.googletagmanager.com/'),
        ('http://www.googletagmanager.com/', '/www.googletagmanager.com/'),
        # protocol-relative URL for taboola
        ('//cdn.taboola.com/', '/cdn.taboola.com/'),
        ('https://cdn.taboola.com/', '/cdn.taboola.com/'),
        ('http://cdn.taboola.com/', '/cdn.taboola.com/'),
    ]

    for src, dst in replacements:
        html = html.replace(src, dst)

    return Response(html, content_type='text/html')

@app.route('/web-app-framework/<path:path>')
def proxy_web_app_framework(path):
    url = f'https://ton.twimg.com/web-app-framework/{path}'
    return proxy_request(url)

@app.route('/abs.twimg.com/<path:path>')
def proxy_abs_twitter(path):
    url = f'https://abs.twimg.com/{path}'
    return proxy_request(url)

@app.route('/static.ads-twitter.com/<path:path>')
def proxy_static_ads_twitter(path):
    url = f'https://static.ads-twitter.com/{path}'
    return proxy_request(url)

@app.route('/www.googletagmanager.com/<path:path>')
def proxy_googletagmanager(path):
    url = f'https://www.googletagmanager.com/{path}'
    return proxy_request(url)

@app.route('/cdn.taboola.com/<path:path>')
def proxy_taboola(path):
    url = f'https://cdn.taboola.com/{path}'
    return proxy_request(url)

if __name__ == '__main__':
    # If a PORT env var is set, use it; otherwise default to 8000
    PORT = int(os.environ.get('PORT', '8000'))

    def free_port(port: int):
        """Try to free the given TCP port by terminating processes that are LISTENing on it.

        On macOS/Linux this uses `lsof` to find PIDs listening on the port and sends
        SIGTERM then SIGKILL if necessary. If `lsof` is not available, it attempts
        a bind as a fallback to detect if the port is free; if it's not free and we
        can't find the PID, the function exits with instructions.
        """
        # Prefer lsof for reliable PID discovery
        if shutil.which('lsof'):
            try:
                out = subprocess.check_output(['lsof', '-i', f':{port}', '-sTCP:LISTEN', '-t'], stderr=subprocess.DEVNULL)
                pids = [int(x) for x in out.split()]
            except subprocess.CalledProcessError:
                pids = []

            for pid in pids:
                # don't kill ourselves if somehow reported
                if pid == os.getpid():
                    continue
                try:
                    print(f"Stopping process {pid} that is listening on port {port} (SIGTERM)")
                    os.kill(pid, signal.SIGTERM)
                except Exception as e:
                    print(f"Failed to SIGTERM {pid}: {e}")

            # wait a short while for processes to exit, then force kill if still alive
            for pid in pids:
                if pid == os.getpid():
                    continue
                for _ in range(20):
                    try:
                        os.kill(pid, 0)
                        # still alive
                        time.sleep(0.1)
                    except OSError:
                        break
                else:
                    try:
                        print(f"Force killing {pid} (SIGKILL)")
                        os.kill(pid, signal.SIGKILL)
                    except Exception as e:
                        print(f"Failed to SIGKILL {pid}: {e}")
        else:
            # lsof missing: try to bind as a probe. If bind fails, we can't discover PID here.
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                s.bind(('0.0.0.0', port))
                s.close()
                return
            except OSError:
                print(f"Port {port} appears to be in use, but `lsof` is not available to discover the process.\nPlease free the port manually or install lsof (macOS: brew install lsof) and rerun.")
                sys.exit(1)

    try:
        free_port(PORT)
    except Exception as e:
        print(f"Warning: failed to free port {PORT}: {e}")

    # Disable the Flask reloader to avoid double-starts that can make port handling messy.
    app.run(host='0.0.0.0', port=PORT, use_reloader=False)