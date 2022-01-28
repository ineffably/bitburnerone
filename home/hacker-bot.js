import { dataLibrary, getRandomInt } from './botlib';

const sleepSeconds = 1;
const state = {
  pastTargets: [],
};

const getChoice = (serverList) => {
  const selected = serverList[getRandomInt(serverList.length - 1)];
  state.pastTargets.push(selected);
  return selected;
};

const nextTarget = (hostNames = []) => {
  const available = hostNames.filter(
    (hostname) => !state.pastTargets.includes(hostname)
  );
  if (available.length === 0) {
    state.pastTargets = [];
    return getChoice(hostNames);
  }
  return getChoice(available);
};

/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const { getWorldData, logData } = dataLibrary(ns);
  const args = ns.args;
  const runonce = args[0] === 'once';
  const { threads } = ns.getRunningScript();
  const { servers, player } = await getWorldData();
  const validServers = Object.values(servers).filter(server => server.hasAdminRights).reduce((origin, entry) => {
    origin[entry.hostname] = entry;
    return origin;
  }, {});
  const getNextServer = async () => {
    return validServers[nextTarget(Object.keys(validServers))];
  };

  while (true) {
    const target = await getNextServer();
    const { hacking } = player;
    if (!target) {
      logData({ event: 'notarget', message: 'no targets to hack'});
      await ns.sleep(getRandomInt(1000 * sleepSeconds));
      continue;
    }
    if (target.moneyMax === 0) {
      await ns.sleep(500);
      continue;
    }

    const {
      hackTime,
      hackChance,
      hostname,
      hackDifficulty,
      moneyAvailable,
      serverGrowth,
      minDifficulty,
      action,
    } = target;

    if (action === 'hack') {
      logData({
        event: 'hackAttempt',
        hostname,
        hackChance,
        hackTime,
        moneyAvailable,
        hackDifficulty,
        hacking,
      });
      const hackResults = await ns.hack(hostname, { threads });
      logData({ event: 'hack', hostname, hackResults });
    } else if (action === 'grow') {
      logData({ event: 'growAttempt', hostname, serverGrowth, moneyAvailable });
      const growResults = await ns.grow(hostname, { threads });
      logData({ event: 'grow', hostname, growResults });
    } else if (action === 'weaken') {
      logData({
        event: 'weakAttempt',
        hostname,
        minDifficulty,
        hackDifficulty,
        hacking,
      });
      const weakenResults = await ns.weaken(hostname, { threads });
      logData({ event: 'weaken', hostname, weakenResults });
    }
    if (runonce) {
      break;
    }
    await ns.sleep(getRandomInt(1000 * sleepSeconds));
  }
}
