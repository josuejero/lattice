# Fairness Engine (Phase 3)

v1 uses a simple, deterministic fairness proxy:
- compute a local-time penalty for each available attendee
- fairness score = 1 - maxPenalty

This avoids recommending slots that are great for most but punishing for one person.

Future phases can replace this with rolling 30-day burden budgets once we have scheduled events.
