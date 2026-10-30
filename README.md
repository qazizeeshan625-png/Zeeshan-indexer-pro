# Zeeshan Indexer Pro — online-ready starter

This is a single-user web app starter with a professional dashboard, bulk URL entry/import, status tracking, CSV export, password-protected dashboard, and optional Google Search Console URL Inspection API integration.

## Important limitation
Google's URL Inspection API returns Google's indexed-version data **only for URLs under a Search Console property that the authenticated account can access**. It does not provide official indexing checks for arbitrary third-party guest-post sites. This app does not use the Google Indexing API to submit ordinary blog posts; Google's Indexing API is limited to pages containing `JobPosting` or livestream `BroadcastEvent` structured data.

## Run locally
1. Install Node.js 20+.
2. Unzip this folder and open a terminal in the folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and set a strong `APP_PASSWORD` and `SESSION_SECRET`.
5. Start with `npm start`.
6. Open `http://localhost:3000` in your browser.

The app can be tested without Google API credentials; the dashboard, URL list, and CSV export work. Actual API inspection requires the Google setup below.

## Enable official Google URL Inspection
1. In Google Cloud Console, create/select a project and enable the **Google Search Console API**.
2. Create a service account and download its JSON key. Keep the JSON file private and **never upload it to a public repository or share it**.
3. Put the JSON file in this folder for local testing, or store it securely on your hosting platform and set `GOOGLE_APPLICATION_CREDENTIALS` to its path.
4. Add the service-account email as a user with suitable read access to each relevant Search Console property.
5. In the app, enter the matching property exactly:
   - Domain property: `sc-domain:example.com`
   - URL-prefix property: `https://www.example.com/` (include trailing slash)
6. Add URLs belonging to that property and click **Inspect with Google API**.

Google currently documents a URL Inspection quota of 2,000 queries per day per property and 600 per minute per property; quotas can change. The app limits each request batch to 100 URLs and processes sequentially.

## Deploy online
Deploy this Node app to a Node-compatible host (for example Render, Railway, or a VPS). Set environment variables in the host dashboard:
- `APP_PASSWORD`
- `SESSION_SECRET`
- `NODE_ENV=production`
- `GOOGLE_APPLICATION_CREDENTIALS` pointing to a securely stored service-account JSON file

Use HTTPS. Do not commit `.env` or the service-account JSON file. For a public multi-user SaaS, add user accounts, persistent database, stronger session storage, billing/quotas, and abuse monitoring before opening it to customers.

## Status meanings
- **Indexed**: API verdict `PASS` for the inspected indexed version.
- **Not indexed**: API verdict `FAIL` or `NEUTRAL`.
- **Unknown**: Google did not return a recognized verdict.
- **Error**: the API could not inspect that URL (wrong property, permission, quota, etc.).

A Google inspection result is not a guarantee of search impressions or rankings.
