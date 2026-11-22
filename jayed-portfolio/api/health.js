import { blobToken } from "./_lib.js";

// Shows only YES/NO answers and setting names, never the secret values.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const meta = !!(process.env.LLAMA_API_KEY && process.env.LLAMA_MODEL);
  res.status(200).json({
    imageStorageKeyFound: !!blobToken(),
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
    sessionSecretSet: !!process.env.SESSION_SECRET,
    aiTitlesWillUse: meta ? "Meta (Llama)" : process.env.ANTHROPIC_API_KEY ? "Anthropic (Claude)" : "NOTHING - no AI key set",
    llamaKeySet: !!process.env.LLAMA_API_KEY,
    llamaModelSet: !!process.env.LLAMA_MODEL,
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
    emailAlertsOn: !!(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL),
  });
}
