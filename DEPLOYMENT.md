# Deployment Guide

This guide covers the deployment of the backend to Render and the frontend to Vercel.

## 1. Frontend Deployment on Vercel

Since this project is a Vite-based frontend application, deploying it to Vercel is straightforward.

### Steps:
1. **Push your code to GitHub/GitLab/Bitbucket.**
2. Go to [Vercel](https://vercel.com/) and sign in.
3. Click on **Add New...** > **Project**.
4. Import your Git repository.
5. Vercel will automatically detect that you are using Vite and set the correct build settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build` or `npm run build` (or `bun run build`)
   - **Output Directory:** `dist`
6. **Environment Variables:** Expand the "Environment Variables" section and add the variables from your `.env` file (e.g., `VITE_GOOGLE_MAPS_API_KEY`).
7. Click **Deploy**.

> [!TIP]
> Ensure your `VITE_GOOGLE_MAPS_API_KEY` is properly set in Vercel so the frontend maps can load.

---

## 2. Backend Deployment on Render

If your project includes a Node.js/Express backend (or another backend technology), you can deploy it on Render.

### Steps:
1. Go to [Render](https://render.com/) and sign in.
2. Click on **New** and select **Web Service**.
3. Connect your Git repository.
4. Configure the settings based on your backend:
   - **Name:** Choose a name for your backend service.
   - **Language:** Node (or the language of your backend).
   - **Branch:** `main` or the appropriate branch.
   - **Root Directory:** If your backend is in a subfolder (e.g., `server/`), specify it here.
   - **Build Command:** e.g., `npm install` or `npm run build`.
   - **Start Command:** e.g., `npm start` or `node index.js`.
5. **Environment Variables:** Add the backend environment variables from your `.env` file (like `GEMINI_API_KEY`, `APP_URL`, Database URIs, etc.).
6. Select your instance type (Free tier is available).
7. Click **Create Web Service**.

> [!NOTE]
> Once deployed, you might need to update your frontend's environment variable (e.g., `VITE_API_URL`) in Vercel to point to the live Render backend URL.
