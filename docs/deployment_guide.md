# Deploying NewsTrack to Render

This guide provides step-by-step instructions to deploy the **NewsTrack** application (PostgreSQL + FastAPI Backend + Vite/React Frontend) to [Render](https://render.com) using the configured `render.yaml` Blueprint.

---

## Prerequisites

1. A **GitHub** account with this project pushed to a repository (e.g. `https://github.com/charansridev/NewsTrack`).
2. A **Render** account (free tier is sufficient).

---

## Step 1: Push the Configuration Changes

Commit and push the updated `render.yaml` file (which specifies modern Python 3.11 and Node 20 runtimes) to your GitHub repository:

```bash
git add render.yaml
git commit -m "Configure modern Python and Node runtimes for Render"
git push origin main
```

---

## Step 2: Deploy the Blueprint on Render

1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Click the **New** button in the top-right corner and select **Blueprint**.
3. Connect your GitHub repository (`charansridev/NewsTrack`).
4. Render will automatically detect the `render.yaml` file and display the resources it will create:
   - **Database**: `newstrack-db` (PostgreSQL)
   - **Backend Web Service**: `newstrack-api` (FastAPI)
   - **Frontend Static Site**: `newstrack-frontend` (Vite/React)
5. Click **Apply** to trigger the deployment.

---

## Step 3: Handle Global Domain Conflicts (If Applicable)

Render service names must be globally unique across all Render subdomains (`*.onrender.com`). If `newstrack-api` or `newstrack-frontend` is already taken, Render will append a random suffix (e.g., `newstrack-api-4z3p.onrender.com`).

If Render assigns you different URLs:

1. **Get your actual URLs**:
   - Go to your Render Dashboard and click on your **Frontend Static Site** (`newstrack-frontend`) and **Backend Web Service** (`newstrack-api`) to copy their actual public URLs.
2. **Update Frontend Environment Variables**:
   - In the Render Dashboard, click on **newstrack-frontend** static site.
   - Go to **Environment** settings.
   - Update the following variables with your actual backend URL:
     - `VITE_API_BASE_URL` ➔ `https://YOUR-BACKEND-URL.onrender.com/v1`
     - `VITE_WS_URL` ➔ `wss://YOUR-BACKEND-URL.onrender.com/v1`
   - Click **Save Changes**. This will trigger a rebuild of the static site.
3. **Update Backend CORS Configuration**:
   - In the Render Dashboard, click on the **newstrack-api** web service.
   - Go to **Environment** settings.
   - Update `CORS_ORIGINS` to match your actual frontend URL (e.g., `https://YOUR-FRONTEND-URL.onrender.com`).
   - Click **Save Changes**. This will redeploy the backend service.

---

## Step 4: Seed the Database

Once the database and backend services are successfully deployed, you need to seed the database with realistic demo data so you can log in.

1. In the Render Dashboard, select your **newstrack-api** Web Service.
2. In the left navigation pane, click on the **Shell** tab.
3. In the terminal command prompt, run:
   ```bash
   cd backend && python -m app.seed
   ```
4. This command will populate the database with the pre-configured organizations, roles, routes, and sample logs.

---

## Step 5: Test the Deployed App

Access your frontend application using its public URL. You can use the following pre-seeded credentials to log in:

### Platform Users (Log in at frontend app)
* **Administrator**: `admin@nt.example` / `admin-pass`
* **Distribution Manager**: `manager@nt.example` / `manager-pass`
* **Hub Operator**: `operator@nt.example` / `operator-pass`
* **Vendor**: `vendor@nt.example` / `vendor-pass`
* **Press User**: `press@nt.example` / `press-pass`

### Drivers (Log in via API endpoints/mobile flow)
* **Driver 1**: Mobile: `9800000001` / Password: `driver-pass`
* **Driver 2**: Mobile: `9800000002` / Password: `driver-pass`
