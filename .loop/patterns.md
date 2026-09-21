# Loop Patterns
- Use UPSERT logic (`INSERT OR REPLACE` or `ON CONFLICT` constraints) to ensure idempotency.
- Run async schedules with standard library mechanisms (`threading`, `sched`, etc.) without blocking the main event loop.
