# Animal Ambulance Billing Platform

A workflow-first CMS that lets animal ambulance teams across India submit medicine invoices, get approvals from multi-level reviewers, and let the accounts team mark payments as complete. The app includes rich analytics and an admin-only control center for onboarding users, regions, and ambulances.

> **Tech stack** – Next.js 14 (App Router) · React 18 · Tailwind CSS · Prisma ORM · PostgreSQL · JSON Web Tokens for authentication

## Features

- **Role-based authentication** with admin-managed accounts (Admin, Operator, Level 1, Level 2, Accounts)
- **Bill submission workflow** with attachments, audit logs, and status transitions across review levels
- **Payment tracking** that records transaction metadata and closes the workflow with notifications
- **Operational analytics** providing national and region-wise spending data
- **Admin console** for user management, region creation, and ambulance fleet assignments

## Getting Started

### 1. Clone & install

```bash
npm install
```

> The container in this challenge cannot reach the npm registry, but the command above works locally or in CI/CD.

### 2. Configure environment

Create an `.env` file from the template:

```bash
cp .env.example .env
```

Set the following values:

- `DATABASE_URL` – PostgreSQL connection string (compatible with Neon/Vercel Postgres/Supabase). For local work you can point to a local Postgres instance.
- `SESSION_SECRET` – random string for signing JWT session cookies.
- `FILE_STORAGE_DIR` – where uploaded files are persisted. Defaults to `./public/uploads`.
- `NEXT_PUBLIC_APP_NAME` – branding string displayed in the UI.
- `EMAIL_FROM` – address to use in notification integrations (placeholder for now).

### 3. Create the database

Run Prisma migrations (or generate the schema in a managed Postgres service):

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Seed the initial admin user (optional, but recommended):

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe123 npx ts-node prisma/seed.ts
```

### 4. Start the dev server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with the seeded admin user. From there you can add regions, ambulances, and teammates.

## Deployment

### Deploying on Vercel

1. Push this repository to GitHub or GitLab.
2. In Vercel, create a new project from the repo.
3. Set the environment variables in **Project Settings → Environment Variables**:
   - `DATABASE_URL` – create a Vercel Postgres (Neon) database or use your own Postgres URI.
   - `SESSION_SECRET` – generate a random 32+ character string.
   - `FILE_STORAGE_DIR` – keep default; consider switching to object storage (see below).
   - Any optional mail provider secrets when you integrate notifications.
4. Add a **Build & Output** override if you prefer npm: `Build Command: npm run build`, `Install Command: npm install`, `Output Directory: .next`.
5. After the first deploy, run the Prisma migrations from the Vercel dashboard (or locally via `npx prisma migrate deploy` against the production DB).

> **File uploads in production** – the included helper saves files to the filesystem for local development. On Vercel the filesystem is ephemeral. Configure an object store (e.g., AWS S3, Cloudflare R2, Supabase Storage) and update `src/lib/upload.ts` to stream files there before going live.

### Deploying on Netlify

Netlify can host Next.js App Router projects using the Next.js Runtime.

1. Install the Next runtime in your project (already handled by dependencies once you run `npm install`).
2. In Netlify, create a new site from the repository.
3. Set build command to `npm run build` and publish directory to `.next`.
4. Enable **Essential Next.js Build Plugin** if prompted.
5. Provide the same environment variables under **Site settings → Build & deploy → Environment**.
6. Use a persistent Postgres provider (e.g., Supabase, Railway) and run `npx prisma migrate deploy` against it after deploy.

> Netlify/Next uses serverless functions. Prisma works with Data Proxy or Accelerate for best cold-start performance. Consider enabling Prisma Accelerate for production workloads.

### Database schema

The Prisma schema lives at `prisma/schema.prisma`. Core entities:

- `User` – platform accounts with roles and optional region assignments
- `Region` – administrative grouping (state, city)
- `Ambulance` – fleet units tied to a region and optional operator
- `Bill` – invoice metadata, attachments, and workflow status
- `BillAttachment` – uploaded documents linked to bills
- `BillStatusLog` – audit trail entries for status transitions
- `Payment` – payment metadata stored when accounts marks bills paid

Use `npx prisma studio` for a visual data browser.

### Suggested production enhancements

- Integrate an email/SMS provider to deliver notifications on status changes.
- Replace filesystem uploads with managed object storage and signed URLs.
- Add multi-factor authentication or SSO for admins.
- Implement SLA reminder jobs using a scheduled function (Vercel Cron/Netlify Scheduled Functions).
- Extend analytics with exportable CSV/PDF reports.

## Testing & linting

- `npm run lint` – check code quality with ESLint.
- Add Jest/Playwright as you expand automated coverage.

## Troubleshooting

- **403 when installing packages locally** – ensure you are not behind a proxy or using npm's strict security policies.
- **Database connection errors** – verify the `DATABASE_URL` host, username, and password. For Vercel Postgres ensure you allow access from Vercel's IP or use pooled connection strings.
- **JWT errors** – update `SESSION_SECRET` to a long random string and redeploy.

Happy shipping! 🐾
