import { blobToken } from "./_lib.js";

// Shows only YES/NO answers and setting names, never the secret values.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    imageStorageKeyFound: !!blobToken(),
    storageSettingNamesSeen: Object.keys(process.env).filter((k) => /BLOB|READ_WRITE_TOKEN/.test(k)),
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
    sessionSecretSet: !!process.env.SESSION_SECRET,
    aiKeySet: !!process.env.ANTHROPIC_API_KEY,
  });
}
