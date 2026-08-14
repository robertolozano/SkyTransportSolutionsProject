# Subagents

Five domain experts, scoped to this project and committed with it.

## The test each one had to pass

**A subagent earns its place when it encodes judgment that is not already in the code, and that would otherwise be re-explained every time.**

An agent whose prompt amounts to "write good code, be careful" is worse than no agent: it spends a context window telling the model what it already does, and it dilutes routing for the agents that carry real knowledge. So each of these holds something specific — a regulation, a trap already hit, a boundary already argued about — and none of them overlap.

| Agent | Carries |
|---|---|
| `compliance-rules` | FMCSA / IFTA / IRP / CARB / HVUT domain knowledge, the rule anatomy, and the refuse-rather-than-guess principle |
| `data-layer` | Prisma and raw-SQL split, the non-TTY migration workflow, materialisation, and the 18,000-carrier question |
| `security-boundaries` | The three surfaces and their authorisation, untrusted-input handling, and the customer-list disclosure rule |
| `test-author` | Which runner covers what, pinning decisions rather than implementations, and the selector traps |
| `ui-ux` | Two audiences with opposite needs, the status colour language, and the honesty requirements in copy |

## What was deliberately rejected

- **`code-reviewer`** — "look for bugs" is the default behaviour; a general reviewer adds a hop and no knowledge.
- **`refactorer`** and **`performance`** — no stable judgment to encode. The real performance question here ("does it survive 18,000 carriers?") already lives in `data-layer`, where the schema decisions are made.
- **`accessibility`** — legitimate, but thin enough that splitting it out fragments attention rather than focusing it. Folded into `ui-ux`.
- **`docs-writer`** — the requirement that matters is not writing docs, it is that claims match reality. That belongs in the agents that make the claims.

The rejections are as much the point as the selections: five agents that route cleanly beat twelve that overlap.

## How they earn their keep

Most of what is in these files was learned the expensive way — a filter that silently vanished when two `where` clauses targeted the same relation, a valid PDF rejected because `File.type` was empty, a simulator that went quiet in exactly the case it existed to surface. Writing it down once means the next change starts from that knowledge instead of rediscovering it.
