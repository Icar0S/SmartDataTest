# docs_to_import/

Place documents (PDF, TXT) here to import into the RAG knowledge base.

Run the import script from the project root:

```bash
python utilities/import_documents.py docs_to_import
```

⚠️ Files in this directory are **not versioned** (see `.gitignore`).
Use the import script after cloning the repository to populate the knowledge base.

## Supported Formats
- PDF (`.pdf`)
- Plain text (`.txt`)
- Markdown (`.md`)
