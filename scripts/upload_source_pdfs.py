"""
Uploads the source governing-document PDFs into the private
'hoa-documents' Supabase Storage bucket so the app can serve them via
short-lived signed URLs (see /api/documents/[name]/route.ts).

Filenames here must exactly match `document_name` in hoa_document_chunks
so the chat's citation links can map "Bylaws.pdf" -> this bucket object.

Usage: python scripts/upload_source_pdfs.py
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
SRC_DIR = Path("scripts/source_pdfs")

FILES = [
    "Bylaws.pdf",
    "CCRs.pdf",
    "ARC Guidelines.pdf",
    "Articles of Incorporation.pdf",
]

for name in FILES:
    path = SRC_DIR / name
    if not path.exists():
        print(f"SKIP (not found): {path}")
        continue
    data = path.read_bytes()
    res = supabase.storage.from_(BUCKET).upload(
        path=name,
        file=data,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    print(f"Uploaded {name} ({len(data)} bytes)")

listing = supabase.storage.from_(BUCKET).list()
print("\nBucket contents:")
for obj in listing:
    print(" -", obj.get("name"), obj.get("metadata", {}).get("size"))
