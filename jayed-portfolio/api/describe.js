import { isAdmin } from "./_lib.js";

const NO_KEY = "No AI key is set yet. In Vercel add GROQ_API_KEY (Groq), or XAI_API_KEY (Grok), or LLAMA_API_KEY plus LLAMA_MODEL (Meta), or ANTHROPIC_API_KEY.";

function buildPrompt(cats) {
  const known = Array.isArray(cats) ? cats.filter((c) => typeof c === "string").slice(0, 20).join(", ") : "";
  return (
    `You help a graphic designer name work in his portfolio. Look at this design and reply with JSON only, no other text: ` +
    `{"title":"evocative title, max 5 words","desc":"1-2 warm sentences describing the design and its mood","cat":"one short category"}. ` +
    `Reuse one of these categories if it fits: [${known}]. Otherwise pick something like Poster, Social Media, Greeting, Branding, Photo Manipulation, Illustration or Typography.`
  );
}

// Some models "think out loud" first. Drop that, then take the last complete JSON object that has a title.
function pickJson(text) {
  const s = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  let best = null;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try { const o = JSON.parse(s.slice(i, j + 1)); if (o && typeof o === "object" && "title" in o) { best = o; i = j; } } catch {}
        break;
      }
    }
  }
  return best;
}

async function viaOpenAIStyle(name, base, key, model, image, prompt, maxTokens) {
  base = base.replace(/\/$/, "");
  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 600,
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
  if (!r.ok) throw new Error((data.error && (data.error.message || data.error)) || data.message || name + " refused the request (" + r.status + ").");
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
  const useGroq = !!process.env.GROQ_API_KEY;
  const useGrok = !useGroq && !!process.env.XAI_API_KEY;
  const useMeta = !useGroq && !useGrok && !!(process.env.LLAMA_API_KEY && process.env.LLAMA_MODEL);
  if (!useGroq && !useGrok && !useMeta && !process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: NO_KEY });
  const { image, cats } = req.body || {};
  if (typeof image !== "string" || image.length < 100 || image.length > 3000000) {
    return res.status(400).json({ error: "Missing or too-large preview image." });
  }
  try {
    const prompt = buildPrompt(cats);
    const text = useGroq
      ? await viaOpenAIStyle("Groq", process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1", process.env.GROQ_API_KEY, process.env.GROQ_MODEL || "qwen/qwen3.8-27b", image, prompt, 1500)
      : useGrok
      ? await viaOpenAIStyle("Grok", process.env.XAI_BASE_URL || "https://api.x.ai/v1", process.env.XAI_API_KEY, process.env.XAI_MODEL || "grok-4", image, prompt)
      : useMeta
        ? await viaOpenAIStyle("Meta AI", process.env.LLAMA_BASE_URL || "https://api.llama.com/compat/v1", process.env.LLAMA_API_KEY, process.env.LLAMA_MODEL, image, prompt)
        : await viaAnthropic(image, prompt);
    const out = pickJson(text);
    if (!out) return res.status(502).json({ error: "The AI reply could not be read. Try again." });
    res.status(200).json({ title: String(out.title || ""), desc: String(out.desc || ""), cat: String(out.cat || "") });
  } catch (e) {
    res.status(500).json({ error: e.message || "AI request failed." });
  }
}
