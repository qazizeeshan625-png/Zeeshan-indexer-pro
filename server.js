import express from "express";
import session from "express-session";
import { google } from "googleapis";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!APP_PASSWORD || !SESSION_SECRET) {
  console.error("Set APP_PASSWORD and SESSION_SECRET in .env before starting.");
  process.exit(1);
}

app.use(express.json({ limit: "1mb" }));
app.use(session({
  name: "zip.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static("public"));
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });

app.post("/api/login", (req, res) => {
  if (req.body?.password !== APP_PASSWORD) return res.status(401).json({ error: "Incorrect password." });
  req.session.authenticated = true;
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/session", (req, res) => res.json({ authenticated: !!req.session.authenticated }));

function requireAuth(req, res, next) {
  if (!req.session?.authenticated) return res.status(401).json({ error: "Please sign in first." });
  next();
}

let authClientPromise;
async function getSearchConsoleClient() {
  if (!GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Google API is not configured. Set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON file path.");
  }
  if (!authClientPromise) {
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"]
    });
    authClientPromise = auth.getClient();
  }
  const authClient = await authClientPromise;
  return google.searchconsole({ version: "v1", auth: authClient });
}

app.post("/api/inspect", requireAuth, apiLimiter, async (req, res) => {
  const { urls, siteUrl } = req.body || {};
  if (!Array.isArray(urls) || urls.length < 1 || urls.length > 100) {
    return res.status(400).json({ error: "Send between 1 and 100 URLs per batch." });
  }
  if (typeof siteUrl !== "string" || !siteUrl.trim()) {
    return res.status(400).json({ error: "Enter a Search Console property, e.g. sc-domain:example.com or https://www.example.com/." });
  }
  try {
    const client = await getSearchConsoleClient();
    const results = [];
    // Sequential calls are intentional: easier to respect per-property quotas.
    for (const rawUrl of urls) {
      let url;
      try { url = new URL(rawUrl).href; } catch { results.push({ url: rawUrl, status: "error", message: "Invalid URL" }); continue; }
      try {
        const response = await client.urlInspection.index.inspect({
          requestBody: { inspectionUrl: url, siteUrl: siteUrl.trim(), languageCode: "en-US" }
        });
        const result = response.data?.inspectionResult;
        const index = result?.indexStatusResult || {};
        const verdict = index.verdict || "VERDICT_UNAVAILABLE";
        let status = "unknown";
        if (verdict === "PASS" || verdict === "PARTIAL") status = "indexed";
        else if (verdict === "FAIL" || verdict === "NEUTRAL") status = "notindexed";
        results.push({
          url, status, verdict,
          coverageState: index.coverageState || "",
          indexingState: index.indexingState || "",
          robotsTxtState: index.robotsTxtState || "",
          pageFetchState: index.pageFetchState || "",
          googleCanonical: index.googleCanonical || "",
          userCanonical: index.userCanonical || "",
          lastCrawlTime: index.lastCrawlTime || "",
          message: index.coverageState || verdict
        });
      } catch (err) {
        const message = err?.response?.data?.error?.message || err.message || "Inspection failed";
        results.push({ url, status: "error", message: String(message).slice(0, 350) });
      }
      await new Promise(resolve => setTimeout(resolve, 180));
    }
    res.json({ results, count: results.length, note: "Official URL Inspection results are available only for URLs under a Search Console property your Google service account can access." });
  } catch (err) {
    res.status(500).json({ error: err.message || "Google API setup failed." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, googleConfigured: !!GOOGLE_APPLICATION_CREDENTIALS }));
app.listen(PORT, () => console.log(`Zeeshan Indexer Pro running on http://localhost:${PORT}`));
