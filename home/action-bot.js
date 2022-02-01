import { dataLibrary, getRandomInt } from './botlib';

// usage:
// action-bot.js grow 1 once
// action-bot.js weaken 20
// action-bot.js weaken 5 once
// action-bot.js hack 10

const actions = ['grow', 'hack', 'weaken'];

/** @param {import("../index").NS } ns */
export async function main(ns) {
  const { getWorldData, logData } = dataLibrary(ns);
  const { args } = ns;
  const runOnce = 'once' === args[args.length - 1]; // last argument
  const action = args[0];
  const threads = args[1] || 1;
  const mockAction = true;
  if (action === '' || !actions.includes(action)) {
    ns.tprint(`ERROR: "${actions.join(',')}" must be provided to take action`)
    return;
  }

  while (true) {
    const { targets, player } = await getWorldData();
    const { hacking } = player;
    const {
      hostname,
      hackChance,
      hackTime,
      growTime,
      weakenTime,
      moneyAvailable,
      hackDifficulty,
      serverGrowth,
      moneyMax
    } = targets[action][0];

    let results = 0;
    logData({ event: 'action', action, hostname, hackChance, hackTime, growTime, weakenTime, moneyMax, moneyAvailable, hackDifficulty, hacking, serverGrowth });
    if (mockAction) {
      await ns.sleep(10000 + getRandomInt(10000));
    }
    else {
      results = await ns[action](hostname, { threads });
      // if (action === 'hack') {
      //   results = await ns.hack(hostname, { threads })
      // } else if (action === 'grow') {
      //   results = await ns.grow(hostname, { threads });
      // } else if (action === 'weaken') {
      //   results = await ns.weaken(hostname, { threads });
      // }
    }
    logData({ event: action, hostname, results, mockAction });
    if (runOnce) { break; }
    await ns.sleep(500);
  }
}

export function autocomplete(data, args) {
}
