# Jayed Kamal portfolio (Vercel)

Folders: `public/` = the website, `api/` = the backend (login, save, upload, AI titles).

Settings to add in Vercel (Settings -> Environment Variables):
- ADMIN_PASSWORD   your admin passcode
- SESSION_SECRET   any long random text (30+ characters)
- ANTHROPIC_API_KEY  your key from console.anthropic.com
- BLOB_READ_WRITE_TOKEN  added automatically when you connect a Blob store
- ANTHROPIC_MODEL  optional, defaults to claude-sonnet-5-5
