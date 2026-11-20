import { put } from "@vercel/blob";
import { isAdmin, blobToken } from "./_lib.js";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 4.4 * 1024 * 1024;

async function bodyBuffer(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAdmin(req)) return res.status(401).json({ error: "Please log in as admin first." });
  try {
    const type = String(req.headers["x-file-type"] || "");
    if (!OK_TYPES.includes(type)) return res.status(400).json({ error: "Only JPG, PNG, WEBP or GIF pictures are allowed." });
    let name = "design.jpg";
    try { name = decodeURIComponent(String(req.headers["x-file-name"] || name)); } catch {}
    name = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "design.jpg";
    const body = await bodyBuffer(req);
    if (!body.length) return res.status(400).json({ error: "The picture arrived empty. Please try again." });
    if (body.length > MAX_BYTES) return res.status(413).json({ error: "That picture is too big even after shrinking." });
    const blob = await put("designs/" + name, body, { token: blobToken(), access: "public", addRandomSuffix: true, contentType: type });
    res.status(200).json({ url: blob.url });
  } catch (e) {
    res.status(500).json({ error: e.message || "Upload failed." });
  }
}
