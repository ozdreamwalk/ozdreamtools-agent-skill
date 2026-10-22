---
name: ozdreamtools
description: Pay-per-call checks for German law and websites over x402 (USDC on Base, no account, no API key). Imprint check (§ 5 DDG), invoice mandatory details (§ 14 UStG), BFSG accessibility quickcheck, public holidays per German state, statutory deadlines (§§ 187-193 BGB), cold outreach rules per country, IBAN and EU VAT number format, robots.txt linting (RFC 9309), llms.txt generation, agent-readiness score, product page purchasability. Use when an agent has to check a German imprint, invoice, deadline or holiday, or audit a website for AI agents and crawlers.
metadata:
  openclaw:
    emoji: "🧾"
    homepage: https://api.ozdreamtools.de
    requires:
      bins: ["bun"]
    envVars:
      - name: X402_PRIVATE_KEY
        required: false
        description: Private key of a dedicated, low-balance Base wallet holding USDC. Only needed for paid calls. Without it the skill lists routes and shows prices but pays nothing.
---

# OzDreamTools

Paid HTTP endpoints at `https://api.ozdreamtools.de`, operated by OzDreamWalk (Germany). Each call costs a few cents in USDC on Base mainnet and is paid inline with HTTP 402 (x402). There is no account, no signup and no subscription. The subject matter is German law and German text; the interface is English.

## When to use

- Check whether a German website imprint (Impressum) has the mandatory disclosures of § 5 DDG.
- Check a German invoice for the ten mandatory details of § 14 (4) UStG.
- Find the public holidays of a German federal state, or compute when a legal deadline ends.
- Ask whether cold email, phone, SMS or postal outreach is allowed in a given country.
- Validate an IBAN or the format of an EU VAT number.
- Audit a website for AI agents: agent-readiness score, robots.txt lint, llms.txt generation, accessibility quickcheck (BFSG), product page purchasability.

## Workflow

1. **Read the catalog first (free).** It is the source of truth for routes, prices, input schemas and examples:
   ```bash
   bun scripts/call.ts --catalog
   ```
   The raw catalog is `GET https://api.ozdreamtools.de/api/catalog`. Do not rely on a route list in this file; the catalog is always current.
2. **Build the request body** from the route's `input_schema` and `input_example`. Every route assesses only what you send. The service makes no outbound request of its own, so you fetch the page, robots.txt or invoice text yourself and pass it in.
3. **Check the price without paying:**
   ```bash
   bun scripts/call.ts /api/imprint/check @body.json --dry-run
   ```
   Invalid input is rejected with 400 before the paywall and costs nothing.
4. **Pay and call** (needs `X402_PRIVATE_KEY`):
   ```bash
   bun scripts/call.ts /api/imprint/check @body.json --max-usdc 0.10
   ```
   The script refuses to pay if the requested amount exceeds `--max-usdc` (default 0.20), if the network is not Base mainnet or if the asset is not USDC. It prints the JSON result and the settlement transaction hash.

Run `bun install` once in this skill's directory before the first call.

## Spending rules

- Ask the user before the first paid call in a session unless they have given you a budget.
- Use a dedicated wallet with a small USDC balance. Never use a main wallet key. No ETH is needed; the facilitator pays the transaction fee.
- The script never prints or stores the key.

## Reading results

- `unknown`: not supplied, therefore not measured. It does not count against the score.
- `not_applicable`: not present in the document, therefore not a defect.
- `missing`: measured and found wanting. Only this state produces a recommendation.

Statute names, citations and holiday names are returned verbatim in German because they are the product. Results are technical checks with citations, not legal or tax advice.

## Without the script

Any x402 client works. Call the route, read the `PAYMENT-REQUIRED` header of the 402 response (amount, asset, network, receiving address), sign an EIP-3009 authorisation and repeat the request with `PAYMENT-SIGNATURE`. The official `@x402/fetch` library does this for you. The routes are also listed in the Coinbase x402 Bazaar.

## Contact

OzDreamWalk, office@ozdreamwalk.com. Imprint: https://api.ozdreamtools.de/impressum.html
