"""
Uploads the HOA's financial PDFs (monthly statements + annual budget)
into the private 'hoa-documents' Supabase Storage bucket so the
Financials page can serve them via short-lived signed URLs, the same
way scripts/upload_source_pdfs.py does for the governing documents.

Source files live in the "Budget" folder of the HOA's Google Drive.
Filenames here must exactly match FINANCIAL_DOCUMENTS in
src/lib/documents.ts.

Usage: python scripts/upload_financial_pdfs.py
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
        "HOA_DRIVE_BUDGET_DIR",
        os.path.expanduser(
            "~/Library/CloudStorage/GoogleDrive-k2ritter@gmail.com/"
            ".shortcut-targets-by-id/1RHPvcPfYFzUHwcElUmBldaYum4FHK9Pv/"
            "Hiddenbrook House/HOA/Budget"
        ),
    )
)

# (source filename in the Budget folder, destination name in storage / app)
FILES = [
    ("12026 Web.pdf", "Financials - January 2026.pdf"),
    ("22026 Web.pdf", "Financials - February 2026.pdf"),
    ("32026 Web.pdf", "Financials - March 2026.pdf"),
    ("42026 Web.pdf", "Financials - April 2026.pdf"),
    ("52026 Web.pdf", "Financials - May 2026.pdf"),
    ("62026 Web.pdf", "Financials - June 2026.pdf"),
    ("72026 Web.pdf", "Financials - July 2026.pdf"),
    ("Budget 2026.pdf", "Financials - 2026 Annual Budget.pdf"),
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
