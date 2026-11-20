import { isAdmin } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAdmin(req)) return res.status(401).json({ error: "Please log in as admin first." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel yet." });
  }
  const { image, cats } = req.body || {};
  if (typeof image !== "string" || image.length < 100 || image.length > 3000000) {
    return res.status(400).json({ error: "Missing or too-large preview image." });
  }
  const known = Array.isArray(cats) ? cats.filter((c) => typeof c === "string").slice(0, 20).join(", ") : "";
  const prompt =
    `You help a graphic designer name work in his portfolio. Look at this design and reply with JSON only, no other text: ` +
    `{"title":"evocative title, max 5 words","desc":"1-2 warm sentences describing the design and its mood","cat":"one short category"}. ` +
    `Reuse one of these categories if it fits: [${known}]. Otherwise pick something like Poster, Social Media, Greeting, Branding, Photo Manipulation, Illustration or Typography.`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data.error && data.error.message) || "The AI service refused the request." });
    const text = (data.content || []).find((c) => c.type === "text")?.text || "";
    const m = /\{[\s\S]*\}/.exec(text);
    if (!m) return res.status(502).json({ error: "The AI reply could not be read. Try again." });
    const out = JSON.parse(m[0]);
    res.status(200).json({ title: String(out.title || ""), desc: String(out.desc || ""), cat: String(out.cat || "") });
  } catch (e) {
    res.status(500).json({ error: e.message || "AI request failed." });
  }
}
