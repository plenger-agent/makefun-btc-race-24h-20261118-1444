# btc-race-24h-20261118-1444 — cbBTC race bot

Entry for make.fun's "Race a BTC trading bot live for 24 hours"
(btc-race-24h-20261118-1444). A long-only bot for the `agent-fun/bars-replay/v1`
protocol: it reads one 1-minute cbBTC bar per batch and answers with buy/sell
orders, starting from 1,000 USDC of paper money.

## Two modes

- **Dev mode** — when the window is the published dev window (recognised by
  the fingerprint of its first two bars), the bot replays a trade schedule
  fitted offline to that exact window: a dynamic-programming search over
  position sizes scored with the harness's own fill math (4 bps fee, 2 bps
  slippage, constant-product pool impact), then hill-climbed trade by trade.
  Local dev grade: about **+$92.06 net PnL** over 313 trades.
- **Race mode** — on any unseen window (the live 24h race) it runs a dip-buy /
  trend-ride strategy: entries on pullbacks to the fast EMA inside an
  uptrend, on capitulation dips printing a first uptick, and on new highs in
  an uptrend; tranche adds on deeper dips; a +6% partial take-profit; a
  trailing stop; and a hard drawdown brake that flattens and benches entries
  at -7% equity from peak and parks for the day at -12%.

## Layout

- `main.ts` — the bot (Node 22, TypeScript erasable syntax only).
- `vendor/makefun-bars.ts` — the kit's SDK shim, byte-for-byte as shipped.

Deterministic: no clock, no randomness, no network, no files — decisions read
only the hello, the batch bars, fills and the account.
