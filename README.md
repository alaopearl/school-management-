# Student Management App

This repository contains a student record tracking application with a Node.js/Express backend and a static frontend.

## Repository structure

- `backend/` — Express app source, database setup, middleware, and API routes
- `frontend/` — Static UI assets, including `index.html`, `script.js`, and `style.css`
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

The app will run on `http://localhost:5000`.

## Render deployment

Render will use the root `package.json` and `server.js`. Add production environment variables via the Render dashboard or use the `.env.example` for reference.
