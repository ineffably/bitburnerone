import { sortByField, dataLibrary } from './botlib';

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
    server.percentLeft = Math.max(server.moneyAvailable / server.moneyMax, 0.000001);
    server.files = server.hasAdminRights && ns.ls(hostname);
		server.ramFree = server.maxRam - server.ramUsed;
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

const growTargets = (serverList = [], takeTop = 5) => {
  const growFilter = ((server) => true);
  const list = sortByField(sortByField(serverList.filter(growFilter), 'serverGrowth').reverse(), 'percentLeft');
  return (takeTop ? list.slice(0, takeTop) : list);
}

const weakenTargets = (serverList = [], takeTop = 5) => {
  const list = sortByField(serverList, 'weakenTime');
  return (takeTop ? list.slice(0, takeTop) : list);  
}

const hackTargets = (serverList = [], hacking, takeTop = 5) => {
  const hackServers = serverList.filter(({ requiredHackingSkill, moneyAvailable }) => 
    (requiredHackingSkill < hacking && moneyAvailable > 0 ));
  const list = sortByField(hackServers, 'hackTime');
  return (takeTop ? list.slice(0, takeTop) : list);
}

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
  const { getSettingsData } = dataLibrary(ns);
  const sleepSeconds = 0.5;
  const numTargets = 10;
  while (true) {
    const settings = await getSettingsData();
    const player = getPlayerData(ns);
    const { servers, network } = getNetworkServers(ns, player);
    const serverList = Object.values(servers);
    const hackableServers = serverList.filter(server => !server.purchasedByPlayer && server.moneyMax > 0 && server.hasAdminRights) 
    const growList = growTargets(hackableServers, numTargets);
    const weakenList = weakenTargets(hackableServers, numTargets);
    const hackList = hackTargets(hackableServers, player.hacking, numTargets);

    // const hackTargets = getHackTargets(ns, servers);
    const worldState = {
      servers,
      player,
      network,
      targets: {
        grow: growList,
        weaken: weakenList,
        hack: hackList
      },
      settings
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
