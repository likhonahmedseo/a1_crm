from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> None:
    from app.web import app

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5000"))

    banner = f"""
{'='*55}
  A1 SEO Dynamics  —  AI Marketing Agent
  http://localhost:{port}
{'='*55}
"""
    print(banner)

    try:
        from waitress import serve
        print("  Starting production server (Waitress)...")
        # channel_timeout: max seconds to wait between SSE events
        serve(
            app,
            host=host,
            port=port,
            threads=8,
            channel_timeout=600,  # allow long SSE streams
            asyncore_use_poll=True,
        )
    except ImportError:
        print("  [WARN] Waitress not found — falling back to Flask dev server")
        print("  Run: pip install waitress  for production stability")
        app.run(debug=False, host=host, port=port, threaded=True, use_reloader=False)


if __name__ == "__main__":
    main()
