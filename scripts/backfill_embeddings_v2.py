"""
Backfill `embedding_v2` (gemini-embedding-2, 3072 dims, halfvec) for every
existing row in `hoa_document_chunks` and `ideas`, reading the text that's
already stored in Supabase -- no re-parsing or re-chunking needed.

Stdlib only (no pip installs). Reads GEMINI_API_KEY, SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY from .env.local. Only fills rows where
embedding_v2 IS NULL, so it's safe to re-run after an interruption.

Text formats must stay in sync with src/lib/gemini.ts:
  chunks: "title: {section_title or 'none'} | text: {content}"
  ideas:  "task: sentence similarity | query: {title}\n{body}"

Usage:
    python3 scripts/backfill_embeddings_v2.py            # both tables
    python3 scripts/backfill_embeddings_v2.py chunks     # just one
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

EMBEDDING_MODEL = "gemini-embedding-2"
EMBEDDING_DIMENSIONS = 3072
# Free-tier embedding limits aren't published; ~1 request/sec stays well
# under any per-minute cap, and 429s back off using the server's delay.
SECONDS_BETWEEN_CALLS = 1.1
MAX_RETRIES = 6


def load_env(path=".env.local"):
    env = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()
GEMINI_API_KEY = ENV["GEMINI_API_KEY"]
SUPABASE_URL = (ENV.get("SUPABASE_URL") or ENV["NEXT_PUBLIC_SUPABASE_URL"]).rstrip("/")
SERVICE_KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"]


def chunk_text(section_title, content):
    return f"title: {section_title or 'none'} | text: {content}"


def idea_text(title, body):
    return f"task: sentence similarity | query: {title}\n{body}"


def http(method, url, headers, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def embed(text):
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{EMBEDDING_MODEL}:embedContent"
    )
    headers = {"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"}
    body = {
        "content": {"parts": [{"text": text}]},
        "output_dimensionality": EMBEDDING_DIMENSIONS,
    }
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            values = http("POST", url, headers, body)["embedding"]["values"]
            assert len(values) == EMBEDDING_DIMENSIONS, len(values)
            return values
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            if e.code in (429, 500, 503) and attempt < MAX_RETRIES:
                delay = 20.0
                try:
                    for d in json.loads(detail)["error"].get("details", []):
                        if d.get("@type", "").endswith("RetryInfo"):
                            delay = float(str(d.get("retryDelay", "20s")).rstrip("s")) + 2
                except Exception:
                    pass
                print(f"    HTTP {e.code}, retrying in {delay:.0f}s (attempt {attempt})", flush=True)
                time.sleep(delay)
                continue
            raise RuntimeError(f"embed failed: HTTP {e.code}: {detail[:500]}")
    raise RuntimeError("exceeded retries for embedding call")


def sb_headers():
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def fetch_missing(table, columns):
    rows, offset = [], 0
    while True:
        q = urllib.parse.urlencode({
            "select": columns,
            "embedding_v2": "is.null",
            "order": "id",
            "limit": 500,
            "offset": offset,
        })
        page = http("GET", f"{SUPABASE_URL}/rest/v1/{table}?{q}", sb_headers())
        rows += page
        if len(page) < 500:
            return rows
        offset += 500


def set_embedding(table, row_id, values):
    vec = "[" + ",".join(repr(float(v)) for v in values) + "]"
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{urllib.parse.quote(str(row_id))}"
    http("PATCH", url, sb_headers(), {"embedding_v2": vec})


def backfill(table, columns, to_text):
    rows = fetch_missing(table, columns)
    print(f"--- {table}: {len(rows)} rows need embedding_v2 ---", flush=True)
    for i, row in enumerate(rows, 1):
        set_embedding(table, row["id"], embed(to_text(row)))
        if i % 25 == 0 or i == len(rows):
            print(f"  {i}/{len(rows)}", flush=True)
        time.sleep(SECONDS_BETWEEN_CALLS)


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "chunks"):
        backfill(
            "hoa_document_chunks",
            "id,section_title,content",
            lambda r: chunk_text(r["section_title"], r["content"]),
        )
    if which in ("all", "ideas"):
        backfill("ideas", "id,title,body", lambda r: idea_text(r["title"], r["body"]))
    print("Done.", flush=True)


if __name__ == "__main__":
    main()
