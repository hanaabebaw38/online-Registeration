# Frontend

This is the frontend project for the online registration app.

## Backend URL

The frontend uses `https://online-registeration-backend.onrender.com` by default, configured in `src/api.js`. To test with a local backend, copy `.env.example` to `.env.local` and set `VITE_API_URL=http://localhost:5000`. Vite reads this value when building the frontend; `.env.local` is ignored by Git.

## GitHub Pages

The workflow in `.github/workflows/deploy-frontend.yml` builds and deploys the frontend when changes are pushed to `main`. In the repository settings, open **Pages** and set the build source to **GitHub Actions**. The build configures the `/online-Registeration/` project path automatically.

