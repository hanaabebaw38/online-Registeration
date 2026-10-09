# Frontend

This is the frontend project for the online registration app.

## Backend URL

The API base URL is configured in `src/api.js`. For a deployed backend, copy `.env.example` to `.env.local` and set `VITE_API_URL` to the backend origin, for example `https://your-backend.example.com`. Keep the backend API paths unchanged. Vite reads this value when building the frontend; `.env.local` is ignored by Git.

