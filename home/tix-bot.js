import { dataLibrary } from './botlib';

const holdings = [];

function quickTable(objRecords = [], showFields = []) {
  const colwidth = 11;
  const fields = Object.keys(objRecords[0]).filter(f => showFields.includes(f));
  const sep = fields.reduce((o, e) => { o[e] = '-------------'; return o; }, {});
  const header = fields.reduce((o, e) => { o[e] = e; return o; }, {});
  const records = [header, sep]
    .concat(objRecords)
    .map((obj) => fields.map((field) => `${obj[field]}`));
  return records.map((row) =>
    row.map((cellValue) =>
        padRight((cellValue + '').substring(0, colwidth), colwidth, ' ')
      ).join('| ')
  );
}


function padRight(value, len, padWith) {
  let result = value;
  while (result.length < len) {
    result += padWith;
  }
  return result;
}

function sortByField(objArray, field) {
  return objArray.sort((a, b) =>
    a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0
  );
}

/** @param {import("../index").NS } ns */
export async function main(ns) {
  const { getStockData } = dataLibrary(ns);
  // ns.stock.getPurchaseCost();
  const mockTransactions = (grid) => {
    const transactionFee = 100000;
    return {
      buy: (sym, shares) => {
        const stock = grid.find(entry => entry.symbol === sym);
        const { askPrice } = stock;
        holdings.push({ action: 'buy', sym, shares, askPrice });
      },
      sell: (sym, shares) => {
        const stock = grid.find(entry => entry.symbol === sym);
        const { price } = stock;
        holdings.push({ action: 'sell', sym, shares, price });
      },
      getPurchaseCost: (sym, shares = 0, posType = 'Long') => {
        // ns.tprint([sym]);
        const stock = grid.find(entry => entry.symbol === sym);
        const { askPrice } = stock;
        return (askPrice * shares) + transactionFee;
      },
    };
  };
  
  const { stockGrid } = await getStockData();
  const { args } = ns;
  const mocks = mockTransactions(stockGrid)
  const byVolatility = sortByField(stockGrid.map(stock => {
    stock.mockpurch = mocks.getPurchaseCost(stock.symbol, 1, 'Long');
    return stock;
  }), 'volatility');
  setRating(byVolatility);
  

  if (args[0] === 'showgrid') {
    const sortby = args[1];
    const reverse = args[2] === 'r';
    const stockList = sortByField(stockGrid, sortby || 'volatility');
    const noShow = ['maxShares', 'position', 'low', 'high'];
    const fields = Object.keys(stockList[0]).filter(f => !noShow.includes(f));
    ns.tprint(
      '\n' +
      quickTable(reverse ? stockList.reverse() : stockList, fields).join(
        '\n'
      )
    );
    return;
  }
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

// stock.cancelOrder
// stock.getOrders
// stock.getSaleGain
// stock.placeOrder

// forcast: getForecast(sym),
// maxShares: getMaxShares(sym),
// askPrice: getAskPrice(sym),
// bigPrice: getBidPrice(sym),
// price: getPrice(sym),
// position: getPosition(sym),
// volatility: getVolatility(sym)
