# About the Project

## What Inspired Us

We were tired of the "tab tax" — the mental overhead of switching between Booking.com, Google Flights, grocery apps, and email just to get through a week. Every task required 47 clicks across 3 tabs, and none of these tools talked to each other.

We asked ourselves: *what if you could just ask?*

That question became **Astor** — an AI agent marketplace where each agent is a specialist. Hotel Booker knows hotels. Flight Booker knows flights. Grocery Runner knows your pantry. They share memory, stream their work in real-time, and always ask before spending your money.

## How We Built It

We split the work between two people from day one:

**Person A** owned the backend architecture — the orchestrator state machine, the agent registry, the SSE telemetry stream, the database schema, and the guardrail system. The orchestrator runs as a state machine (`QUEUED → HYDRATING → THINKING → EXECUTING_TOOL → COMPLETE`) that manages the full lifecycle of an agent run, including the critical pause for human authorization before any purchase.

**Person B** owned the browser automation layer — Playwright macros for Booking.com and Google Flights, the Stagehand integration for vision-based fallback, and the guardrail bridge that emits `action_required` events when a booking is ready for confirmation.

We converged on Day 5 to wire the two halves together, then iterated on the UI — moving from a sidebar layout to a full-screen browser viewport with a floating chat panel, adding a landing page with wouter routing, and building the glass-morphism design system from scratch.

The grocery runner was a late addition that taught us an important lesson: **not every agent needs browser automation.** Grocery stores (Walmart, Costco, Whole Foods) reliably block scraping, so we pivoted to a knowledge-based approach — the LLM proposes estimated prices, we resolve stock photos, and render a rich report instead of a live browser view.

## What We Learned

- **State machines are worth the complexity.** The orchestrator started as a simple async function and evolved into a full state machine with transitions, hooks, and error recovery. It was the hardest part to build but the most reliable part to debug.

- **Browser automation is fragile.** Booking.com changes its DOM constantly. We learned to use CSS selectors for speed (5-10x faster than vision models) but keep Stagehand as a fallback for when selectors break.

- **Guardrails aren't optional.** We almost shipped without human-in-the-loop confirmation. Then we realized: an AI that spends money without asking isn't helpful — it's terrifying. The guardrail system became a core feature, not an afterthought.

- **CORS will humble you.** We lost an hour to a `.env` file that had the wrong port (`5173` instead of `5183`). The fix was one line. The debugging was not.

- **Partner merges require care.** When my partner pushed the grocery-runner agent, it conflicted with my flight-booker changes in 7 files. We resolved every conflict by keeping both features — the grocery tools and flight tools coexist in the registry, the prompts are additive, and the orchestrator branches on agent slug.

## Challenges We Faced

**The merge conflict.** Seven files conflicted when we merged the grocery-runner and flight-booker branches. The orchestrator was the hardest — my partner's code had a placeholder `let result` and my code had the full `executeBrowserTask` call. We resolved it by keeping the grocery branch and the browser branch as separate `if/else` paths, each with their own result assignment.

**The 404 that wasn't a 404.** The `/api/agent/reply` endpoint returned 404 even though the route was defined in code. The backend was running stale code from before the merge. `tsx watch` didn't pick up the changes. A manual restart fixed it, but we lost 20 minutes thinking it was a routing issue.

**The button nesting warning.** React's `validateDOMNesting` warned that `<button>` can't appear inside `<button>`. Our `StarRating` component rendered interactive star buttons inside `AgentCard`, which was itself a `<motion.button>`. We fixed it by changing the stars to `<span role="button">` with keyboard support — same accessibility, valid HTML.

**Grocery stores don't want to be scraped.** We spent a day trying to automate Walmart and Costco before admitting defeat. The pivot to knowledge-based pricing was faster, more reliable, and honestly produced a better user experience — the report view is cleaner than a live browser viewport for this use case.

