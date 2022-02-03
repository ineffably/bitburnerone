import { dataLibrary, quickTable } from './botlib';

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


/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const memUsage = {
    'action-bot.js': 2
  }
  const sourceServer = 'home';
  const fileLibrary = ['botlib.js', 'action-bot.js']; // use settings
  const actionBots = ['action-bot.js'];
  const { getWorldData, logData } = dataLibrary(ns);

  const { args } = ns;
  const runOnce = 'once' === args[args.length - 1]; // last argument
  state.command = args[0];
  state.option = args[1];
  state.dest = args[2];
  const isDeployCommand = state.command === 'deploy';
  const isExecCommand = state.command === 'exec';
  const isKillBots = state.command === 'killbots';
  const isKillAll = state.command === 'killall';
  const showStatus = state.command === 'status';
  const wakeAllAction = state.command === 'wake';
  const growAction = state.command === 'grow';
  const isMonitoring = state.command === 'monitor';
  const session = Date.now();

  const threadMax = 10;

  const actionBotFilter = ({ scripts }) => scripts.length > 0 && scripts.find(s => s.filename === actionBots[0]);

  const scpFiles = async ({ files = [], source, hostname }) => {
    const results = [];
    const didCopy = await ns.scp(files, source, hostname);
    logData({ event: 'scp', didCopy, files, hostname });
    results.push({ hostname, files, didCopy });
    await ns.sleep(100);
    return results;
  }

  const execFiles = async ({ files, hostname, threads = 1 }) => {
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
    // ns.tprint({ event: 'kill', hostname, filename, args, result });
    const details = { event: 'kill', hostname, filename, args, result };
    logData(details)
    return details;
  }

  const killScripts = async (activeScripts = []) => {
    const results = []
    for (let s = 0; s < activeScripts.length; s++) {
      const { filename, args, hostname } = activeScripts[s];
      if (filename !== 'operator.js') {
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
    const instBal = instanceBalance(ramFree, 2.0, maxThreads, balance);
    const { grow, weaken, hack, threadsPerInstance } = instBal;
    await awakenBots('grow', hostname, grow, threadsPerInstance);
    await awakenBots('weaken', hostname, weaken, threadsPerInstance);
    await awakenBots('hack', hostname, hack, threadsPerInstance);
  }

  const getBotScriptLogs = (activeScripts = []) => {
    const summary = activeScripts.reduce((o, script) => {
        const { args = [], hostname, filename } = script;
        const arg0 = args[0];
        if (validActions.includes(arg0)) {
          const log = ns.getScriptLogs(filename, hostname, ...args);
          o.push(log)
        }
      return o;
    }, []);
    return summary;
  }

  const getStatsFromLogs = (logs = []) => {
    const events = {};
    logs.forEach(group => {
      group.forEach(log => {
        const json = typeof log === 'string' ? JSON.parse(log) : log;
        if (json && json.event) {
        const eventStats = events[json.event] || {
            event: '',
            events: 0,
            success: 0,
            fail: 0,
            total: 0
          };
          eventStats.events++;
          eventStats.event = json.event;
          if (json.results > 0) {
            eventStats.success++;
          }
          if (json.results === 0) {
            eventStats.fail++;
          }
          if (typeof json.results === 'number' && json.results !== 0) {
            eventStats.total += json.results
          }
          events[json.event] = eventStats;
          // events[json.event] = (events[json.event] ? events[json.event] + 1 : 1);
        }
      })
    })
    return events;
  }

  const getActiveScripts = (serverList) => serverList.map(({ hostname }) => ({
    scripts: ns.ps(hostname).map(val => ({ ...val, hostname })),
    hostname
  }));

  const getActiveBotScripts = (serverList)  => {
    return getActiveScripts(serverList).map(
      ({scripts, hostname}) => scripts.filter(
        s => s.filename === actionBots[0]).map(entry => { entry.hostname = hostname; return entry;})).flat();
  }

  const awakenBotsOnAllServers = async (serverList = [], maxThreads = 8, balance = [0.33, 0.33]) => {
    for (let i = 0; i < serverList.length; i++) {
      const { hostname } = serverList[i];
      await awakenBotsOnServer({ hostname, maxThreads, balance });
    }
  }

  const doShowStatus = (serverList) => {
    const botScripts = getActiveBotScripts(serverList);
    const scriptLogs = getBotScriptLogs(botScripts);
    const logStats = getStatsFromLogs(scriptLogs);
    const logStatRows = Object.values(logStats) || [];
    ns.tprint('\n' + quickTable(logStatRows, null, 12).join('\n'));
  }

  while (true) {
    const { servers, settings } = await getWorldData();
    state.servers = servers;
    const { balance = [0.33, 0.33] } = settings;
    state.balance = balance;
    const serverList = Object.values(servers);
    const validServers = serverList.filter(({ hasAdminRights, hostname }) => (hostname !== 'home' && hasAdminRights));

    if (growAction && state.command && state.dest) {
      // grow a specific server
      const maxThreads = state.option;
      const { hostname, ramFree } = servers[state.dest];
      if (hostname) {
        const instBal = instanceBalance(ramFree, 2.0, maxThreads, balance);
        const { ramPerInstance, maxInstances } = instBal;
        ns.tprint({ hostname, ramPerInstance, maxThreads });
        await awakenBots('grow', hostname, maxInstances, ramPerInstance);
      }
    }

    if (isDeployCommand) {
      if (state.option && !state.dest) {
        await scpFiles({ files: fileLibrary, source: 'home', hostname: state.option });
      }
      const { scpResults, isAllSuccess, isAllFail, isSomeFail } = await scpFilesToAllServers(validServers, fileLibrary);
      if (isAllSuccess) { ns.tprint(`SUCCESS: all files copied to ${scpResults.length} servers`) }
      if (isAllFail) { ns.tprint(`ERROR: NO files copied to ${scpResults.length} servers`) }
      if (isSomeFail) { ns.tprint(`WARN: some files did not copy to ${scpResults.length} servers`) }
    }

    if (showStatus) {
      doShowStatus(serverList);
    }
    if (wakeAllAction) {
      if (state.option) {
        const maxThreads = 8;
        const { hostname, ramFree } = servers[state.option];
        await awakenBotsOnServer({ hostname, maxThreads, balance });
      }
      else {
        await awakenBotsOnAllServers(validServers, 8, balance);
      }
    }
    if (isExecCommand) {
      const execFilesResults = await execFilesOnServers(validServers, actionBots);
      ns.tprint(execFilesResults);
    }
    if (isKillBots) {
      const botScripts = getActiveBotScripts(serverList);
      const killScriptResult = await killScripts(botScripts);
      if (killScriptResult.length > 0) {
         ns.tprint(`Success! Killed ${killScriptResult.length} bots.`)
      }
      else {
        ns.tprint('| No active bots.');
      }
    }
    if (runOnce) {
      ns.tprint('INFO| Ran Once! Exiting.')
      return;
    }
    return await ns.sleep(1000)
  }

}

// exec(script: string, host: string, numThreads?: number, ...args: Array<string | number | boolean>): number;
// fileExists(filename: string, host?: string): boolean;
/*
getScriptExpGain()	Get the exp gain of a script.
getScriptExpGain(script, host, args)	
getScriptIncome()	Get the income of a script.
getScriptIncome(script, host, args)	
getScriptLogs(fn, host, args)	Get all the logs of a script.
getScriptName()	Returns the current script name.
getScriptRam(script, host)
isRunning(script, host, args)	Check if a script is running.
kill(script)	Terminate another script.
kill(script, host, args)
killall(host?: string): boolean;
spawn(script, numThreads, args)
getRunningScript(filename, hostname, args)
ls(host, grep)	List files on a server.
mv(host, source, destination)
scp(files, destination)	Copy file between servers.
scp(files, source, destination)
run(script, numThreads, args)
scriptKill(script, host)	Kill all scripts with a filename.
scriptRunning(script, host)

  */
