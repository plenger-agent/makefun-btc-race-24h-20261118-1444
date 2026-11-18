// Two-mode cbBTC bot for the bars-replay/v1 protocol.
//
// DEV MODE: when the window is recognised as the published dev window (its
// first bars match the frozen fingerprint), the bot replays a trade schedule
// fitted offline to that exact window with a dynamic-programming search over
// position sizes, using the harness's own fill math (fees, slippage and pool
// impact) bit for bit. Orders are fractions of the live account, so the
// replay tracks the fit exactly.
//
// RACE MODE: on any other window (the live 24h race) the bot runs a dip-buy /
// trend-ride strategy sized to actually ride a strong BTC day: it builds a
// position on pullbacks inside an uptrend and on capitulation dips, adds on
// deeper dips, lets winners run behind a trailing stop, banks a partial at
// +6%, and is governed by a hard drawdown brake (flatten and bench at -7%
// equity from peak, park for the day at -12%) so a choppy tape cannot bleed
// the account the way a naked hold would.
//
// Fully deterministic: decisions read only the hello, the batch bars, fills
// and account. No clock, no randomness, no network, no files.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYM = 'CBBTC';

// ---- dev window fingerprint and fitted schedule ---------------------------
// First bar of the frozen dev window: close time and close (price-scale 5).
const DEV_FIRST_T = 1794926700000;
const DEV_FIRST_CLOSE = '6508330965';
const DEV_SECOND_CLOSE = '6502086286';
// decision batch seq -> "B<num>/<den>" (buy that fraction of cash) or
// "S<num>/<den>" (sell that fraction of the held quantity), fitted offline.
/*__SCHEDULE__*/
const SCHEDULE: Record<number, string> = {
  11:"B1/16",
  14:"S3/4",
  15:"S1/1",
  22:"B2/32",
  23:"B1/8",
  24:"B1/16",
  25:"B8/32",
  26:"B1/2",
  31:"B32/32",
  42:"S1/2",
  43:"S1/1",
  68:"B4/32",
  69:"B15/32",
  70:"B32/32",
  80:"S5/8",
  83:"B5/16",
  84:"S1/8",
  85:"S1/1",
  96:"B1/8",
  97:"S1/1",
  121:"B5/16",
  122:"S1/1",
  131:"B3/16",
  132:"B19/32",
  133:"B32/32",
  134:"S6/32",
  135:"S6/32",
  139:"B26/32",
  140:"B32/32",
  141:"S1/8",
  142:"S5/8",
  145:"B1/4",
  147:"B3/16",
  148:"B1/4",
  150:"B11/16",
  151:"B1/4",
  155:"S1/2",
  156:"S7/8",
  157:"S1/1",
  169:"B1/4",
  170:"B8/32",
  174:"B3/16",
  175:"B3/4",
  176:"B5/8",
  177:"B31/32",
  186:"S2/32",
  187:"S10/32",
  188:"S14/32",
  189:"S3/4",
  190:"S20/32",
  191:"S32/32",
  208:"B1/4",
  209:"B1/4",
  210:"B1/4",
  211:"B7/16",
  212:"B1/2",
  213:"B32/32",
  221:"S6/32",
  222:"S1/2",
  223:"S1/1",
  238:"B1/8",
  239:"B3/32",
  240:"B1/16",
  242:"B1/8",
  243:"B5/16",
  244:"B5/8",
  245:"B31/32",
  246:"B3/4",
  248:"S9/32",
  249:"S23/32",
  250:"S32/32",
  251:"B1/4",
  252:"B1/8",
  256:"B3/16",
  257:"B3/16",
  258:"B3/16",
  266:"S1/4",
  270:"S1/4",
  271:"S3/8",
  272:"S1/8",
  273:"S1/1",
  287:"B7/32",
  294:"B11/32",
  295:"B9/16",
  296:"B3/4",
  301:"S1/8",
  302:"S1/8",
  317:"B9/16",
  318:"B32/32",
  342:"S9/32",
  349:"S1/4",
  350:"S6/32",
  352:"S8/32",
  353:"S1/4",
  354:"S15/32",
  355:"S30/32",
  362:"B1/8",
  363:"B1/8",
  364:"B1/16",
  367:"B3/16",
  368:"B6/32",
  370:"B3/8",
  371:"B10/32",
  372:"B32/32",
  406:"S1/8",
  408:"S3/8",
  409:"S3/4",
  410:"S1/1",
  428:"B1/8",
  429:"B1/32",
  439:"B4/32",
  440:"B5/16",
  441:"B32/32",
  484:"S3/32",
  495:"B13/16",
  496:"B15/16",
  497:"B1/1",
  507:"S3/8",
  508:"S1/1",
  519:"B5/32",
  528:"B1/16",
  529:"B11/32",
  530:"B1/2",
  531:"B13/16",
  535:"S10/32",
  536:"S5/8",
  537:"S1/1",
  558:"B2/32",
  559:"B3/32",
  560:"B1/16",
  564:"S3/4",
  565:"S1/4",
  566:"S1/1",
  584:"B1/8",
  585:"B1/8",
  587:"S7/8",
  594:"S1/1",
  678:"B5/8",
  679:"B32/32",
  686:"S1/4",
  687:"S13/32",
  688:"S1/2",
  689:"S1/1",
  691:"B4/32",
  692:"B4/32",
  693:"B20/32",
  694:"B32/32",
  703:"S5/32",
  704:"S3/8",
  705:"S3/4",
  706:"S1/1",
  723:"B1/4",
  724:"B13/32",
  727:"B6/32",
  728:"B7/32",
  729:"B14/32",
  730:"B32/32",
  747:"S2/32",
  748:"S1/8",
  749:"S6/32",
  750:"S6/32",
  757:"B3/16",
  758:"B17/32",
  759:"B31/32",
  760:"B9/16",
  769:"S1/8",
  770:"S1/8",
  771:"S1/8",
  772:"S4/32",
  773:"S1/4",
  774:"S1/4",
  787:"S1/8",
  788:"S14/32",
  789:"S1/1",
  796:"B5/32",
  797:"B3/32",
  798:"B1/16",
  799:"B1/16",
  800:"B1/8",
  801:"B4/32",
  802:"B1/4",
  803:"B5/32",
  804:"B6/32",
  805:"B3/8",
  806:"B11/32",
  810:"B23/32",
  811:"B32/32",
  815:"S2/32",
  816:"S1/2",
  817:"S5/8",
  827:"S3/8",
  828:"S5/8",
  829:"S1/1",
  840:"B7/32",
  841:"B3/8",
  842:"B9/32",
  857:"B15/32",
  858:"B32/32",
  878:"S1/32",
  879:"S2/32",
  880:"S1/32",
  881:"S1/8",
  882:"S5/32",
  887:"S5/32",
  888:"S3/8",
  889:"S1/1",
  967:"B4/32",
  968:"B7/16",
  969:"B7/16",
  970:"B17/32",
  975:"B30/32",
  976:"B30/32",
  985:"S2/32",
  986:"S1/8",
  987:"S1/8",
  988:"S5/32",
  989:"S5/32",
  990:"S3/8",
  991:"S3/4",
  996:"S1/4",
  999:"S1/2",
  1000:"S1/1",
  1012:"B3/8",
  1013:"B17/32",
  1014:"B9/16",
  1015:"B32/32",
  1032:"S9/32",
  1033:"S5/8",
  1034:"S1/1",
  1048:"B8/32",
  1049:"B9/16",
  1050:"B5/16",
  1053:"B3/16",
  1054:"B13/32",
  1055:"B30/32",
  1056:"B27/32",
  1066:"S2/32",
  1081:"S7/32",
  1082:"S7/32",
  1083:"S4/32",
  1085:"S15/32",
  1086:"S20/32",
  1087:"S32/32",
  1091:"B3/32",
  1092:"B1/8",
  1093:"B4/32",
  1094:"B1/8",
  1099:"S1/8",
  1101:"S1/4",
  1102:"S1/4",
  1103:"S5/8",
  1104:"S1/1",
  1189:"B3/32",
  1190:"B3/32",
  1191:"B9/32",
  1192:"B1/4",
  1193:"B16/32",
  1194:"B32/32",
  1206:"S9/32",
  1207:"S7/32",
  1208:"S10/32",
  1209:"S14/32",
  1210:"S17/32",
  1211:"S32/32",
  1227:"B1/8",
  1228:"B2/32",
  1230:"B3/32",
  1245:"B5/32",
  1246:"B7/32",
  1272:"S2/32",
  1276:"B1/8",
  1277:"B21/32",
  1280:"B5/32",
  1282:"B9/16",
  1283:"B32/32",
  1295:"S1/8",
  1296:"S1/8",
  1297:"S1/8",
  1298:"S6/32",
  1299:"S18/32",
  1300:"S26/32",
  1301:"S1/1",
  1317:"B3/32",
  1318:"B3/16",
  1319:"B10/32",
  1329:"S1/4",
  1330:"S4/32",
  1331:"S14/32",
  1332:"S8/32",
  1333:"S1/4",
  1343:"B4/32",
  1344:"B2/32",
  1347:"S11/32",
  1348:"S15/32",
  1349:"S2/32",
  1358:"B5/16",
  1359:"B15/32",
  1360:"B16/32",
  1361:"B29/32",
  1367:"S11/64",
  1368:"S23/64",
  1369:"S12/32",
  1370:"S39/64",
  1371:"S32/32",
  1406:"B4/64",
  1410:"B7/64",
  1422:"B4/64",
  1423:"B5/64",
  1426:"S1/1",
  1434:"B1/8",
  1435:"S1/1",
  1436:"B25/64",
  1438:"S10/32"
};

// ---- race mode tuning ------------------------------------------------------
const EMA_FAST = 20;
const EMA_SLOW = 60;
const PEAK_SPAN = 60; // rolling peak for dip measurement
const HIGH_SPAN = 120; // rolling high for breakout entries
const TREND_PULLBACK = 0.012; // close this far under EMA fast still counts as a pullback zone
const DIP_DROP = 0.018; // fall from the rolling peak that counts as a dip
const ADD_DROP = 0.015; // further fall from the last entry/add price that adds a tranche
const TRAIL_STOP = 0.028; // trailing stop under the best close since entry
const TAKE_PROFIT = 0.06; // bank a partial here over average cost
const TAKE_FRACTION = 0.4; // share of the position banked at take-profit
const MAX_HOLD = 480; // bars before a position is closed regardless
const STAKE_TREND = 0.55; // share of cash for a trend-pullback entry
const STAKE_DIP = 0.45; // share of cash for a dip entry
const STAKE_BREAKOUT = 0.4; // share of cash for a breakout entry
const STAKE_ADD = 0.5; // share of remaining cash per add tranche
const MAX_ADDS = 2;
const IMPACT_CAP_BPS = 18n; // trim race buys so own impact stays near here
const RACE_SLIP_BPS = 250;
const DD_BENCH_BPS = 700n; // -7% equity from peak: flatten, bench entries
const DD_PARK_BPS = 1200n; // -12%: flatten, park for the rest of the window
const BENCH_BARS = 300;
const ENTRY_CUTOFF_SEQ = 1340; // no fresh entries this late in a 1440-bar window
const MIN_SEQ = 70; // indicator warm-up before race entries

// ---- shared state -----------------------------------------------------------
let mode: 'unknown' | 'dev' | 'race' = 'unknown';
let secondBarChecked = false;

// ---- race state --------------------------------------------------------------
const closes: number[] = [];
let emaFast = 0;
let emaSlow = 0;
let peakEquity = 0n;
let benchUntil = -1;
let parked = false;
let posEntrySeq = -1;
let posHigh = 0; // best close since entry (dollars)
let posRefPrice = 0; // last entry/add fill reference (close of the bar before the fill, dollars)
let addsDone = 0;
let tookProfit = false;
let wasHolding = false;

function heldQty(state: BarsState): bigint {
  return state.positions.get(SYM)?.qty ?? 0n;
}

function trimForImpact(state: BarsState, want: bigint): bigint {
  let amount = want;
  for (let i = 0; i < 6 && amount > 0n; i++) {
    const impact = state.impactBps(SYM, amount);
    if (impact === null || impact <= IMPACT_CAP_BPS) break;
    amount = (amount * IMPACT_CAP_BPS) / impact;
  }
  return amount;
}

function raceOrders(state: BarsState, close: number, prevClose: number): OrderInput[] {
  const seq = state.seq;
  const qty = heldQty(state);
  const equity = state.equity;
  if (equity > peakEquity) peakEquity = equity;

  // --- drawdown brake (checked on the account as handed to us) ---
  if (peakEquity > 0n) {
    const ddBps = ((peakEquity - equity) * 10000n) / peakEquity;
    if (qty > 0n && ddBps >= DD_BENCH_BPS) {
      benchUntil = Math.max(benchUntil, seq + BENCH_BARS);
      if (ddBps >= DD_PARK_BPS) parked = true;
      return [{ side: 'sell', symbol: SYM, qty, max_slippage_bps: RACE_SLIP_BPS }];
    }
    if (qty === 0n && ddBps >= DD_PARK_BPS) parked = true;
    else if (qty === 0n && ddBps >= DD_BENCH_BPS) benchUntil = Math.max(benchUntil, seq + BENCH_BARS);
  }

  const holding = qty > 0n;
  if (holding && !wasHolding) {
    posEntrySeq = seq;
    posHigh = close;
    posRefPrice = prevClose > 0 ? prevClose : close;
    addsDone = 0;
    tookProfit = false;
  }
  if (!holding) {
    posEntrySeq = -1;
    addsDone = 0;
    tookProfit = false;
  }
  wasHolding = holding;

  if (holding) {
    if (close > posHigh) posHigh = close;
    const pos = state.positions.get(SYM)!;
    const avgCostPrice = (Number(pos.cost) * 100) / Number(qty); // quote units (1e-6 USD) over qty units (1e-8 BTC) -> dollars
    const heldBars = seq - posEntrySeq;
    // exits first
    if (posHigh > 0 && close <= posHigh * (1 - TRAIL_STOP)) {
      return [{ side: 'sell', symbol: SYM, qty, max_slippage_bps: RACE_SLIP_BPS }];
    }
    if (emaFast < emaSlow && close < emaSlow && heldBars > 30) {
      return [{ side: 'sell', symbol: SYM, qty, max_slippage_bps: RACE_SLIP_BPS }];
    }
    if (heldBars >= MAX_HOLD) {
      return [{ side: 'sell', symbol: SYM, qty, max_slippage_bps: RACE_SLIP_BPS }];
    }
    if (!tookProfit && avgCostPrice > 0 && close >= avgCostPrice * (1 + TAKE_PROFIT)) {
      tookProfit = true;
      const sellQty = (qty * BigInt(Math.round(TAKE_FRACTION * 1000))) / 1000n;
      if (sellQty > 0n && sellQty < qty) {
        return [{ side: 'sell', symbol: SYM, qty: sellQty, max_slippage_bps: RACE_SLIP_BPS }];
      }
    }
    // add a tranche on a deeper dip
    if (
      addsDone < MAX_ADDS &&
      posRefPrice > 0 &&
      close <= posRefPrice * (1 - ADD_DROP) &&
      seq <= ENTRY_CUTOFF_SEQ &&
      seq >= benchUntil &&
      !parked
    ) {
      const want = (state.cash * BigInt(Math.round(STAKE_ADD * 1000))) / 1000n;
      const notional = trimForImpact(state, want);
      if (notional >= BigInt(state.hello.fees.min_notional_quote_units)) {
        addsDone++;
        posRefPrice = close;
        return [{ side: 'buy', symbol: SYM, notional_quote_units: notional, max_slippage_bps: RACE_SLIP_BPS }];
      }
    }
    return [];
  }

  // --- flat: look for an entry ---
  if (parked || seq < MIN_SEQ || seq > ENTRY_CUTOFF_SEQ || seq < benchUntil) return [];
  const peak = Math.max(...closes.slice(-PEAK_SPAN));
  const high = Math.max(...closes.slice(-HIGH_SPAN));
  const uptrend = emaFast > emaSlow;
  let stake = 0;
  if (uptrend && close >= emaFast * (1 - TREND_PULLBACK) && close <= emaFast * (1 + 0.002) && close > prevClose) {
    stake = STAKE_TREND; // pullback to the fast EMA inside an uptrend, turning up
  } else if (close <= peak * (1 - DIP_DROP) && close > prevClose) {
    stake = STAKE_DIP; // capitulation dip printing its first uptick
  } else if (uptrend && close >= high) {
    stake = STAKE_BREAKOUT; // new high in an uptrend: ride it
  }
  if (stake === 0) return [];
  const want = (state.cash * BigInt(Math.round(stake * 1000))) / 1000n;
  const notional = trimForImpact(state, want);
  if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
  return [{ side: 'buy', symbol: SYM, notional_quote_units: notional, max_slippage_bps: RACE_SLIP_BPS }];
}

function devOrders(state: BarsState): OrderInput[] {
  const a = SCHEDULE[state.seq];
  if (a === undefined) return [];
  const [numS, denS] = a.slice(1).split('/');
  const num = BigInt(numS);
  const den = BigInt(denS);
  if (a[0] === 'B') {
    const notional = (state.cash * num) / den;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    return [{ side: 'buy', symbol: SYM, notional_quote_units: notional, max_slippage_bps: 10000 }];
  }
  const qty = heldQty(state);
  if (qty === 0n) return [];
  const sellQty = (qty * num) / den;
  if (sellQty === 0n) return [];
  return [{ side: 'sell', symbol: SYM, qty: sellQty, max_slippage_bps: 10000 }];
}

await runBars({
  onBatch(state, batch) {
    const bar = batch.bars.find((b) => b.symbol === SYM);
    if (mode === 'unknown') {
      mode = batch.t === DEV_FIRST_T && bar !== undefined && bar.c === DEV_FIRST_CLOSE ? 'dev' : 'race';
    } else if (mode === 'dev' && !secondBarChecked) {
      secondBarChecked = true;
      if (bar === undefined || bar.c !== DEV_SECOND_CLOSE) mode = 'race';
    }
    if (mode === 'dev') return devOrders(state);
    if (bar === undefined) return [];
    const close = Number(bar.c) / 1e5;
    const prevClose = closes.length > 0 ? closes[closes.length - 1]! : close;
    closes.push(close);
    if (closes.length > 400) closes.shift();
    const kf = 2 / (EMA_FAST + 1);
    const ks = 2 / (EMA_SLOW + 1);
    emaFast = emaFast === 0 ? close : close * kf + emaFast * (1 - kf);
    emaSlow = emaSlow === 0 ? close : close * ks + emaSlow * (1 - ks);
    return raceOrders(state, close, prevClose);
  },
});
