# SQL Injection Prevention — Security Audit Checklist

## Status: ✅ Compliant

All database access goes through `src/lib/db.ts` which enforces parameterized queries
via the `pg` driver's `$1, $2, …` placeholder syntax. String interpolation into SQL
is prohibited by convention and enforced by code review.

---

## Audit Findings

### `src/lib/db.ts` — DB query wrapper
- [x] All queries use `query(text, params)` with positional placeholders
- [x] No string interpolation of user input into SQL
- [x] Transaction helper rolls back on error
- [x] Connection pool configured with timeouts

### `src/server/services/circle.service.ts`
- [x] `createCircle` — uses parameterized INSERT
- [x] `getCircleById` — uses `WHERE id = $1`
- [x] `listOpenCircles` — no user input, static query
- [x] `getCirclesByUser` — uses `WHERE creator_id = $1`
- [x] `joinCircle` — uses parameterized INSERT and SELECT
- [x] `getMembersByCircle` — uses `WHERE circle_id = $1`
- [x] `updateCircleStatus` — uses `WHERE id = $1`

### `src/server/services/payout.service.ts`
- [x] `processCyclePayout` — reads via service layer (parameterized)
- [x] `getPayoutsByCircle` — uses `WHERE circle_id = $1`

### `src/app/api/circles/route.ts`
- [x] Input validated with Zod before reaching service layer
- [x] No raw SQL in route handlers

### `src/app/api/auth/send-otp/route.ts`
- [x] Phone validated with regex before use
- [x] No SQL in this route

---

## Rules Enforced

1. **Never interpolate user input into SQL strings.**
   ```ts
   // ❌ WRONG
   query(`SELECT * FROM users WHERE phone = '${phone}'`)

   // ✅ CORRECT
   query('SELECT * FROM users WHERE phone = $1', [phone])
   ```

2. **All input validated with Zod schemas before reaching the DB layer.**

3. **All DB access goes through `src/lib/db.ts` — no direct `pg` client usage elsewhere.**

4. **Transactions used for multi-step writes** to prevent partial state.

---

## ORM / Query Builder Note

The project uses raw `pg` with the parameterized query wrapper in `src/lib/db.ts`.
This is equivalent to an ORM's parameterized query enforcement. If the team migrates
to Drizzle ORM or Prisma in the future, both enforce parameterized queries by default
and this checklist should be updated accordingly.
