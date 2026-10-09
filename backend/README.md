# Backend

This backend provides a simple registration API.

## Start

For local development, the admin password is `1616`. Enter it at `http://localhost:5173/admin.html` to view student registrations. You can override it with `ADMIN_TOKEN` in `.env`.

The four-digit password is only for local development. In production, set `ADMIN_TOKEN` to a private value at least 20 characters long and use HTTPS; admin access stays disabled without it.

```bash
npm install
npm run dev
```

Student submissions are stored in `registrations.sqlite`. The existing database is upgraded automatically when the backend starts.

New-student submissions require a Grade 12 certificate, Grade 9-12 transcript, Grade 8 certificate, and Grade 10 certificate. Select all four files together in the single upload field. Each file must be PDF, JPG, or PNG and no larger than 5 MB. Files are stored under `private-certificates/`, which is not served publicly; admins can download them from the protected records page. Deleting a registration also deletes its documents.
