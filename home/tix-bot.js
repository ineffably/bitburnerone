import { dataLibrary, quickTable, sortByField } from './botlib';

const holdings = {
  state: {},
  transactions: [],
  budget: 0
};
const transactionFee = 100000;

const getBudget = () => holdings.budget;
const setBudget = num => holdings.budget = num;

const transactionMiddleware = (ns, grid) => {
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
    getPurchaseCost: (sym, shares = 0, posType = 'Long') => {
      const { askPrice } = grid.find(entry => entry.symbol === sym);
      return (askPrice * shares) + transactionFee;
    },
  };
};

const isFloat = num => {
  try {
    return parseFloat(num) == num;
  } catch (e) {
    return false;
  }
}

const updatePositionFrequency = 1000 * 5;
const considerSell = ({ rating, onAvg, ns }) => {
  let sellRating = 0;
  if (rating <= 0) {
    sellRating += 100;
  }
  else {
    if (onAvg <= 0.97) {
      sellRating += 50;
    }
    if (rating <= 5) {
      sellRating += 50;
    }
  }
  return sellRating >= 100;
}

function setRating(byVolatility = []) {
  const ratings = {};

  byVolatility.forEach((stock, i) => {
    const { forcast, symbol } = stock;
    const leastVolitile = i < byVolatility.length / 2;
    const greatForcast = forcast > 0.7;
    const goodForcast = forcast > 0.5;
    const badForcast = forcast <= 0.5;
    const worstForcast = forcast < 0.4;

    let rating = 0;
    if (leastVolitile) {
      rating += 10;
    }
    if (greatForcast) {
      rating += 10;
    } else if (goodForcast) {
      rating += 5;
    }
    if (worstForcast) {
      rating -= 10;
    } else if (badForcast) {
      rating -= 5;
    }

    ratings[symbol] = rating;
    stock.rating = rating;
  });

  return ratings;
}

/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const { args } = ns;
  const command = args[0];
  const holdingsfile = '_holdings.json';
  const lastHoldings = await ns.read(holdingsfile);
  const log = lastHoldings ? JSON.parse(lastHoldings) : {};

  if (log) {
    holdings.state = log.state || {}
    holdings.transactions = log.transactions || [];
  }
  
  const { getStockData, getWorldData, fcoin } = dataLibrary(ns);
  const { player } = await getWorldData();
  const sessionState = {
    first: true,
    money: player.money
  };
  setBudget(0.25 * player.money);
  if(command === 'hold'){
    holdings.budget = 0;
  }

  const latestStockData = async () => {
    const { stockGrid } = await getStockData();
    const { buy, sell } = transactionMiddleware(ns, stockGrid);
    const byVolatility = sortByField(stockGrid.map(stock => { return stock; }), 'volatility');
    setRating(byVolatility); // make this immutable chad!!
    return { stockGrid, buy, sell }
  }

  if (command === 'clear') {
    return await ns.write(holdingsfile, '{}', 'w');
  }

  const getPositions = (currentGrid) => {
    const onlyPositions = ({ position }) => position.length > 0 && position[0] > 0;
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
    let totalAvg = 0;
    let totalGains = 0;
    const stockPositions = currentGrid.filter(onlyPositions);
    const positions = stockPositions.map(({ symbol, position, saleGain, price, forcast, rating }) => {
      const pos = transformPosition(position);
      totalAvg += (price / pos.avgPx)
      const gain = (price * pos.shares) - (pos.avgPx * pos.shares) - transactionFee;
      totalGains += gain;
      return ({
        symbol,
        saleGain,
        onAvg: price / pos.avgPx,
        gain,
        rating,
        forcast,
        doSell: considerSell({ rating, onAvg: (price/ pos.avgPx), ns }),
        perShare: (saleGain / pos.shares),
        ...pos
      });
    });
    totalAvg = totalAvg / stockPositions.length;

    return { positions, totalGains, totalAvg }
  }

  const updatePositions = ({ positions }, sell) => {
    // printPositions({ positions, totalGains, totalAvg });
    positions.forEach(position => {
      const { doSell, symbol, saleGain, shares } = position;
      if (doSell) {
        sell(symbol, shares);
        ns.tprint(`WARN: SOLD ${shares} of ${symbol} for ${fcoin(saleGain)}}`)
      }
    })
  }

  const doPurchasePass = ((localBudget, currentGrid, buy, gains = 0) => {
    if(localBudget <= 1000) return localBudget;
    const stockList = sortByField(currentGrid, 'rating').reverse();
    const chooseToBuy = stockList.slice(0, stockList.length / 2).filter(stock => stock.rating >= 5);
    const numInCart = chooseToBuy.length;
    const evenSpread = (localBudget - (numInCart * transactionFee)) / numInCart;
    // ns.tprint({passBudget: fcoin(passBudget), numInCart, evenSpread: fcoin(evenSpread)})
    if(evenSpread <= 1000) return localBudget;
    chooseToBuy.forEach(stock => {
      const { symbol, askPrice } = stock;
      const numShares = Math.floor((evenSpread - transactionFee) / askPrice);
      // ns.tprint(`onbudget: ${(purchasePrice <= evenSpread)} ${numShares * purchasePrice}`)
      if (numShares > 0) {
        buy(symbol, numShares)
        // ns.tprint(`WARN: BUY ${symbol} x ${numShares} for ${fcoin(askPrice)} = ${fcoin(purchasePrice)} |${fcoin(preBudget)}|${fcoin(getBudget())}|`)
      }
    })
    if(localBudget !== getBudget()){
      ns.tprint(`WARN: Current Gains:${fcoin(gains)}: buy budget complete: start:${fcoin(localBudget)} end:${fcoin(getBudget())}`);
    }
  });

  const printPositions = ({ positions, totalGains, totalAvg }) => {
    if(positions.length === 0){ ns.print('no positions to print') }
    const fields = (Object.keys(positions[0]) || ['empty']).filter(key => !['sharesShort', 'avgPxShort'].includes(key));
    ns.tprint(
      '\n' +
      quickTable(positions, fields, 12, (value, field) => {
        const coinFields = ['sellTally', 'perShare', 'saleGain', 'avgPx', 'gain']
        if (coinFields.includes(field) && isFloat(value)) {
          return fcoin(value)
        }
        if (field === 'onAvg' && isFloat(value)) {
          return ns.nFormat(value, '%0.00')
        }
        return value;
      }).join('\n') +
      `\nprofit: ${fcoin(totalGains)} totalAvg: ${fcoin(totalAvg)} budget: ${fcoin(getBudget())}`
    );
  }

  if (command === 'positions') {
    const { stockGrid } = await latestStockData();
    printPositions(getPositions(stockGrid))
    return;
  }

  if (command) {
    const { stockGrid, sell, buy } = await latestStockData();
    if (command === 'showgrid') {
      const sortby = args[1];
      const reverse = args[2] === 'r';
      const stockList = sortByField(stockGrid, sortby || 'volatility');
      const noShow = ['maxShares', 'low', 'high'];
      const fields = Object.keys(stockList[0]).filter(f => !noShow.includes(f));
      ns.tprint('\n' + quickTable(reverse ? stockList.reverse() : stockList, fields).join('\n'));
      return;
    }

    if (command === 'buy') {
      doPurchasePass(getBudget(), stockGrid, buy);
      return;
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
  }

  while (true) {
    const { stockGrid: latestGrid, sell, buy } = await latestStockData();
    if (sessionState.first) {
      if(command !== 'hold'){
        doPurchasePass(getBudget(), latestGrid, buy);
      }
      sessionState.first = false;
    }
    else {
      const positions = getPositions(latestGrid);
      updatePositions(positions, sell);
      doPurchasePass(getBudget(), latestGrid, buy, positions.totalGains);
    }

    await ns.write(holdingsfile, JSON.stringify(holdings), 'w');
    await ns.sleep(updatePositionFrequency)
  }
}

export function autocomplete(data, args) {
  return [
    'positions',
    'clear',
    'showgrid',
    'buy',
    'sell',
    'hold'
  ]
}

