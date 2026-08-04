# Student Management App

This repository contains a student record tracking application with a Node.js/Express backend and a React frontend.

## Repository structure

- `backend/` — Express app source, database setup, middleware, and API routes
- `src/` — React application source and responsive UI styles
- `server.js` — Root entrypoint that serves the frontend and backend together
- `package.json` — Root Node.js manifest for deployment on Render
- `.env.example` — Recommended environment variables
- `render.yaml` — Render service configuration for easy deployment

## Local development

Install dependencies and start the app:

```bash
npm install
npm start
```

Copy the environment example and configure your SMTP provider to enable OTP email delivery:

```bash
cp .env.example .env
```

The app will run on `http://localhost:5000`.

For frontend development with hot reload, use `npm run dev`. The React app runs at `http://localhost:5173` and proxies API requests to Express. Run `npm run build` before `npm start` to create the production bundle in `dist/`.

### Email settings

To send OTPs and support tickets via email, set the following in `.env`:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SUPPORT_EMAIL`
- `GMAIL_APP_PASSWORD` (optional fallback when SMTP is unavailable)

If SMTP is not configured, OTPs still work in development and are logged to the console, and support tickets are accepted but not emailed.

### Optional image uploads

If you want hosted logo uploads, set:

- `CLOUDINARY_URL`

When configured, image uploads are sent to Cloudinary instead of local storage.

## Render deployment

Render will use the root `package.json` and `server.js`. Add production environment variables via the Render dashboard or use the `.env.example` for reference.
