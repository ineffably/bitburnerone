import { dataLibrary, sortByField, quickTable } from "./botlib";

export function autocomplete() {
  const r = [
    'monitor',
    'grid',
    'showgrid'
  ]
  return r;
}

const holdings = {
  transactions: [],
  budget: 0
};

const getBudget = () => holdings.budget;
const setBudget = num => holdings.budget = num;

const FORCAST_LOW = 0.5;
const FORCAST_HIGH = 0.6;
const VOLATILITY_HIGH = 0.03;
const HIST_SHORT = 15;
const HIST_LONG = 50;
const MAX_SHARES = 0.4;
const MAX_ORDER_COST = 1750000000;
const MIN_ORDER_COST = 10000;
const TRANSACTION_FEE = 100000;

const getForcastHistory = (stock) => {
  if (!stock) return;
  let avgForcast = 0;
  let shortAvg = 0;
  let avgEntries = 0;
  let shortEntries = 0;
  stock.forcasthist.slice(0, HIST_LONG).forEach((forcast, i) => {
    avgForcast += forcast;
    avgEntries++;
    if (i <= HIST_SHORT) {
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
  const { getStockData, getWorldData, fcoin, fpercent } = dataLibrary(ns);
  const { player } = await getWorldData(ns);
  const { args } = ns;
  const [command, budget = (player.money * 0.35)] = args;
  setBudget(budget);

  const getPurchaseCost = (sym, shares, posType = 'Long') => ns.stock.getPurchaseCost(sym, shares, posType);

  const applyMetaData = stockGrid => {
    return stockGrid.map(stock => {
      const { shortavg, longavg } = getForcastHistory(stock);
      const [shares, avgPx, shorts, shortsPx] = stock.position;
      const { price, forcast, volatility } = stock;
      const shortDelta = shortavg - longavg;
      const gain = (price * shares) - (avgPx * shares) - TRANSACTION_FEE;
      const pGain = shares ? price / avgPx : 0;

      const tosell = forcast < FORCAST_LOW;
      // ns.tprint([FORCAST_LOW, forcast, tosell]);
      const tobuy = (forcast >= FORCAST_HIGH && volatility < VOLATILITY_HIGH)
      const toshort = (forcast < FORCAST_LOW && volatility < VOLATILITY_HIGH);

      return ({
        ...stock,
        shortavg, longavg, tobuy, toshort, tosell,
        shortDelta, gain, pGain,
        shares, avgPx, shorts, shortsPx
      })
    });
  }

  const latestStockData = async () => {
    const { stockGrid } = await getStockData();
    const results = applyMetaData(stockGrid)
    return {
      ...transactionMiddleware(ns, results),
      ...{ stockGrid: results }
    }
  }

  const printStockGrid = stockGrid => {
    const sortby = args[1];
    const reverse = args[2] === 'r';
    const stockList = sortByField(stockGrid, sortby || 'sym');
    const noShow = ['maxShares', 'bidPrice', 'low', 'high', 'forcasthist', 'longavg', 'shortavg', 'tobuy', 'toshort'];
    const fields = Object.keys(stockList[0]).filter(f => !noShow.includes(f));
    ns.tprint('\n' + quickTable(reverse ? stockList.reverse() : stockList, fields, 10).join('\n'));
  }

  const { stockGrid, buy, sell } = await latestStockData();

  const purchaseSweep = (grid, budgetValue, posType = 'Long') => {
    const stocksInCart = grid.filter(stock => stock.tobuy);
    const numInCart = stocksInCart.length;
    const transactionFees = (numInCart * TRANSACTION_FEE);
    const evenSpread = (budgetValue - transactionFees) / numInCart;
    if (evenSpread < MIN_ORDER_COST) { return budgetValue }

    let budgetTracker = budgetValue;
    stocksInCart.forEach((stock, i) => {
      const { symbol, askPrice, maxShares, shares } = stock;
      const isLast = i === stocksInCart.length - 1;
      const maxQuantity = maxShares * MAX_SHARES;
      const numShares =  Math.floor(budgetTracker / askPrice);
      const underBudget = Math.floor(MAX_ORDER_COST / askPrice);
      const chosenShares = Math.min(maxQuantity, numShares, underBudget);
      // ns.tprint([evenSpread, maxShares, maxQuantity, chosenShares, underBudget, numInCart])
      const totalCost = getPurchaseCost(symbol, chosenShares, posType);
      if(chosenShares > 0){
        budgetTracker -= totalCost;
        const { result } = buy(symbol, chosenShares);
        ns.tprint(`BUYING: ${chosenShares} of ${symbol} at ${fcoin(askPrice)} for ${fcoin(totalCost)}! [${fcoin(getBudget())}]`);
      }
    })
  }

  const sellPass = (grid) => {
    const stocksInCart = grid.filter(stock => (stock.tosell && stock.shares));
    // ns.tprint({stocksInCart: stocksInCart.length});
    stocksInCart.forEach(position => {
      const { symbol, saleGain, shares, pGain } = position;
      sell(symbol, shares);
      ns.tprint(`SOLD: ${shares} of ${symbol} gains ${fcoin(saleGain)} at ${fpercent(pGain)}! budget: [${fcoin(getBudget())}]`);
    })
  }

  if (command === 'grid' || command === 'showgrid') {
    printStockGrid(stockGrid);
  }
  
  if (command === 'sell') {
    stockGrid.forEach(stock => {
      const [shares] = ns.stock.getPosition(stock.symbol);
      if(shares > 0 ){
        sell(stock.symbol, shares);
      }
    })
    return;
  }

  if (command === 'monitor') {
    while (true) {
      const { stockGrid } = await latestStockData();
      sellPass(stockGrid);
      const currentBudget = getBudget();
      purchaseSweep(stockGrid, currentBudget)
      await ns.sleep(3000);
    }
  }
}

/** @param {import("../index").NS } ns */
function transactionMiddleware(ns, grid) {
  const { stock } = ns;

  const mockGetPurchaseCost = (sym, shares = 0, posType = 'Long') => {
    const { askPrice } = grid.find(entry => entry.symbol === sym);
    return (askPrice * shares) + TRANSACTION_FEE;
  };

  return {
    buy: (sym, shares) => {
      const { askPrice, position } = grid.find(entry => entry.symbol === sym);
      const event = {
        action: 'buy', sym, shares, price: askPrice,
        total: ns.stock.getPurchaseCost(sym, shares, 'Long'),
        position,
        datetime: Date.now(),
        result: stock.buy(sym, shares)
      };
      event.total = (event.result * shares) + TRANSACTION_FEE;
      holdings.transactions.push(event);
      setBudget(getBudget() - event.total);
      return event;
    },
    sell: (sym, shares) => {
      const { bidPrice, position } = grid.find(entry => entry.symbol === sym)
      const event = {
        action: 'sell', sym, shares, bidPrice,
        total: (bidPrice * shares) - TRANSACTION_FEE,
        position,
        datetime: Date.now(),
        result: stock.sell(sym, shares)
      }
      event.total = (event.result * shares) - TRANSACTION_FEE;
      holdings.transactions.push(event);
      setBudget(getBudget() + event.total);
      return event;
    },
    mockGetPurchaseCost
  };
}
