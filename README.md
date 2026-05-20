# SellerFix MVP

SellerFix is a marketplace seller control platform prototype for WB and Ozon.

This repository now has:
- `index.html`, `styles.css`, `app.js` — existing frontend prototype UI
- `backend/` — Node.js + Express MVP backend with API and seed data

## Project structure

- `/Users/macbook/Documents/New project/projects/realstats/index.html`
- `/Users/macbook/Documents/New project/projects/realstats/styles.css`
- `/Users/macbook/Documents/New project/projects/realstats/app.js`
- `/Users/macbook/Documents/New project/projects/realstats/backend/package.json`
- `/Users/macbook/Documents/New project/projects/realstats/backend/src/server.js`
- `/Users/macbook/Documents/New project/projects/realstats/backend/src/routes/api.js`
- `/Users/macbook/Documents/New project/projects/realstats/backend/src/data/seed.js`
- `/Users/macbook/Documents/New project/projects/realstats/backend/src/services/unitEconomicsService.js`
- `/Users/macbook/Documents/New project/projects/realstats/backend/src/db/schema.sql`
- `/Users/macbook/Documents/New project/projects/realstats/backend/.env.example`

## Backend run (local)

1. Open terminal:
```bash
cd "/Users/macbook/Documents/New project/projects/realstats/backend"
```

2. Install dependencies:
```bash
npm install
```

3. Create env file:
```bash
cp .env.example .env
```

4. Start backend:
```bash
npm run dev
```

5. Run API tests:
```bash
npm test
```

Backend default URL:
`http://localhost:4000`

Health check:
`GET http://localhost:4000/health`

## API endpoints

- `GET /api/dashboard/summary`
- `GET /api/products`
- `GET /api/operations`
- `POST /api/operations`
- `GET /api/unit-economics`
- `GET /api/alerts`
- `GET /api/profit-leaks`

## Profit Leak Engine

`GET /api/profit-leaks` runs a decision layer over unit economics and returns where money is leaking.

It detects:
- SKU in loss
- low margin
- high DRR
- high marketplace costs
- healthy opportunity

Each item includes reason, recommended action, severity, and metrics snapshot.

## Validation and errors

- `POST /api/operations` has request validation.
- Backend returns structured errors via middleware:
```json
{
  "error": {
    "message": "Validation failed: ...",
    "status": 400
  }
}
```

## Security note

WB/Ozon tokens must be server-side only (in backend `.env`):
- `WB_API_TOKEN`
- `OZON_CLIENT_ID`
- `OZON_API_KEY`

They are not persisted in frontend `localStorage`.
