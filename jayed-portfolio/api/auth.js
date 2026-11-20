import { isAdmin, checkPassword, makeCookie, clearCookie } from "./_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ admin: isAdmin(req) });
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearCookie());
    return res.status(200).json({ admin: false });
  }
  if (req.method === "POST") {
    if (!process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ error: "ADMIN_PASSWORD is not set in Vercel yet." });
    }
    if (!checkPassword(req.body && req.body.password)) {
      await new Promise((r) => setTimeout(r, 800));
      return res.status(401).json({ error: "Wrong passcode." });
    }
    res.setHeader("Set-Cookie", makeCookie());
    return res.status(200).json({ admin: true });
  }
  res.status(405).end();
}
