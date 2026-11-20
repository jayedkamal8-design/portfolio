import { isAdmin } from "./_lib.js";

const NO_KEY = "No AI key is set yet (add ANTHROPIC_API_KEY, or LLAMA_API_KEY plus LLAMA_MODEL, in Vercel).";

function buildPrompt(cats) {
  const known = Array.isArray(cats) ? cats.filter((c) => typeof c === "string").slice(0, 20).join(", ") : "";
  return (
    `You help a graphic designer name work in his portfolio. Look at this design and reply with JSON only, no other text: ` +
    `{"title":"evocative title, max 5 words","desc":"1-2 warm sentences describing the design and its mood","cat":"one short category"}. ` +
    `Reuse one of these categories if it fits: [${known}]. Otherwise pick something like Poster, Social Media, Greeting, Branding, Photo Manipulation, Illustration or Typography.`
  );
}

async function viaMeta(image, prompt) {
  const base = (process.env.LLAMA_BASE_URL || "https://api.llama.com/compat/v1").replace(/\/$/, "");
  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + process.env.LLAMA_API_KEY },
    body: JSON.stringify({
      model: process.env.LLAMA_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64," + image } },
          ],
        },
      ],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && (data.error.message || data.error)) || data.message || "Meta AI refused the request (" + r.status + ").");
  const c = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const text = typeof c === "string" ? c : (data.completion_message && data.completion_message.content && data.completion_message.content.text) || "";
  return text;
}

async function viaAnthropic(image, prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 400,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } }, { type: "text", text: prompt }] }],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || "The AI service refused the request.");
  return ((data.content || []).find((c) => c.type === "text") || {}).text || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAdmin(req)) return res.status(401).json({ error: "Please log in as admin first." });
  const useMeta = !!(process.env.LLAMA_API_KEY && process.env.LLAMA_MODEL);
  if (!useMeta && !process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: NO_KEY });
  const { image, cats } = req.body || {};
  if (typeof image !== "string" || image.length < 100 || image.length > 3000000) {
    return res.status(400).json({ error: "Missing or too-large preview image." });
  }
  try {
    const prompt = buildPrompt(cats);
    const text = useMeta ? await viaMeta(image, prompt) : await viaAnthropic(image, prompt);
    const m = /\{[\s\S]*\}/.exec(text || "");
    if (!m) return res.status(502).json({ error: "The AI reply could not be read. Try again." });
    const out = JSON.parse(m[0]);
    res.status(200).json({ title: String(out.title || ""), desc: String(out.desc || ""), cat: String(out.cat || "") });
  } catch (e) {
    res.status(500).json({ error: e.message || "AI request failed." });
  }
}
