import { dataLibrary, sortByField, quickTable } from "./botlib";

const transactionFee = 100000;
const holdings = {
  transactions: [],
  budget: 0
};

const getBudget = () => holdings.budget;
const setBudget = num => holdings.budget = num;

const FORCAST_LOW = 0.5;
const FORCAST_HIGH = 0.6;
const VOLATILITY_HIGH = 0.01;
const HIST_SHORT = 15;
const HIST_LONG = 15;

const getForcastHistory = (stock) => {
  if(!stock) return;
  let avgForcast = 0;
  let shortAvg = 0;
  let avgEntries = 0;
  let shortEntries = 0;
  stock.forcasthist.slice(0, HIST_LONG).forEach((forcast, i) => {
    avgForcast += forcast;
    avgEntries++;
    if(i <= HIST_SHORT) {
      shortAvg += forcast;
      shortEntries++;
    }
  })
  return {
    shortavg: shortAvg / shortEntries,
    longavg: avgForcast / avgEntries
  }
}

/** @param {import("../index").NS } ns */
export async function main(ns) {
  const { getStockData, getWorldData, fcoin } = dataLibrary(ns);
  const { args } = ns;
  const command = args[0];

  const applyMetaData = stockGrid => {
    return stockGrid.map(stock => {
      const { shortavg, longavg } = getForcastHistory(stock);
      const { shares, avgPx, price, forcast, volatility } = stock;
      const shortDelta = shortavg - longavg;
      const gain = (price * shares) - (avgPx * shares) - transactionFee;
      const pGain = price / avgPx;
      const tobuy = (forcast >= FORCAST_HIGH && volatility < VOLATILITY_HIGH)
      const toshort = (forcast < FORCAST_LOW && volatility < VOLATILITY_HIGH);
      if(shares > 0) {
        const tosell = forcast < FORCAST_LOW;
        return { ...stock, shortDelta, gain, pGain, tosell};
      }
      else {
        return { ...stock, tobuy, toshort };
      }
    });
  }

  const latestStockData = async () => {
    const { stockGrid } = await getStockData();
    const results = applyMetaData(stockGrid)
    const { buy, sell } = transactionMiddleware(ns, results);
    return { stockGrid: results, buy, sell }
  }

  const { stockGrid, buy, sell } = await latestStockData();

  const printStockGrid = stockGrid => {
    const sortby = args[1];
    const reverse = args[2] === 'r';
    const stockList = sortByField(stockGrid, sortby || 'sym');
    const noShow = ['maxShares', 'low', 'high', 'forcasthist'];
    const fields = Object.keys(stockList[0]).filter(f => !noShow.includes(f));
    ns.tprint('\n' + quickTable(reverse ? stockList.reverse() : stockList, fields).join('\n'));
  }

  const buyLong = () => {

  }

  const buyShort = () => {

  }

  const sellLong = () => {

  }

  const sellShort = () => {

  }

  if(command === 'grid' || command === 'showgrid'){
    printStockGrid(stockGrid);
  }


}

function transactionMiddleware (ns, grid) {
  const { stock } = ns;
  const getPurchaseCost = (sym, shares = 0, posType = 'Long') => {
    const { askPrice } = grid.find(entry => entry.symbol === sym);
    return (askPrice * shares) + transactionFee;
  };

  return {
    buy: (sym, shares) => {
      const { askPrice, position } = grid.find(entry => entry.symbol === sym);
      const event = {
        action: 'buy', sym, shares, price: askPrice,
        total: getPurchaseCost(sym, shares, 'Long'),
        position,
        datetime: Date.now()
      };
      event.result = stock.buy(sym, shares);
      holdings.transactions.push(event);
      setBudget(getBudget() - event.total);
      return event;
    },
    sell: (sym, shares) => {
      const { askPrice, position } = grid.find(entry => entry.symbol === sym)
      const event = {
        action: 'sell', sym, shares, askPrice,
        total: (askPrice * shares) - transactionFee,
        position,
        datetime: Date.now()
      }
      event.result = stock.sell(sym, shares);
      event.total = (event.result * shares) - transactionFee;
      holdings.transactions.push(event);
      setBudget(getBudget() + event.total);
      return event;
    },
    getPurchaseCost
  };
}
