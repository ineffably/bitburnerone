import { dataLibrary, quickTable, sortByField } from './botlib';

export function autocomplete() {
  return [
    'positions',
    'clear',
    'showgrid',
    'grid',
    'buy',
    'sell',
    'hold'
  ]
}
const holdings = {
  state: {},
  transactions: [],
  budget: 0
};

const transactionFee = 100000;
const getBudget = () => holdings.budget;
const setBudget = num => holdings.budget = num;

const isFloat = num => {
  try {
    return parseFloat(num) == num;
  } catch (e) {
    return false;
  }
}

const riskFactor = 0.6;
const volitilityMark = 0.005;

const considerSell = ({ onAvg, rating, forcast, forcastshortavg: shortavg, forcastlongavg: longavg, gain }) => {
  const shortDelta = shortavg - longavg;
   let sellRating = 0;
  // sellRating += 100;
  if(forcast < 0.5 || shortDelta < 0 || forcast < shortavg) {
    sellRating += 100
  }
  return sellRating >= 100;
}

function setRating(stockList = []) {
  const ratings = {};

  stockList.forEach((stock, i) => {
    const { forcast, symbol, forcastshortavg: shortavg, forcastlongavg: longavg, volatility } = stock;
    const shortDelta = shortavg - longavg;
    let rating = 0;
    if(forcast >= riskFactor || shortavg >= riskFactor){
      rating += 20;
    }
    // if(volatility <= volitilityMark){
    //    rating += 5 -volatility;
    // }
    if(longavg >= riskFactor || shortavg >= riskFactor){
      rating += 15;
    }
   
    ratings[symbol] = rating;
    stock.rating = rating;
  });

  return ratings;
}

/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const updatePositionFrequency = 1000 * 30;
  const { args } = ns;
  const command = args[0];
  const field = args[1]
  const toggle = args[2]
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

  const setProjection = (stock) => {
    const shortLen = 18;
    if(!stock) return;
    const maxHistory = 50;
    let avgForcast = 0;
    let shortAvg = 0;
    let avgEntries = 0;
    let shortEntries = 0;
    stock.forcasthist.slice(0, maxHistory).forEach((forcast, i) => {
      avgForcast += forcast;
      avgEntries++;
      if(i <= shortLen) {
        shortAvg += forcast;
        shortEntries++;
      }
    })
    stock.forcastshortavg = shortAvg / shortEntries
    stock.forcastlongavg = avgForcast / avgEntries;
    // ns.tprint([stock.forcastshortavg, stock.forcastlongavg, stock.forcastshortavg > stock.forcastlongavg])
  }

  const latestStockData = async () => {
    const { stockGrid } = await getStockData();
    const { buy, sell } = transactionMiddleware(ns, stockGrid);
    setProjection(stockGrid.forEach(setProjection));
    const byVolatility = sortByField(stockGrid, 'volatility');
    setRating(byVolatility); // make this immutable chad!!

    return { stockGrid: byVolatility, buy, sell }
  }

  if (command === 'clear') {
    return await ns.write(holdingsfile, '{}', 'w');
  }

  const getPositions = (currentGrid, sortField, isReverse) => {
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
    const stockPositions = currentGrid.filter(onlyPositions)
    const positions = (isReverse ? stockPositions.reverse() : stockPositions).map(({ symbol, position, saleGain, price, forcast, rating, forcastshortavg, forcastlongavg }) => {
      const pos = transformPosition(position);
      totalAvg += (price / pos.avgPx)
      const gain = (price * pos.shares) - (pos.avgPx * pos.shares) - transactionFee;
      totalGains += gain;
      return ({
        symbol,
        shortDelta: forcastshortavg - forcastlongavg,
        saleGain,
        forcastlongavg,
        forcastshortavg,
        onAvg: price / pos.avgPx,
        gain,
        rating,
        forcast,
        doSell: considerSell({ rating, onAvg: (price/ pos.avgPx), ns, forcastshortavg, forcastlongavg, gain }),
        // perShare: (saleGain / pos.shares),
        ...pos
      });
    });
    totalAvg = totalAvg / stockPositions.length;

    return { 
      positions: isReverse ? sortByField(positions, sortField || 'symbol').reverse() : sortByField(positions, sortField || 'symbol'), 
      totalGains, 
      totalAvg 
    }
  }

  const updatePositions = ({ positions }, sell) => {
    // printPositions({ positions, totalGains, totalAvg });
    positions.forEach(position => {
      const { doSell, symbol, saleGain, shares, rating } = position;
      if (doSell) {
        sell(symbol, shares);
        ns.tprint(`WARN: SOLD ${shares} of ${symbol} (${rating}) for ${fcoin(saleGain)}}`)
      }
    })
  }

  const purchasePass = ((localBudget, currentGrid, buy, gains = 0) => {
    if(localBudget <= 1000) return localBudget;
    const stockList = sortByField(currentGrid, 'rating').reverse();
    const chooseToBuy = stockList.slice(0, stockList.length / 2).filter(stock => stock.rating > 0);
    const numInCart = chooseToBuy.length;
    const evenSpread = (localBudget - (numInCart * transactionFee)) / numInCart;
    if(evenSpread <= 1000) return localBudget;
    chooseToBuy.forEach(stock => {
      const { symbol, askPrice } = stock;
      const numShares = Math.floor((evenSpread - transactionFee) / askPrice);
      if (numShares > 0) {
        buy(symbol, numShares)
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


  if (command) {
    const { stockGrid, sell, buy } = await latestStockData();

    if (command === 'positions') {
      const isReverse = toggle === 'r';
      const positions = getPositions(stockGrid, field, isReverse);
      printPositions(positions);
      return;
    }

    if (command === 'showgrid' || command === 'grid') {
      const sortby = args[1];
      const reverse = args[2] === 'r';
      const stockList = sortByField(stockGrid, sortby || 'volatility');
      const noShow = ['maxShares', 'low', 'high', 'forcasthist'];
      const fields = Object.keys(stockList[0]).filter(f => !noShow.includes(f));
      ns.tprint('\n' + quickTable(reverse ? stockList.reverse() : stockList, fields).join('\n'));
      return;
    }

    if (command === 'buy') {
      purchasePass(getBudget(), stockGrid, buy);
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
        purchasePass(getBudget(), latestGrid, buy);
      }
      sessionState.first = false;
    }
    else {
      const positions = getPositions(latestGrid);
      updatePositions(positions, sell);
      purchasePass(getBudget(), latestGrid, buy, positions.totalGains);
    }

    await ns.write(holdingsfile, JSON.stringify(holdings), 'w');
    await ns.sleep(updatePositionFrequency)
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
    getPurchaseCost: (sym, shares = 0, posType = 'Long') => {
      const { askPrice } = grid.find(entry => entry.symbol === sym);
      return (askPrice * shares) + transactionFee;
    },
  };
}
