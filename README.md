# Sarkari Suchna India - Backend

Production-focused Node.js + Express backend for content generation, publishing, search, and admin operations.

## Tech Stack

- Node.js (CommonJS)
- Express
- MySQL (`mysql2/promise`)
- Redis
- JWT auth with cookie-based session

## Prerequisites

- Node.js 18+
- MySQL server
- Redis server

## Setup

1. Install dependencies:
   - `npm install`
2. Create environment file:
   - copy `.env.example` to `.env`
3. Update `.env` values for your machine.
4. Run app:
   - Development: `npm run dev`
   - Production: `npm start`

## Environment Variables

Required keys are documented in `.env.example`:

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `ADMIN_USER`
- `ADMIN_PASS_HASH`
- `DB_HOST`
- `DB_USER`
- `DB_PASS`
- `DB_NAME`
- `REDIS_HOST`
- `REDIS_PORT`
- `CORS_ORIGINS`

## API Notes

- Public routes are mounted under `/api`.
- Admin routes are mounted under `/api/admin`.
- Login endpoint: `POST /api/admin/login`
- Protected endpoints require valid `token` cookie.

## Security Practices Included

- Helmet headers
- Rate limiting
- Cookie-based auth with env-based cookie hardening
- CORS allowlist via `CORS_ORIGINS`
- Path traversal protection on file delete endpoint

## Current Scripts

- `npm start`: Start server
- `npm run dev`: Start with Node watch mode
- `npm test`: Run Jest API tests
- `npm run lint`: Run ESLint checks
- `npm run lint:fix`: Auto-fix lint issues
- `npm run format`: Format code with Prettier
- `npm run format:check`: Check formatting

## Recommended Next Improvements

- Expand integration tests for page lifecycle and file flows
- Add migration system for database schema
