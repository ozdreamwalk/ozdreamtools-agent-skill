/**
 * Call a paid OzDreamTools route over x402, with a hard spending cap.
 *
 *   bun scripts/call.ts --catalog
 *   bun scripts/call.ts <path> <json | @file.json> [--max-usdc 0.20] [--dry-run]
 *
 * Without X402_PRIVATE_KEY (or with --dry-run) nothing is paid: the script shows
 * what the route would cost and stops. The key is read from the environment and
 * never printed.
 *
 * Exit codes: 0 ok · 1 refused or failed · 2 bad input (nothing paid) · 3 dry run.
 */
import { readFileSync } from "node:fs";
import { formatUnits, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const ORIGIN = "https://api.ozdreamtools.de";
const NETWORK = "eip155:8453";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const USER_AGENT = process.env.OZDREAMTOOLS_USER_AGENT ?? "ozdreamtools-agent-skill/1.0";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function fail(code: number, message: string): never {
  console.error(message);
  process.exit(code);
}

if (flag("--catalog")) {
  const res = await fetch(`${ORIGIN}/api/catalog`, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) fail(1, `catalog: HTTP ${res.status}`);
  const catalog = (await res.json()) as {
    routes: Array<{ id: string; method: string; path: string; price: string; service_name: string }>;
  };
  for (const r of catalog.routes) console.log(`${r.price.padEnd(6)} ${r.method} ${r.path}  ${r.service_name}`);
  console.log(`\nInput schemas and examples: ${ORIGIN}/api/catalog`);
  process.exit(0);
}

const [path, rawBody] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--max"));
if (!path?.startsWith("/api/") || !rawBody) {
  fail(2, "usage: bun scripts/call.ts <path> <json | @file.json> [--max-usdc 0.20] [--dry-run]\n       bun scripts/call.ts --catalog");
}

const bodyText = rawBody.startsWith("@") ? readFileSync(rawBody.slice(1), "utf8") : rawBody;
try {
  JSON.parse(bodyText);
} catch {
  fail(2, "the request body is not valid JSON");
}

const maxUsdc = parseUnits(option("--max-usdc") ?? "0.20", 6);
const url = `${ORIGIN}${path}`;
const init = () => ({
  method: "POST",
  headers: { "content-type": "application/json", "user-agent": USER_AGENT },
  body: bodyText,
});

// 1. Ask for the price without paying. Invalid input is rejected here for free.
const probe = await fetch(url, init());
if (probe.status !== 402) {
  const text = await probe.text();
  fail(probe.ok ? 1 : 2, `HTTP ${probe.status} before payment (nothing paid):\n${text.slice(0, 2000)}`);
}
const header = probe.headers.get("payment-required");
if (!header) fail(1, "402 without a PAYMENT-REQUIRED header, refusing to pay");
const accept = (JSON.parse(atob(header)) as { accepts: Array<Record<string, unknown>> }).accepts.find(
  (a) => a.network === NETWORK && String(a.asset).toLowerCase() === USDC_BASE,
);
if (!accept) fail(1, "no payment option in USDC on Base mainnet, refusing to pay");
const amount = BigInt(String(accept.amount));
console.log(`price: ${formatUnits(amount, 6)} USDC on Base to ${accept.payTo}`);
if (amount > maxUsdc) fail(1, `price exceeds --max-usdc ${formatUnits(maxUsdc, 6)}, nothing paid`);

const key = process.env.X402_PRIVATE_KEY;
if (flag("--dry-run") || !key) {
  console.log(key ? "dry run, nothing paid" : "X402_PRIVATE_KEY not set, nothing paid");
  process.exit(3);
}

// 2. Pay and call. The wrapper repeats the request with a signed authorisation.
const account = privateKeyToAccount(key as `0x${string}`);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
});
const res = await fetchWithPayment(url, init());
const text = await res.text();
if (res.status === 402) {
  const again = res.headers.get("payment-required");
  const reason = again ? (JSON.parse(atob(again)) as { error?: string }).error : undefined;
  fail(1, `payment not accepted${reason ? `: ${reason}` : ""} (an empty or underfunded wallet ends here, nothing was charged)`);
}
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text.slice(0, 4000));
}
const settle = res.headers.get("payment-response");
if (settle) {
  const receipt = decodePaymentResponseHeader(settle) as { transaction?: string };
  if (receipt.transaction) console.error(`settlement: https://basescan.org/tx/${receipt.transaction}`);
}
if (!res.ok) fail(1, `HTTP ${res.status} after payment attempt`);
