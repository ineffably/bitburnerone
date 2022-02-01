import { dataLibrary, getRandomInt, quickTable, roundTo } from './botlib';

// op deploy
// op deploy home
// op deploy {file} {hostname}
// op exec
// op killbots
// op killall
// op status
// op grow {threads/inst} hostname

const state = {
  command: ''
}

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
  const growAction = state.command === 'grow';
  const session = Date.now();

  const threadMax = 10;

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

  const instanceBalance = (freeRam, scriptRam, maxThreads = 5, balance = [0.33, 0.33]) => {
    const g = parseFloat(balance[0]); // grow percent
    const w = parseFloat(balance[1]); // weaken pecent
    const h = 1 - (g + w);
    const ramPerInstance = (maxThreads / scriptRam);
    const maxInstances = Math.floor(freeRam / ramPerInstance);
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
      ramPerInstance,
      freeRam
    }
  }

  const awakenGrowbots = async (hostname, instances, threads) => {
    for (let count = instances; count > 0; count--) {
      try {
        // const execResult = true;
        const id = session + hostname + count;
        ns.tprint(`ns.exec(${[hostname, threads, 'grow', threads, id]}`)
        const execResult = await ns.exec(actionBots[0], hostname, threads, 'grow', threads, `${session + hostname + count}`);
        if (!execResult) {
          ns.tprint(`failed ${[actionBots[0], hostname, threads]}`)
          continue;
        }
      }
      catch (err) {
        ns.tprint(err);
      }

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
    }
    return execResults;
  }

  const killScripts = async (activeScripts = []) => {
    for (let s = 0; s < activeScripts.length; s++) {
      const { hostname, scripts } = activeScripts[s];
      for (let x = 0; x < scripts.length; x++) {
        const { filename, args, } = scripts[x];
        if (filename !== 'operator.js') {
          const result = await ns.kill(filename, hostname, ...args);
          logData({event: 'kill', hostname, filename, args, result })
        }
      }
    }
  }

  const getActiveScripts = (serverList) => serverList.map(({ hostname }) => ({ scripts: ns.ps(hostname), hostname }));

  while (true) {
    const { servers, settings } = await getWorldData();
    const { balance = [0.33, 0.33] } = settings;
    const serverList = Object.values(servers);
    const [growPercent, weakenPercent] = typeof balance === 'object' ? balance : JSON.parse(balance);
    const hackPercent = 1 - (growPercent + weakenPercent);
    let totalFreeRam = 0;
    const validServers = serverList.filter(({ hasAdminRights, hostname, ramUsed, maxRam }) => {
      if (hostname !== 'home' && hasAdminRights) {
        totalFreeRam += (maxRam - ramUsed)
        return true;
      }
    });
    if (growAction && state.command && state.dest) {
      // grow a specific server
      const maxThreads = state.option;
      ns.tprint(state.dest);
      const { hostname, ramFree } = servers[state.dest];
      if (hostname) {
        const instBal = instanceBalance(ramFree, 2.0, maxThreads, balance);
        const { ramPerInstance, maxInstances } = instBal;
        ns.tprint({ hostname, ramPerInstance, maxThreads });
        await awakenGrowbots(hostname, maxInstances, ramPerInstance);
      }
    }
    if (isDeployCommand) {
      if(state.option && !state.dest){
        await scpFiles({files: fileLibrary, source: 'home', hostname: state.option});
      }
      const { scpResults, isAllSuccess, isAllFail, isSomeFail } = await scpFilesToAllServers(validServers, fileLibrary);
      if (isAllSuccess) { ns.tprint(`SUCCESS: all files copied to ${scpResults.length} servers`) }
      if (isAllFail) { ns.tprint(`ERROR: NO files copied to ${scpResults.length} servers`) }
      if (isSomeFail) { ns.tprint(`WARN: some files did not copy to ${scpResults.length} servers`) }
    }
    if (showStatus) {

      // const flatScripts = allScripts.flat(1);
      // const onlyActive = flatScripts.filter(item => item.isRunning);
      // const onlyShow = ['file','hostname','threads', "offlineExpGained","offlineMoneyMade","offlineRunningTime","onlineExpGained","onlineMoneyMade","onlineRunningTime"]
      // const fields = Object.keys(flatScripts[0]).filter(key => onlyShow.includes(key));
      // const instances = instanceBalance(totalFreeRam, 2.0, 8, balance);
      // ns.tprint('\n' + quickTable(onlyActive, fields).join('\n'));
      // ns.tprint([
      //   `Free Ram: ${totalFreeRam}`, 
      //   `g,w,h ${[growPercent, weakenPercent, hackPercent]}`,
      //   JSON.stringify(instances, null, 1)
      // ].join('\n'))
    }
    if (isExecCommand) {
      const execFilesResults = await execFilesOnServers(validServers, actionBots);
      ns.tprint(execFilesResults);
    }
    if (isKillBots) {
      const botScripts = getActiveScripts(serverList).filter(
        ({ scripts }) => scripts.length > 0 && scripts.includes(actionBots[0]));
      await killScripts(botScripts);
      // if(state.option){
      //   const killFilesResults = await killFilesOnServers([state.option], actionBots)
      //   ns.tprint(killFilesResults);
      // }
      // const killFilesResults = await killFilesOnServers(validServers, actionBots)
      // ns.tprint(killFilesResults);
    }
    if (runOnce) {
      ns.tprint('INFO:RAN ONCE EXITING')
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
