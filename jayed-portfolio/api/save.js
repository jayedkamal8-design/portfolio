import { isAdmin, writeSite } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAdmin(req)) return res.status(401).json({ error: "Please log in as admin first." });
  const s = req.body;
  if (!s || typeof s !== "object" || !Array.isArray(s.works) || !Array.isArray(s.exp) || !Array.isArray(s.ach)) {
    return res.status(400).json({ error: "The data looked wrong, nothing was saved." });
  }
  if (JSON.stringify(s).length > 500000) return res.status(413).json({ error: "Too much data." });
  try {
    await writeSite(s);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Could not save." });
  }
}
