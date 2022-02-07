import { dataLibrary, padRight } from './botlib';

// op deploy
// op deploy home
// op deploy {file} {hostname}
// op exec
// op killbots
// op killall
// op status
// op wake 
// op wake hostname

const state = {
  command: null,
  option: null,
  dest: null,
  servers: {}
}

const validActions = ['grow', 'weaken', 'hack'];

export function autocomplete(data, args) {
  const r = [
    'deploy',
    'monitor',
    'status',
    'wake'
  ]
  return r;
}

/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const sourceServer = 'home';
  const fileLibrary = ['botlib.js', 'action-bot.js']; // use settings
  const actionBots = ['action-bot.js'];
  const memUsage = {
    'action-bot.js': 2.05
  }
  const { getWorldData, logData, fcoin } = dataLibrary(ns);

  const { args } = ns;
  const runOnce = 'once' === args[args.length - 1]; // last argument
  state.command = args[0];
  state.option = args[1];
  state.dest = args[2];
  const isDeployCommand = state.command === 'deploy';
  const isExecCommand = state.command === 'exec';
  const isKillBots = state.command === 'killbots';
  const showStatusCmd = state.command === 'status';
  const wakeAllAction = state.command === 'wake';
  const isMonitoring = state.command === 'monitor';
  const session = Date.now();

  const scpFiles = async ({ files = [], source, hostname }) => {
    const results = [];
    const didCopy = await ns.scp(files, source, hostname);
    logData({ event: 'scp', didCopy, files, hostname });
    results.push({ hostname, files, didCopy });
    await ns.sleep(100);
    return results;
  }

  const execFiles = async ({ files = [], hostname, threads = 1 }) => {
    const results = [];
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const script = files[fileIndex];
      const execResult = await ns.exec(script, hostname, threads);
      results.push({ hostname, files, execResult, threads });
      logData({ event: 'exec', script, hostname, threads, execResult })
    }
    return results;
  }

  const instanceBalance = (ramFree, scriptRam, maxThreads = 5, balance = [0.33, 0.33]) => {
    const g = parseFloat(balance[0]); // grow percent
    const w = parseFloat(balance[1]); // weaken pecent
    const h = 1 - (g + w);
    const threadsPerInstance = Math.floor((maxThreads / scriptRam));
    const maxInstances = Math.floor(ramFree / (threadsPerInstance * scriptRam));
    const grow = Math.floor(maxInstances * g);
    const weaken = Math.floor(maxInstances * w);
    const hack = Math.floor(maxInstances * h);
    const total = grow + weaken + hack;
    return {
      grow,
      weaken,
      hack,
      total,
      maxInstances,
      balance,
      threadsPerInstance,
      ramFree
    }
  }

  const canHaveBots = ({ramFree,  maxThreads, ram, balance}) => {
    if(ramFree <= 0) return false;
    const instBal = instanceBalance(ramFree, ram, maxThreads, balance);
    return instBal.maxInstances >= 1
  }

  const scpFilesToAllServers = async (serverList = [], files = []) => {
    const scpResults = [];
    const queue = serverList.map(({ hostname }) => ({
      hostname,
      files
    }));

    for (let i = 0; i < queue.length; i++) {
      scpResults.push(await scpFiles({ ...queue[i], source: sourceServer }));
    }

    const didAllCopy = scpResults.filter(entry => entry[0].didCopy);
    const isAllFail = didAllCopy.length === 0;
    const isAllSuccess = didAllCopy.length === scpResults.length;
    const isSomeFail = didAllCopy.length < scpResults.length;

    return { scpResults, isAllSuccess, isAllFail, isSomeFail };
  }

  const execFilesOnServers = async (serverList = [], files = []) => {
    const threads = 1;
    const execResults = [];
    for (let s = 0; s < serverList.length; s++) {
      const { hostname } = serverList[s];
      execResults.push(await execFiles({ hostname, files, threads }));
      await ns.sleep(100)
    }
    return execResults;
  }

  const killScript = async ({ filename = '', hostname = '', args = [] }) => {
    const result = await ns.kill(filename, hostname, ...args);
    const details = { event: 'kill', hostname, filename, args, result };
    logData(details)
    return details;
  }

  const killScripts = async (activeScripts = [], onlyhosts = []) => {
    const results = []
    let lastHostname = ''
    for (let s = 0; s < activeScripts.length; s++) {
      const { filename, args, hostname } = activeScripts[s];
      if(onlyhosts.length > 0 && onlyhosts.includes(hostname)){ continue; }
      if (filename !== 'operator.js') {
        if (hostname !== lastHostname) {
          ns.tprint(`Killing scripts on server ${hostname}...`);
          lastHostname = hostname;
        }
        results.push(await killScript({ filename, hostname, args }));
        await ns.sleep(50);
      }
    }
    return results;
  }

  const awakenBots = async (action, hostname, instances, threads) => {
    for (let count = instances; count > 0; count--) {
      try {
        // const execResult = true;
        const id = [action, session, hostname, count].join('|');
        const args = [action, threads, `${id}`];
        await executeAction({ hostname, threads, args })
      }
      catch (err) {
        ns.tprint(err);
      }
    }
  }

  const executeAction = async ({ hostname, threads, args = [] }) => {
    const execResult = await ns.exec(actionBots[0], hostname, threads, ...args);
    if (!execResult) {
      ns.tprint(`failed ${[actionBots[0], hostname, threads]}`)
    }
    await ns.sleep(100);
  }

  const awakenBotsOnServer = async ({ hostname, maxThreads = 4, balance }) => {
    const { ramFree } = state.servers[hostname];
    const ram = memUsage[actionBots[0]];
    const instBal = instanceBalance(ramFree, ram, maxThreads, balance);
    const { grow, weaken, hack, threadsPerInstance, maxInstances } = instBal;
    if(maxInstances < 2) {
      return await awakenBots('weaken', hostname, weaken, threadsPerInstance);
    }
    if(maxInstances < 3) {
      await awakenBots('grow', hostname, grow, threadsPerInstance);
      await awakenBots('weaken', hostname, weaken, threadsPerInstance);
    }
    await awakenBots('grow', hostname, grow, threadsPerInstance);
    await awakenBots('weaken', hostname, weaken, threadsPerInstance);
    await awakenBots('hack', hostname, hack, threadsPerInstance);
  }

  const getBotScriptLogs = (activeScripts = []) => {
    const summary = activeScripts.reduce((origin, entry) => {
      const { args = [], hostname, filename } = entry;
      const arg0 = args[0];
      if (validActions.includes(arg0)) {
        const log = ns.getScriptLogs(filename, hostname, ...args);
        origin.push(log)
      }
      return origin;
    }, []);
    return summary;
  }

  const getActiveScripts = (serverList) => serverList.map(({ hostname }) => ({
    scripts: ns.ps(hostname).map(val => ({ ...val, hostname })),
    hostname
  }));

  const getActiveBotScripts = (serverList) => {
    return getActiveScripts(serverList).map((group) => {
      const { scripts, hostname } = group;
      return scripts.filter(s => s.filename === actionBots[0]).map(entry => {
        entry.source = hostname;
        return entry;
      });
    }).flat();
  }

  const awakenBotsOnAllServers = async (serverList = [], maxThreads = 8, balance = [0.33, 0.33]) => {
    for (let i = 0; i < serverList.length; i++) {
      const { hostname } = serverList[i];
      await awakenBotsOnServer({ hostname, maxThreads, balance });
    }
  }

  const showStatus = (serverList) => {
    const activeScripts = getActiveScripts(serverList);
    const tempstat = {};
    activeScripts.forEach(script => {
      script.scripts.filter(script => script.filename === actionBots[0]).forEach(s => {
        tempstat[s.hostname] = tempstat[s.hostname] || 0;
        tempstat[s.hostname]++;
      })
    })
    const botScripts = getActiveBotScripts(serverList);
    const scriptLogs = getBotScriptLogs(botScripts);
    const { template } = getStatsFromLogs(scriptLogs);
    // const logStatRows = Object.values(summary) || [];
    // ns.tprint('\n' + quickTable(logStatRows, null, 12).join('\n'));
    // ns.tprint(JSON.stringify(stats, null, 1));
    ns.tprint(template);
  }

  const deployAllFiles = async (serverList = []) => {
    const { scpResults, isAllSuccess, isAllFail, isSomeFail } = await scpFilesToAllServers(serverList, fileLibrary);
    // if (isAllSuccess) { ns.tprint(`SUCCESS: all files copied to ${scpResults.length} servers`) }
    if (isAllFail) { ns.tprint(`ERROR: NO files copied to ${scpResults.length} servers`) }
    if (isSomeFail) { ns.tprint(`WARN: some files did not copy to ${scpResults.length} servers`) }
  }

  while (true) {
    const { servers, settings } = await getWorldData();
    const { balance = [0.33, 0.33] } = settings;
    state.servers = servers;
    state.balance = balance;
    const serverList = Object.values(servers);
    const validServers = serverList.filter(({ hasAdminRights, hostname }) => (hostname !== 'home' && hasAdminRights));

    if (isDeployCommand) {
      ns.tprint(`Deploy Command. Initiating file deployment to ${validServers.length} servers`);
      if (state.option && !state.dest) {
        await scpFiles({ files: fileLibrary, source: 'home', hostname: state.option });
      }
      else{
        await deployAllFiles(validServers);
      }
      return;
    }

    if (showStatusCmd) {
      showStatus(serverList);
      return;
    }

    if (wakeAllAction) {
      const maxThreads = state.dest || 8;
      if (state.option) {
        const { hostname } = servers[state.option];
        await awakenBotsOnServer({ hostname, maxThreads, balance });
      }
      else {
        await awakenBotsOnAllServers(validServers, maxThreads, balance);
      }
      return;
    }

    if (isExecCommand) {
      const execFilesResults = await execFilesOnServers(validServers, actionBots);
      ns.tprint(execFilesResults);
      return;
    }

    if (isKillBots) {
      const hostname = state.option;
      const botScripts = getActiveBotScripts(serverList);
      ns.tprint(`Kill Command. Killing ${botScripts.length} scripts....`)
      const killScriptResult = await killScripts(botScripts,[hostname]);
      if (killScriptResult.length > 0) {
        ns.tprint(`Success! Killed ${killScriptResult.length} bots.`)
      }
      else {
        ns.tprint('| No active bots.');
      }
      return;
    }

    if (isMonitoring) {
      const maxThreads = state.option || 8;
      const activeBotScripts = getActiveBotScripts(validServers).reduce((origin, entry) => {
        origin[entry.hostname] = 1
        return origin;
      }, {});
      const serversWithActiveBots = Object.keys(activeBotScripts);
      const ram = memUsage[actionBots[0]];
      const supportBots = validServers.filter(
        ({ramFree}) => (canHaveBots({ ramFree, maxThreads, ram, balance })));

      if(supportBots.length > serversWithActiveBots.length){
        ns.tprint('Monitoring... found new servers...')
        await deployAllFiles(supportBots);
        await awakenBotsOnAllServers(supportBots, maxThreads, balance);
      }
    }

    if (runOnce) {
      ns.tprint('INFO| Ran Once! Exiting.')
      return;
    }
    await ns.sleep(10000)
  }

  function getStatsFromLogs(logs = []) {
    const summary = {};
    ['action', ...validActions].forEach(action => {
      summary[action] = {
        event: '',
        events: 0,
        success: 0,
        fail: 0,
        total: 0,
        threads: 0
      };
    })
    const now = Date.now();
    const stats = {
      bots: {},
      servers: {},
      actions: {},
      next: {
        grow: now,
        weaken: now,
        hack: now
      },
      servercount: 0,
      botstotal: 0,
      threads: 0
    };
    logs.forEach(group => {
      group.forEach(log => {
        const json = typeof log === 'string' ? JSON.parse(log) : log;
        if (json && json.event) {
          const eventStats = summary[json.event];
          stats.servers[json.source] = stats.servers[json.source] || 0;
          stats.servers[json.source]++;
          const { actions } = stats;
          const { action } = json;
          if (json.event === 'action') {
            const isCompleted = json.datetime + json.ttl < now;
            actions[action] = actions[action] || { count: 0, completed: 0 };
            actions[action].count++
            actions[action].completed += isCompleted ? 1 : 0;
            if (!isCompleted) {
              stats.next[action] = Math.min(json.ttl, stats.next[action]);
            }
          }
          if (json.id) {
            stats.bots[json.id] = json.threads;
          }
          eventStats.events++;
          eventStats.event = json.event;
          if (json.results > 0) {
            try {
              eventStats.success++;
            }
            catch (e) {
              ns.tprint(e);
            }
          }
          if (json.results === 0) {
            eventStats.fail++;
          }
          if (typeof json.results === 'number' && json.results !== 0) {
            eventStats.total += json.results
          }
          summary[json.event] = eventStats;
        }
      })
    })
    stats.servercount = Object.keys(stats.servers).length;
    stats.botstotal = Object.keys(stats.bots).length;
    stats.threads = Object.values(stats.bots).reduce((o, e) => {
      return o + e;
    }, 0);
    stats.threads = Object.keys(stats.bots).reduce((origin, key) => {
      const action = key.split('|')[0];
      if (action) {
        origin[action] = origin[action] || 0;
        origin[action] += stats.bots[key];
      }
      return origin;
    }, {})

    // ns.tprint(JSON.stringify(summary, null, 1));
    const { botstotal, servercount, actions, next } = stats
    const pr = padRight;
    const defaultStat = { count : 0, completed: 0};
    const { grow = defaultStat, hack = defaultStat, weaken = defaultStat } = actions;

    const template = `
 ____________________________________
| ACTIVE BOTS: ${pr(botstotal, 5)}ON ${servercount} SERVERS!   |
| ${pr('', 34)} |
| ${pr('ACTIONS', 8)} ${pr('INIT | DONE | WIN  | FAIL', 23)} |
| ${pr('GROW:', 8)} ${pr(grow.count, 5)}| ${pr(grow.completed, 5)}| ${pr(summary.grow.success, 5)}| ${pr(summary.grow.fail, 5)}|
| ${pr('HACK:', 8)} ${pr(hack.count, 5)}| ${pr(hack.completed, 5)}| ${pr(summary.hack.success, 5)}| ${pr(summary.hack.fail, 5)}|
| ${pr('WEAKEN:', 8)} ${pr(weaken.count, 5)}| ${pr(weaken.completed, 5)}| ${pr(summary.weaken.success, 5)}| ${pr(summary.weaken.fail, 5)}|
| ${pr('', 34)} |
| ${pr('NEXT INCOMING ACTIONS...', 34)} |
| ${pr('GROW:', 8)} ${pr(next.grow !== now && ns.tFormat(next.grow), 25)} |
| ${pr('HACK:', 8)} ${pr(next.hack !== now && ns.tFormat(next.hack), 25)} |
| ${pr('WEAKEN:', 8)} ${pr(next.weaken !== now && ns.tFormat(next.weaken), 25)} |
| ${pr('', 34)} |
| ${pr('TOTALS:', 18)} ${pr('THREADS:', 15)} |
| ${pr('GROW:', 8)} ${pr(ns.nFormat(summary.grow.total, '000.000'), 9)} ${pr(stats.threads.grow, 15)} |
| ${pr('HACK:', 8)} ${pr(fcoin(summary.hack.total), 9)} ${pr(stats.threads.hack, 15)} |
| ${pr('WEAKEN:', 8)} ${pr(ns.nFormat(summary.weaken.total, '000.000'), 9)} ${pr(stats.threads.weaken, 15)} |
 ${pr('', 37, '\\')}
`;
    return { summary, stats, template };
  }

}

