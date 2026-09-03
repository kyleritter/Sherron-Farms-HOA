"""
Offline document ingestion pipeline for the Sherron Farms HOA Document
Assistant. Run this locally whenever a governing document is added or
replaced.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/ingest.py

Reads PDFs from ./documents_raw, parses + chunks them with `unstructured`,
embeds each chunk with Gemini's text-embedding-004, and upserts into the
`hoa_document_chunks` table via the Supabase service-role key (bypasses RLS
for insertion — never expose that key outside this script).
"""

import os
import glob
from dotenv import load_dotenv
from google import genai
from supabase import create_client, Client
from unstructured.partition.pdf import partition_pdf
from unstructured.chunking.title import chunk_by_title

load_dotenv(dotenv_path=".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # bypasses RLS for insertion
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY):
    raise SystemExit(
        "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / "
        "GEMINI_API_KEY in .env.local"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
ai_client = genai.Client(api_key=GEMINI_API_KEY)

DOCS_DIRECTORY = "./documents_raw"


def get_embedding(text: str) -> list[float]:
    # text-embedding-004 was retired; gemini-embedding-001 is current.
    # output_dimensionality pins it to 768 to match hoa_document_chunks'
    # VECTOR(768) column -- keep in sync with src/lib/gemini.ts.
    response = ai_client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config={"output_dimensionality": 768},
    )
    return response.embeddings[0].values


def process_and_ingest():
    pdf_files = glob.glob(os.path.join(DOCS_DIRECTORY, "*.pdf"))
    print(f"Found {len(pdf_files)} documents to ingest.")

    for filepath in pdf_files:
        filename = os.path.basename(filepath)
        print(f"\n--- Processing {filename} ---")

        # Extract metadata hints from filename
        doc_type = "Covenant"
        lower = filename.lower()
        if "amendment" in lower:
            doc_type = "Amendment"
        elif "bylaw" in lower:
            doc_type = "Bylaws"
        elif "arc" in lower or "architectural" in lower:
            doc_type = "Architectural Guidelines"
        elif "minutes" in lower:
            doc_type = "Minutes"
        elif "budget" in lower:
            doc_type = "Budget"

        # 1. Parse PDF using unstructured.
        # Start with "fast" for text-layer PDFs; switch to "hi_res" (OCR) if
        # a document's chunk output looks garbled or empty — scanned pages
        # need it.
        elements = partition_pdf(
            filename=filepath,
            strategy="fast",
            infer_table_structure=True,
        )

        # 2. Chunk semantically by headings/titles to keep legal sections whole
        chunks = chunk_by_title(
            elements,
            max_characters=1500,
            new_after_n_chars=1200,
            combine_text_under_n_chars=300,
        )
        print(f"Created {len(chunks)} semantic chunks for {filename}.")

        for chunk in chunks:
            chunk_text = chunk.text.strip()
            if not chunk_text:
                continue

            page_num = chunk.metadata.page_number or 1
            section_title = (
                getattr(chunk.metadata, "section", None)
                or f"Section near p. {page_num}"
            )

            # 3. Generate embedding
            embedding = get_embedding(chunk_text)

            # 4. Store in Supabase
            supabase.table("hoa_document_chunks").insert(
                {
                    "document_name": filename,
                    "document_type": doc_type,
                    "page_number": page_num,
                    "section_title": section_title,
                    "content": chunk_text,
                    "embedding": embedding,
                }
            ).execute()

        print(f"Successfully uploaded chunks for {filename}")


if __name__ == "__main__":
    process_and_ingest()
