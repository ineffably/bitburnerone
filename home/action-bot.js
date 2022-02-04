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
  const { getWorldData, logData, getSettingsData, log } = dataLibrary(ns);
  const { args } = ns;
  const source = ns.getHostname();
  const runOnce = 'once' === args[args.length - 1]; // last argument
  const action = args[0];
  const threads = args[1] || 1;
  const id = args[2];
  const isMock = false;
  if (action === '' || !actions.includes(action)) {
    ns.tprint(`ERROR: "${actions.join(',')}" must be provided to take action`)
    return;
  }

  const longsleep = 10000;
  const showLog = (event) => {
    log(Object.keys(event).map(key => `${key}: ${event[key]} `).join('|'), LOGTYPE.info);
  }

  while (true) {
    const settings = await getSettingsData();
    const { targets, player } = await getWorldData();
    const targetServer = targets[action].slice(0,5)[getRandomInt(Math.min(4, targets[action].length - 1))];
    if(!targetServer){
      ns.tprint(`ERROR: no target servers ${args}`)
      await ns.sleep(longsleep);
      return;
    }
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
    } = targetServer;

    let results = 0;
    const event = { 
      event: 'action', 
      source,
      action, 
      hostname, 
      hackChance, 
      moneyMax, 
      moneyAvailable, 
      hackDifficulty, 
      hacking, 
      serverGrowth,
      threads,
      id
    };
    if(settings.showAction){ showLog(event) }
    if (isMock) {
      await ns.sleep(10000 + getRandomInt(10000));
    }
    else {
      // results = await ns[action](hostname, { threads }); // ideal, but, hides the mem cost
      if (action === 'hack') {
        event.ttl = hackTime;
        logData(event);
        results = await ns.hack(hostname, { threads })
      } else if (action === 'grow') {
        event.ttl = growTime;
        logData(event);
        results = await ns.grow(hostname, { threads });
      } else if (action === 'weaken') {
        event.ttl = weakenTime;
        logData(event);
        results = await ns.weaken(hostname, { threads });
      }
    }
    const resultEvent = { event: action, hostname, results, isMock, threads, source, id }
    if(settings.showAction){ showLog(resultEvent) }
    logData(resultEvent);
    if (runOnce) { break; }
    await ns.sleep(500);
  }
}
