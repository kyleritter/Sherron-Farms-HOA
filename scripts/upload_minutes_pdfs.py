"""
Uploads HOA meeting minutes PDFs into the private 'hoa-documents'
Supabase Storage bucket, same pattern as scripts/upload_source_pdfs.py
and scripts/upload_financial_pdfs.py.

Source files live in the "Minutes" folder of the HOA's Google Drive.
Filenames here must exactly match MINUTES_DOCUMENTS in
src/lib/documents.ts (and document_name in hoa_document_chunks, for the
ones ingested for chat -- see scripts/ingest_from_unstructured.py).

Usage: python scripts/upload_minutes_pdfs.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path=".env.local")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
    raise SystemExit("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
BUCKET = "hoa-documents"
SRC_DIR = Path(
    os.environ.get(
        "HOA_DRIVE_MINUTES_DIR",
        os.path.expanduser("~") + "/mnt/HOA/Minutes",
    )
)

# (source filename in the Minutes folder, destination name in storage / app)
FILES = [
    ("2026_03_12 Minutes (Board Meeting and Due Process).pdf", "Minutes - March 12, 2026.pdf"),
    ("May 14th Meeting Minutes.pdf", "Minutes - May 14, 2026.pdf"),
    ("6112026 Meeting Minutes.pdf", "Minutes - June 11, 2026.pdf"),
    ("Meeting Minutes August 6th.pdf", "Minutes - August 6, 2026.pdf"),
]

for src_name, dest_name in FILES:
    path = SRC_DIR / src_name
    if not path.exists():
        print(f"SKIP (not found): {path}")
        continue
    data = path.read_bytes()
    supabase.storage.from_(BUCKET).upload(
        path=dest_name,
        file=data,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    print(f"Uploaded {dest_name} ({len(data)} bytes)")

listing = supabase.storage.from_(BUCKET).list()
print("\nBucket contents:")
for obj in listing:
    print(" -", obj.get("name"), obj.get("metadata", {}).get("size"))
