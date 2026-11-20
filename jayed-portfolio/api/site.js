import { readSite } from "./_lib.js";

export default async function handler(req, res) {
  const site = await readSite();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(site);
}
