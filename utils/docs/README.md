# Utils Module

## Purpose

Shared utility patterns and helpers applicable across any stack.

## Documented Patterns

- **Result Pattern** — Encapsulate success/failure without exceptions
- **Guard Clauses** — Input validation helpers
- **Date/Time** — Always use UTC internally, convert at boundaries
- **Money** — Use integer cents/minor units, never floating point
- **Pagination** — Cursor-based preferred, offset-based when required
- **Error Codes** — Standardized error code format: `{DOMAIN}_{CATEGORY}_{CODE}`

## Error Code Format

```
AUTH_INVALID_TOKEN
PAYMENT_INSUFFICIENT_FUNDS
PLATFORM_RATE_LIMIT_EXCEEDED
```
