# GitHub.md: 2-Person Collaboration & GitHub Development Process

> Defines how Person A (Orchestrator) and Person B (Automation Runtime) work together.
> Work split is defined in [backend.md](backend.md) §8–9; the frontend in `frontend/` is
> already built and gets bound to real endpoints by Person A later.

---

## 1. The Answer: Short-Lived Feature Branches → Protected `main` (Trunk-Based)

**Yes — each person works on branches and merges to `main` via pull request.** But the
crucial detail is *what kind* of branches:

✅ **DO: short-lived feature branches.** Each branch is one deliverable (one row from
backend.md §8/§9), lives **1–2 days max**, and merges to `main` the moment it compiles
and its tests pass — even if the feature is incomplete behind a mock.

❌ **DON'T: long-lived personal branches** (`person-a-dev`, `person-b-dev`) that merge
once at the end. This is the classic 2-developer failure mode: two weeks of divergence,
then a "big bang" merge where nothing integrates. Avoid at all costs.

❌ **DON'T: a shared `develop`/staging branch.** With 2 people and strict directory
ownership, an intermediate branch adds ceremony and delays integration without adding
safety. `main` + CI *is* the integration environment.

### Why this works specifically for this project

The architecture was already designed for it (plan.md §5): Person A owns
`routes/` + `services/` + `db/`, Person B owns `tools/`, and they communicate only
through frozen `contracts/` interfaces. **Merge conflicts are impossible by
construction** — git only conflicts when two branches edit the same lines of the same
file, and the ownership map guarantees that never happens. So the only real integration
risk is *semantic* drift (code that merges cleanly but doesn't work together), and the
cure for semantic drift is merging to `main` *frequently*, not carefully.

---

## 2. Repository Layout & Ownership Map

```
astor/
├── frontend/          # Built. Person A binds API endpoints later (owns it hereafter)
├── backend/
│   └── src/
│       ├── contracts/ # FROZEN after Day 0 — changes need BOTH approvals
│       ├── routes/    # Person A
│       ├── services/  # Person A
│       ├── db/        # Person A
│       └── tools/     # Person B
└── truth/             # Docs — either person, but PR like everything else
```

Enforced mechanically with a `CODEOWNERS` file at repo root:

```
# .github/CODEOWNERS
/backend/src/contracts/   @person-a @person-b
/backend/src/routes/      @person-a
/backend/src/services/    @person-a
/backend/src/db/          @person-a
/frontend/                @person-a
/backend/src/tools/       @person-b
```

With "Require review from Code Owners" enabled, GitHub automatically demands both
approvals on any contract change and routes each PR to its owner.

---

## 3. Branch Protection Rules (set on Day 0)

On `main`, enable:

| Rule | Setting | Why |
| ---- | ------- | --- |
| Require pull request before merging | ON, **1 approval** | Second pair of eyes; with 2 people the other person is always the reviewer |
| Require review from Code Owners | ON | Auto-enforces the ownership map + dual-approval on contracts |
| Require status checks to pass | ON: `build`, `test`, `lint` | A red build never lands on `main` |
| Require branch to be up to date before merging | ON | Forces rebase-then-merge, so CI ran against what `main` will actually become |
| Block direct pushes (include admins) | ON | No exceptions, no "quick fixes" straight to trunk |
| Allow squash merging only | ON (disable merge commits & rebase merging) | One branch = one clean commit on `main`; trivially revertable |

---

## 4. Daily Workflow Loop

```bash
# Morning, always:
git checkout main && git pull origin main

# Start a deliverable (branch names carry the owner + task id from backend.md):
git checkout -b person-a/a3-sse-manager        # or person-b/b3-guardrail-interlock

# Work in small commits. Push early, open a DRAFT PR immediately —
# the draft PR is your visible work-in-progress signal to the other person:
git push -u origin person-a/a3-sse-manager
gh pr create --draft --title "A3: SSE manager with Last-Event-ID replay"

# When green and done (≤ 2 days after branching):
gh pr ready            # flip draft → ready, other person reviews same day
# → squash-merge via GitHub, delete branch

# Immediately after any merge to main, BOTH people:
git checkout main && git pull    # stay within hours of trunk, never days
```

**Cadence rules:**

1. **Merge to `main` at least once per working day.** If a branch is older than 2 days,
   split it or merge it behind a mock.
2. **Review within 4 working hours.** With 2 people, a stale PR blocks half the team.
   Reviews check the contract boundary and obvious breakage — not style nitpicks.
3. **Rebase, don't merge, to update a branch:** `git rebase origin/main` keeps history
   linear and keeps the squash-merge clean.
4. **Never commit directly to `main`**, even for one-line fixes — open a PR; squash-merge
   takes 60 seconds when CI is green.

---

## 5. CI Pipeline (GitHub Actions, written Day 0)

`.github/workflows/ci.yml` runs on every PR and every push to `main`:

```yaml
jobs:
  backend:
    # postgres:16 + pgvector service container
    steps: [checkout, setup-node, npm ci, tsc --noEmit, eslint, vitest run]
  frontend:
    steps: [checkout, setup-node, npm ci, tsc --noEmit, vite build]
```

Key points:

- **Type-checking is the real integration test.** Because A and B interact only through
  TypeScript interfaces, `tsc --noEmit` across the whole backend catches contract
  violations the moment either side drifts — before any human review.
- Person B's Browserbase tests run against recorded fixtures/mocks in CI (no live
  browser sessions on every PR); one manually-triggered workflow (`workflow_dispatch`)
  runs the real end-to-end smoke test for the Day-5 handshake.
- Both jobs must be green to merge (enforced by branch protection §3).

---

## 6. The Contract Firewall Protocol

The `contracts/` directory is the *only* shared code surface, so it gets special rules:

1. **Day 0:** both developers pair-write every contract file in one sitting and merge it
   as the first PR. From then on, contracts are **frozen**.
2. **Amendment procedure** (rare, deliberate):
   - Open a PR titled `contract-change: <what and why>` touching ONLY contract files.
   - Both developers must approve (CODEOWNERS enforces this).
   - Merge it *before* writing any code that depends on the change; both immediately
     rebase active branches on the new `main`.
3. **Mock-first development** keeps the firewall useful from Day 1:
   - Person A ships the whole pipeline against a fake `executeBrowserTask` (backend.md A7).
   - Person B ships the whole runtime against a local harness (backend.md B5).
   - Both mocks implement the *real* contract types, so the Day-5 handshake is a
     one-line import swap — reviewed and merged like any other PR.

---

## 7. Issue Tracking & Communication

- **GitHub Issues, one per deliverable** (A1–A7, B1–B6 from backend.md), labeled
  `person-a` / `person-b` / `contract` / `frontend`, grouped in a single Project board
  with columns *Todo → In Progress → In Review → Done*.
- **PR descriptions link their issue** (`Closes #12`) so the board auto-updates.
- **Anything ambiguous about a contract becomes an issue comment, not a DM** — decisions
  must live where both people and future-you can find them.
- **Daily 10-minute sync:** what merged yesterday, what merges today, any contract pain.

---

## 8. Summary: Why This Process Is Seamless

| Risk | Mitigation |
| ---- | ---------- |
| Line-level merge conflicts | Directory ownership + CODEOWNERS — the two people physically never edit the same files |
| Semantic drift (compiles apart, breaks together) | Frozen TS contracts + whole-repo `tsc` in CI on every PR + daily merges to `main` |
| Big-bang integration failure | No long-lived branches; mock-first from Day 1; the real integration is a one-line Day-5 PR |
| Broken `main` | Branch protection: required CI + required review + no direct pushes |
| Blocked-on-review stalls | 2-day max branch age, 4-hour review SLA, draft PRs for visibility |
| "Who owns this?" ambiguity | Ownership map in §2 is exhaustive; contracts are the only shared surface and have a special protocol |
