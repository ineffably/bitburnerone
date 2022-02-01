const state = {
  count: 0,
  history: [],
  last: {},
  highlow: {},
  maxHistory: 50
};

const tranactionfee = 100000;

const positionFields = [
  'shares',
  'avgPx',
  'sharesShort',
  'avgPxShort'
]

const transformPosition = (position = []) => {
  return position.reduce((origin, entry, index) => {
    const field = positionFields[index];
    origin[field] = entry;
    return origin;
  }, {})
}

 

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
    // const forcastAverages = state.history.reduce((origin, grid) => {
    //   grid.map(entry => {
    //     const value = origin[entry.symbol] || { avgForcast: 0, forcastSize: state.history.length };
    //     value.avgForcast += entry.forcast;
    //     origin[entry.symbol] = value;
    //     return entry;
    //   }).forEach(entry => {
    //     ns.tprint([entry.avgForcast , state.history.length - 1])
    //     entry.avgForcast = entry.avgForcast / state.history.length - 1;
    //   })
    //   return origin;
    // }, {});
    const stockGrid = symbols.map((sym) => {
      const results = {
        symbol: sym,
        forcast: getForecast(sym),
        maxShares: getMaxShares(sym),
        askPrice: getAskPrice(sym),
        bigPrice: getBidPrice(sym),
        price: getPrice(sym),
        position: getPosition(sym),
        volatility: getVolatility(sym),
        purchaseCost: getPurchaseCost(sym, 1, "Long")
      };

      const [sharesOwned, avgPx] = results.position;
      if(sharesOwned && avgPx){
        results.saleGain = stock.getSaleGain(sym, sharesOwned, 'Long');
      } 

      // const { avgForcast } = forcastAverages[sym] || { avgForcast: results.forcast };
      // results.avgForcast = avgForcast;
      const { price } = results;
      const hl = state.highlow[sym] || [price, price];
      hl[0] = Math.min(price, hl[0]);
      hl[1] = Math.max(price, hl[1]);
      state.highlow[sym] = hl;

      results.low = hl[0];
      results.high = hl[1];
      // results.positionValues = transformPosition(results.position);

      // const gain = (price * pos.shares) - (pos.avgPx * pos.shares) - transactionFee;

      return results;
    })

    ns.clearLog();
    ns.print(JSON.stringify({ stockGrid, history }));

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
