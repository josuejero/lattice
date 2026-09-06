# Fairness engine

Last verified: 2026-09-05

## Current base model

Lattice currently uses a deterministic local-time burden proxy for each candidate slot.

For each attendee whose effective availability covers the candidate interval, the engine converts the UTC interval into the attendee's configured time zone and assigns a local-time penalty:

- fully within 09:00–17:00: `0`
- fully within 08:00–18:00: `0.25`
- fully within 07:00–19:00: `0.6`
- otherwise: `1`

The base candidate scores are:

- attendance = available attendees / total attendees;
- inconvenience = `1 - averagePenalty` among available attendees;
- fairness = `1 - maxPenalty` among available attendees;
- total = `0.6 * attendance + 0.2 * inconvenience + 0.2 * fairness`.

Using the maximum penalty means one attendee with an extreme local-time burden is not hidden by an otherwise favorable group average. Candidates are deterministic for deterministic inputs; ties fall back through attendance, fairness, and then start time.

## Availability invariants used by ranking

The base engine currently assumes:

- an attendee counts as available only when the entire candidate interval is covered by that attendee's effective availability;
- recurring windows are combined with one-off availability/unavailability overrides before ranking;
- attendee-local date/time conversion is performed before availability and burden evaluation;
- intervals crossing an attendee-local date boundary are not treated as ordinary covered candidates by the base availability check;
- candidates with no available attendees are discarded.

External-calendar busy blocks are incorporated upstream when effective scheduling inputs are assembled; the ranking algorithm itself should not reinterpret a known busy interval as available time.

## Event-aware ranking

The merged event-aware layer does not replace the base fairness proxy. It rescales candidate ordering for an event archetype using:

- target-group turnout;
- broad turnout;
- fit with preferred event time windows;
- base fairness;
- base inconvenience.

Weights are defined by the selected event archetype. The event-aware layer emits warnings when, for example, whole-organization availability is high but target-group availability is weak, a slot is outside a preferred time window, or the base fairness score is low.

## Evaluation expectations

A meaningful fairness/ranking change should be validated with more than a passing unit test. Depending on scope, use deterministic examples, property tests, simulations, adversarial/edge cases, time-zone cases, and before/after distribution analysis. Compare who gains and who bears additional burden rather than relying on one aggregate score.

Simulation source, fixtures, and deterministic inputs remain in Git. Preserve a major output in Drive only when it is evidence for a product decision or release acceptance and record its Git SHA, scenario/corpus, model version, environment where relevant, and result.

## Not currently implemented

The earlier design note about rolling 30-day burden budgets is not the current implementation. If Lattice adopts longitudinal burden accounting or another materially different fairness model, update this document, tests/simulations, and an ADR if the change is architecturally significant.
