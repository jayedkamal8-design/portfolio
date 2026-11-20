import crypto from "node:crypto";
import { put, list } from "@vercel/blob";

const WEEK = 7 * 24 * 3600;
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
const sign = (v) => crypto.createHmac("sha256", secret()).update(v).digest("hex");

export function makeCookie() {
  const exp = String(Date.now() + WEEK * 1000);
  return `admin=${exp}.${sign(exp)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${WEEK}`;
}
export const clearCookie = () => "admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";

export function isAdmin(req) {
  if (!secret()) return false;
  const m = /(?:^|;\s*)admin=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function checkPassword(p) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real || typeof p !== "string") return false;
  const a = crypto.createHash("sha256").update(p).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export const DEFAULT_SITE = {
  name: "Jayed Kamal",
  tag: "Graphic designer",
  bio: "Hello, and welcome to my design world! I'm Jayed, a designer who loves turning ideas into posters, greetings and visuals that people remember. Take a look around, I'm glad you're here.",
  email: "jayedkamal8@gmail.com",
  links: [
    ["Behance", "https://www.behance.net/jof4"],
    ["Instagram", "https://instagram.com/jayed_kamal"],
    ["Facebook", "https://facebook.com/jayed.kamal.5"],
    ["LinkedIn", "https://linkedin.com/in/jayed-kamal"],
  ],
  works: [],
  exp: [],
  ach: [],
};

export async function readSite() {
  try {
    const { blobs } = await list({ prefix: "site.json", limit: 1 });
    if (!blobs.length) return DEFAULT_SITE;
    const r = await fetch(blobs[0].url + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return DEFAULT_SITE;
    return await r.json();
  } catch {
    return DEFAULT_SITE;
  }
}

export async function writeSite(site) {
  await put("site.json", JSON.stringify(site), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}
