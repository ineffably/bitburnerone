const state = {
  count: 0,
  history: [],
  last: {},
  highlow: {},
  maxHistory: 50
};

/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.clearLog();
  ns.disableLog('ALL');
  while (true) {
    const { stock } = ns;
    const {
      getSymbols,
      getForecast,
      getMaxShares,
      getAskPrice,
      getBidPrice,
      getPrice,
      getPosition,
      getVolatility,
      getPurchaseCost
    } = stock;

    const symbols = getSymbols();

    const getFieldHistory = ({ field, sym }) => {
      return state.history.map(
        grid => (grid.filter(
          entry => entry.symbol === sym).map(
            s => s[field]))[0]);
    }


    const stockGrid = symbols.map((sym) => {
      const results = {
        symbol: sym,
        forcast: getForecast(sym),
        maxShares: getMaxShares(sym),
        askPrice: getAskPrice(sym),
        bidPrice: getBidPrice(sym),
        price: getPrice(sym),
        position: getPosition(sym),
        volatility: getVolatility(sym),
        purchaseCost: getPurchaseCost(sym, 1, "Long")
      };

      const [sharesOwned, avgPx] = results.position;
      if (sharesOwned && avgPx) {
        results.saleGain = stock.getSaleGain(sym, sharesOwned, 'Long');
      }

      const { price } = results;
      const hl = state.highlow[sym] || [price, price];
      hl[0] = Math.min(price, hl[0]);
      hl[1] = Math.max(price, hl[1]);
      state.highlow[sym] = hl;

      results.low = hl[0];
      results.high = hl[1];

      results.forcasthist = getFieldHistory({ sym, field: 'forcast' });
      return results;
    })

    ns.clearLog();
    ns.print(JSON.stringify({ stockGrid }));

    state.last = stockGrid;
    state.history.push(stockGrid);
    if (state.history.length > state.maxHistory) {
      state.history.splice(0, 1);
    }
    if (state.count++ % 120 === 0) {
      await ns.write('_world-data.json', JSON.stringify(state.last), 'w');
    }
    await ns.sleep(1000);
  }
}
