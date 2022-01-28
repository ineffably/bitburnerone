const state = {
  money: 0,
  lastWrite: 0,
  initTick: 0,
  initMoney: 0,
  last: {},
  count: 0,
};

const calcCoinPerSecond = (money, initTick, initMoney) => {
  const delta = Date.now() - initTick;
  const gain = money - initMoney;
  const seconds = delta / 1000;
  return gain / seconds;
};

const getHackValues = (ns, hostname) => {
  const peekMultiplyer = 100;
  const threads = 1;
  const peekMoney = ns.hackAnalyze(hostname) * peekMultiplyer;
  const hackChance = ns.hackAnalyzeChance(hostname);
  const weakenTime = ns.getWeakenTime(hostname, threads);
  const growTime = ns.getGrowTime(hostname);
  const hackTime = ns.getHackTime(hostname);
  return {
    peekMoney,
    hackChance,
    weakenTime,
    growTime,
    hackTime,
  };
};

/** @param {import("../index").NS } ns */
const getNetworkServers = (ns, { money, hacking }) => {
  const servers = {};
  const getNetwork = (hostname = 'home') => {
    if (servers[hostname]) return {};
    const network = ns.scan(hostname);
    const server = {
      ...ns.getServer(hostname),
      ...getHackValues(ns, hostname),
    };

    // addons
    server.percentLeft = server.moneyAvailable / server.moneyMax;
    server.action = getHackAction(server, { money, hacking });
    
    servers[hostname] = server;
    
    return network.reduce((origin, hostname) => {
      origin[hostname] = getNetwork(hostname);
      return origin;
    }, {});
  };
  return {
    network: getNetwork(),
    servers,
  };
};

/** @param {import("../index").NS } ns */
const getPlayerData = (ns) => {
  const playerData = ns.getPlayer();
  if (state.initMoney === 0) {
    state.initMoney = playerData.money;
  }
  const { initTick, initMoney } = state;
  const coinpersec = calcCoinPerSecond(playerData.money, initTick, initMoney);
  playerData.coinpersec = coinpersec;
  return playerData;
};

/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const sleepSeconds = 0.5;
  while (true) {
    const player = getPlayerData(ns);
    const { servers, network } = getNetworkServers(ns, player);
    const worldState = {
      servers,
      player,
      network,
    };

    state.last = worldState;
    state.money = player.money;
    state.lastWrite = Date.now();

    ns.clearLog();
    ns.print(JSON.stringify(worldState));
    if (state.count++ % 120 === 0) {
      await ns.write('_world-data.json', JSON.stringify(state.last), 'w');
    }
    await ns.sleep(1000 * sleepSeconds);
  }
}

function getHackAction(server = {}, { money, hacking }) {
  const {
    hackChance,
    requiredHackingSkill,
    hackDifficulty,
    minDifficulty,
    moneyAvailable,
    serverGrowth,
    percentLeft,
    moneyMax,
  } = server;

  const scores = {
    hack: 0,
    grow: 0,
    weaken: 0,
  };

  // weaken
  scores.weaken += 100 - 100 * hackChance;
  if (hacking < requiredHackingSkill) {
    scores.weaken += 100;
  }
  if (hackDifficulty > 25) {
    scores.weaken += hackDifficulty;
  } else {
    scores.weaken += hackDifficulty - minDifficulty;
  }

  // grow
  if (moneyAvailable === 0) {
    scores.grow += 100 + serverGrowth;
  }
  if (percentLeft < 0.1 && moneyAvailable < money / 2) {
    scores.grow += serverGrowth;
  }
  if (moneyMax - moneyAvailable === 0) {
    scores.grow = 0;
  }

  // hack
  scores.hack += 100 - hackDifficulty;
  if (hackDifficulty < 25) {
    scores.hack += percentLeft * 100;
  }
  if (moneyAvailable > money / 2) {
    scores.hack += 25;
  }
  if (hackChance < 0.4) {
    scores.hack = 0;
  }

  let action = 'hack';
  if (scores.weaken >= 100) {
    action = 'weaken';
  }
  if (scores.grow >= 100) {
    action = 'grow';
  }

  return action;
}
