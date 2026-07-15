/** Which of the bot's pair assets plays which role in the demo account.
 *
 * The engine's cash is denominated in the asset the QUOTES are expressed in
 * (≈1860 per WETH → USDT/USDC), the position tokens are the other asset. Some
 * dex pairs are named inverted (USDT/WETH with WETH-in-USDT prices), so the
 * pair order alone is unreliable — the stable side of the pair is the cash. */

const STABLES = new Set(['USDC', 'USDT', 'USDC.E', 'DAI', 'BUSD', 'TUSD']);

/** The asset balances/PnL are denominated in (the quote currency of the feed). */
export function cashAsset(b: { baseAsset: string; quoteAsset: string }): string {
  if (STABLES.has(b.quoteAsset.toUpperCase())) return b.quoteAsset;
  if (STABLES.has(b.baseAsset.toUpperCase())) return b.baseAsset;
  return b.quoteAsset;
}

/** The asset the bot buys/holds as a position. */
export function tokenAsset(b: { baseAsset: string; quoteAsset: string }): string {
  return cashAsset(b) === b.quoteAsset ? b.baseAsset : b.quoteAsset;
}
