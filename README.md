# OzDreamTools agent skill

An agent skill for the paid x402 endpoints at [api.ozdreamtools.de](https://api.ozdreamtools.de): checks for German law and websites, paid per call in USDC on Base. No account, no API key.

```bash
npx skills add ozdreamwalk/ozdreamtools-agent-skill
```

Then, inside the skill directory:

```bash
bun install
bun scripts/call.ts --catalog
```

See [`skills/ozdreamtools/SKILL.md`](skills/ozdreamtools/SKILL.md) for the workflow, the spending cap and how to read results. Paid calls need `X402_PRIVATE_KEY`, the key of a dedicated, low-balance wallet. Without it the skill shows prices and pays nothing.

Operated by OzDreamWalk, office@ozdreamwalk.com. Results are technical checks with citations, not legal or tax advice.

License: MIT
