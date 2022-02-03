import { dataLibrary, getRandomInt, LOGTYPE } from './botlib';

// usage:
// action-bot.js grow 1 once
// action-bot.js weaken 20
// action-bot.js weaken 5 once
// action-bot.js hack 10

const actions = ['grow', 'hack', 'weaken'];

/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.disableLog('ALL')
  const { getWorldData, logData, getSettings, log } = dataLibrary(ns);
  const { args } = ns;
  const runOnce = 'once' === args[args.length - 1]; // last argument
  const action = args[0];
  const threads = args[1] || 1;
  const isMock = false;
  if (action === '' || !actions.includes(action)) {
    ns.tprint(`ERROR: "${actions.join(',')}" must be provided to take action`)
    return;
  }

  const showLog = (event) => {
    log(Object.keys(event).map(key => `${key}: ${event[key]} `).join('|'), LOGTYPE.info);
  }

  while (true) {
    const settings = await getSettings();
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
    const event = { event: 'action', action, hostname, hackChance, hackTime, growTime, weakenTime, moneyMax, moneyAvailable, hackDifficulty, hacking, serverGrowth };
    if(settings.showAction){ showLog(event) }
    logData(event);
    if (isMock) {
      await ns.sleep(10000 + getRandomInt(10000));
    }
    else {
      // results = await ns[action](hostname, { threads }); // ideal, but, hides the mem cost
      if (action === 'hack') {
        results = await ns.hack(hostname, { threads })
      } else if (action === 'grow') {
        results = await ns.grow(hostname, { threads });
      } else if (action === 'weaken') {
        results = await ns.weaken(hostname, { threads });
      }
    }
    const resultEvent = { event: action, hostname, results, isMock, threads }
    if(settings.showAction){ showLog(resultEvent) }
    logData(resultEvent);
    if (runOnce) { break; }
    await ns.sleep(500);
  }
}
