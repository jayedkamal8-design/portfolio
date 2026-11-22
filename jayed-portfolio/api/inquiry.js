import crypto from "node:crypto";
import { put, list } from "@vercel/blob";
import { isAdmin, blobToken } from "./_lib.js";

const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
// The storage is public, so messages are ENCRYPTED and the file name is unguessable.
const FILE = () => "inbox-" + crypto.createHash("sha256").update("name:" + secret()).digest("hex").slice(0, 24) + ".json";
const KEY = () => crypto.createHash("sha256").update("inbox:" + secret()).digest();
const hits = new Map();

function enc(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return JSON.stringify({ iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") });
}
function dec(txt) {
  const o = JSON.parse(txt);
  const d = crypto.createDecipheriv("aes-256-gcm", KEY(), Buffer.from(o.iv, "base64"));
  d.setAuthTag(Buffer.from(o.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.data, "base64")), d.final()]).toString("utf8"));
}
async function readAll() {
  try {
    const { blobs } = await list({ prefix: FILE(), limit: 1, token: blobToken() });
    if (!blobs.length) return [];
    const r = await fetch(blobs[0].url + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return [];
    const items = dec(await r.text());
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}
async function writeAll(items) {
  await put(FILE(), enc(items), { token: blobToken(), access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
}
async function notify(m) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + process.env.RESEND_API_KEY },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || "Portfolio <onboarding@resend.dev>",
        to: [process.env.NOTIFY_EMAIL],
        reply_to: m.email,
        subject: `New project inquiry from ${m.name}`,
        text: `From: ${m.name} <${m.email}>\nProject: ${m.type}\nBudget: ${m.budget || "-"}\nDeadline: ${m.when || "-"}\n\n${m.message}`,
      }),
    });
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!secret()) return res.status(500).json({ error: "The site isn't fully set up yet (SESSION_SECRET is missing)." });

  if (req.method === "POST") {
    const b = req.body || {};
    if (b.website) return res.status(200).json({ ok: true }); // hidden trap field for bots
    const ip = String(req.headers["x-forwarded-for"] || "?").split(",")[0].trim();
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (recent.length >= 5) return res.status(429).json({ error: "Too many messages from your connection. Please try later or email directly." });
    const s = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
    const m = { id: crypto.randomUUID(), ts: now, name: s(b.name, 80), email: s(b.email, 120), type: s(b.type, 80), budget: s(b.budget, 60), when: s(b.when, 60), message: s(b.message, 3000) };
    if (!m.name || !/^\S+@\S+\.\S+$/.test(m.email) || m.message.length < 10) {
      return res.status(400).json({ error: "Please give your name, a valid email and a short message." });
    }
    recent.push(now); hits.set(ip, recent);
    try {
      const items = await readAll();
      items.unshift(m);
      await writeAll(items.slice(0, 300));
    } catch (e) {
      return res.status(500).json({ error: "Couldn't store the message (" + (e.message || "error") + ")." });
    }
    await notify(m);
    return res.status(200).json({ ok: true });
  }

  if (!isAdmin(req)) return res.status(401).json({ error: "Please log in as admin first." });
  if (req.method === "GET") return res.status(200).json({ items: await readAll() });
  if (req.method === "DELETE") {
    const id = String((req.query && req.query.id) || "");
    const items = (await readAll()).filter((m) => m.id !== id);
    try { await writeAll(items); } catch (e) { return res.status(500).json({ error: e.message || "Could not delete." }); }
    return res.status(200).json({ ok: true });
  }
  res.status(405).end();
}
