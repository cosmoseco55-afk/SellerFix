# AGENTS Rules for SellerFix

## Scope
- Keep frontend prototype UX stable (`index.html`, `styles.css`, `app.js`).
- Add business logic and integrations in `backend/`.

## Architecture rules
- Frontend is presentation-first; backend is source of truth.
- Unit economics and rules engine logic should live in backend services.
- API contracts should be backward-compatible where possible.

## Data and security
- Never store WB/Ozon API credentials in frontend `localStorage`.
- Use backend environment variables only:
  - `WB_API_TOKEN`
  - `OZON_CLIENT_ID`
  - `OZON_API_KEY`
- Avoid committing real secrets.

## Coding rules
- Keep changes minimal and cohesive.
- Prefer explicit, testable pure functions for financial calculations.
- For rules engine, keep thresholds configurable in one place.
- Add or update backend tests when changing API behavior or validation.

## API conventions
- JSON only.
- Stable field names in snake_case for backend payloads.
- Use clear numeric semantics (all money in RUB, absolute values where expected).

## Delivery workflow
- Update `README.md` when run steps or API change.
- Keep deployment docs in `deploy/` aligned with actual runtime.
- For new endpoints: include input validation and centralized error handling.
