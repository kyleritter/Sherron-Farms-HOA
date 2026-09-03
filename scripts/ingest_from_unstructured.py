"""
Ingest pre-parsed Unstructured Element JSON (from the Unstructured
Transform MCP server: partition=hi_res, enrich=table_to_html,
chunk=chunk_by_title) into the `hoa_document_chunks` table.

This is the second half of the pipeline -- parsing happens via the
Unstructured Transform MCP tools (run by Claude), which produce one
Element JSON file per source PDF under ./unstructured_output/. This
script embeds each chunk with Gemini and upserts into Supabase. Runs
entirely locally so SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY never
have to leave this machine.

Idempotent: re-running deletes any existing rows for the same
document_name before re-inserting, so it's safe to re-run after a
partial failure or when a document is replaced.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/ingest_from_unstructured.py
"""

import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from supabase import create_client, Client

load_dotenv(dotenv_path=".env.local")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY):
    raise SystemExit(
        "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY "
        "in .env.local"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
ai_client = genai.Client(api_key=GEMINI_API_KEY)

# text-embedding-004 was retired -- gemini-embedding-001 is current.
# output_dimensionality pins it to 768 to match hoa_document_chunks'
# VECTOR(768) column. Keep this in sync with src/lib/gemini.ts.
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768

# Free-tier embed_content quota is 100 requests/minute. Pace requests
# well under that and back off with the server's own retry-after on
# a 429 rather than guessing.
SECONDS_BETWEEN_CALLS = 0.75
MAX_RETRIES = 6

OUTPUT_DIR = Path("unstructured_output")

# Maps each parsed JSON file to its document_name / document_type as
# they should appear in the app (matches the cheat sheet's naming).
FILES = [
    {
        "path": OUTPUT_DIR / "articles.json",
        "document_name": "Articles of Incorporation.pdf",
        "document_type": "Articles of Incorporation",
    },
    {
        "path": OUTPUT_DIR / "arc.json",
        "document_name": "ARC Guidelines.pdf",
        "document_type": "ARC Guidelines",
    },
    {
        "path": OUTPUT_DIR / "bylaws.json",
        "document_name": "Bylaws.pdf",
        "document_type": "Bylaws",
    },
    {
        "path": OUTPUT_DIR / "ccrs.json",
        "document_name": "CCRs.pdf",
        "document_type": "CC&Rs",
    },
]

CHUNK_TYPES = {"CompositeElement", "TableChunk", "Table"}


def guess_section_title(text: str, page_number: int) -> str:
    """Unstructured's chunker doesn't carry a separate section-title
    field per chunk, so approximate one from the chunk's own first
    line -- these documents' chunks reliably start with an ARTICLE/
    Section heading or a short title line."""
    first_line = text.strip().split("\n", 1)[0].strip()
    if first_line and len(first_line) <= 120:
        return first_line
    return f"Section near p. {page_number}"


def get_embedding(text: str) -> list[float]:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = ai_client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=text,
                config={"output_dimensionality": EMBEDDING_DIMENSIONS},
            )
            return response.embeddings[0].values
        except genai_errors.ClientError as e:
            if getattr(e, "code", None) == 429 and attempt < MAX_RETRIES:
                # Prefer the server's own suggested delay when present.
                delay = 20.0
                try:
                    details = e.details.get("error", {}).get("details", [])
                    for d in details:
                        if d.get("@type", "").endswith("RetryInfo"):
                            raw = d.get("retryDelay", "20s")
                            delay = float(str(raw).rstrip("s")) + 2
                except Exception:
                    pass
                print(f"    rate limited, retrying in {delay:.0f}s (attempt {attempt})")
                time.sleep(delay)
                continue
            raise
    raise RuntimeError("exceeded retries for embedding call")


def ingest_file(spec: dict, start: int = 0, end: int | None = None, clear: bool = True) -> int:
    path: Path = spec["path"]
    if not path.exists():
        print(f"  SKIP: {path} not found")
        return 0

    if clear:
        # Idempotency: clear any rows from a previous (possibly partial)
        # run for this exact document before re-inserting.
        supabase.table("hoa_document_chunks").delete().eq(
            "document_name", spec["document_name"]
        ).execute()

    elements = json.loads(path.read_text())
    chunk_els = [
        el for el in elements
        if el.get("type") in CHUNK_TYPES and (el.get("text") or "").strip()
    ]
    if end is None:
        end = len(chunk_els)
    inserted = 0

    for el in chunk_els[start:end]:
        text = el["text"].strip()
        page_number = el.get("metadata", {}).get("page_number") or 1
        section_title = guess_section_title(text, page_number)

        embedding = get_embedding(text)

        supabase.table("hoa_document_chunks").insert(
            {
                "document_name": spec["document_name"],
                "document_type": spec["document_type"],
                "section_title": section_title,
                "page_number": page_number,
                "content": text,
                "embedding": embedding,
            }
        ).execute()
        inserted += 1

        time.sleep(SECONDS_BETWEEN_CALLS)

    print(f"  ({len(chunk_els)} total chunk-eligible elements in file)")
    return inserted


def main():
    import sys
    only = sys.argv[1] if len(sys.argv) > 1 else None
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    end = int(sys.argv[3]) if len(sys.argv) > 3 else None
    clear = start == 0
    files = [f for f in FILES if only is None or f["path"].name == only]
    total = 0
    for spec in files:
        print(f"--- Ingesting {spec['document_name']} [{start}:{end}] ---")
        count = ingest_file(spec, start=start, end=end, clear=clear)
        print(f"  Inserted {count} chunks.")
        total += count
    print(f"\nDone. Inserted {total} chunks total.")


if __name__ == "__main__":
    main()
