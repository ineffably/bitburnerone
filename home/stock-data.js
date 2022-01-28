const state = {
    count: 0,
  };
  
/** @param {import("../index").NS } ns */
export async function main(ns) {
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
          getVolatility
      } = stock;
      const symbols = getSymbols()
      const stockGrid = symbols.map(sym => {
          const results = {
              forcast: getForecast(sym),
              maxShares: getMaxShares(sym),
              askPrice: getAskPrice(sym),
              bigPrice: getBidPrice(sym),
              price: getPrice(sym),
              position: getPosition(sym),
              volatility: getVolatility(sym)
          }
          return results;
      })

      ns.clearLog();
      ns.print(JSON.stringify({ stockGrid }));
      if (state.count++ % 120 === 0) {
        await ns.write('_world-data.json', JSON.stringify(state.last), 'w');
      }
      await ns.sleep(1000);
  }
}
