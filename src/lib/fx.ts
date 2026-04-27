import axios from "axios";
import { getRedis } from "@/lib/redis";

const CACHE_KEY = "fx:ngn_per_usdc";
const FALLBACK_KEY = "fx:ngn_per_usdc:last_known";
const CACHE_TTL_SECONDS = 300; // 5 minutes
const HARDCODED_FALLBACK = 1600;

// Stellar DEX order-book: USDC (testnet issuer) / NGN (native proxy via XLM)
// We use the Horizon /order_book endpoint for USDC→XLM then a NGN/XLM rate.
// For simplicity we use exchangeratesapi or a public forex endpoint.
async function fetchLiveRate(): Promise<number> {
  // Use ExchangeRate-API (free tier, no key needed for basic endpoint)
  const { data } = await axios.get(
    "https://open.er-api.com/v6/latest/USD",
    { timeout: 5000 }
  );
  const ngnPerUsd: number = data.rates?.NGN;
  if (!ngnPerUsd) throw new Error("NGN rate missing from FX response");
  // USDC ≈ 1 USD
  return ngnPerUsd;
}

export async function getNgnPerUsdc(): Promise<number> {
  const redis = await getRedis();

  const cached = await redis.get(CACHE_KEY);
  if (cached) return parseFloat(cached);

  try {
    const rate = await fetchLiveRate();
    console.info(`[FX] Live NGN/USDC rate: ${rate}`);
    await redis.setEx(CACHE_KEY, CACHE_TTL_SECONDS, String(rate));
    await redis.set(FALLBACK_KEY, String(rate)); // persist last known indefinitely
    return rate;
  } catch (err) {
    console.error("[FX] Failed to fetch live rate, using fallback:", err);
    const lastKnown = await redis.get(FALLBACK_KEY);
    const rate = lastKnown ? parseFloat(lastKnown) : HARDCODED_FALLBACK;
    console.warn(`[FX] Fallback NGN/USDC rate: ${rate}`);
    return rate;
  }
}
