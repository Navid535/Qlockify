# Quera Clock Frontend

Frontend web application for Qlockify.

## Project Structure

This repository contains both backend and frontend parts of the Quera Clock project.

- `backend/`: Django REST API backend
- `frontend/`: React frontend application

## What This Repo Contains

- React application
- authenticated product UI
- public landing page
- workspace-based business screens
- Persian and English localization
- Google sign-in onboarding UI
- client-side caching and API integration layer

## Stack

- React `19`
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Headless UI / custom UI primitives
- Sonner toasts
- Recharts

## Project Layout

```text
frontend/
  public/
  src/
    api/
    components/
    context/
    hooks/
    lib/
    locales/
    pages/
  index.html
  package.json
```

## Main Areas

- `src/pages`: route-level screens
- `src/components`: reusable UI and page modules
- `src/api`: backend request layer
- `src/context`: workspace and notification state
- `src/locales`: English and Persian dictionaries
- `src/lib`: session, permissions, caching, helpers

## Local Development

### 1. Install dependencies

```powershell
npm install
```

### 2. Configure environment

Copy and fill:

```text
.env.sample -> .env
```

Default local API base:

```text
VITE_API_BASE_URL=http://localhost:8000
```

If your backend runs behind `/api`, use:

```text
VITE_API_BASE_URL=http://localhost:8000/api
```

### 3. Start development server

```powershell
npm run dev
```

Default local URL:

- `http://localhost:5173`

## Available Scripts

Development:

```powershell
npm run dev
```

Production build:

```powershell
npm run build
```

Preview production build:

```powershell
npm run preview
```

Lint:

```powershell
npm run lint
```

## Product Routes

Main application routes include:

- `/`
- `/auth`
- `/auth/google/callback`
- `/timesheet`
- `/reports`
- `/logs`
- `/notifications`
- `/workspaces`
- `/projects`
- `/clients`
- `/tags`
- `/profile`

## Authentication UX

Supported flows in the UI:

- password login
- OTP login
- OTP registration
- Google sign-in

Google sign-in flow:

- start from the auth page
- backend performs OAuth callback handling
- frontend callback page loads the flow state
- new users complete mobile onboarding
- existing mobile owners verify claim via OTP

## Localization

The application is bilingual:

- English
- Persian

Translation dictionaries live in:

- `src/locales/en.ts`
- `src/locales/fa.ts`

## Notes

- the frontend expects the backend API contract defined in the backend repo
- deployment, domain, SSL, and Nginx details belong in the deployment repo
- this repo focuses on application UI and browser runtime behavior
