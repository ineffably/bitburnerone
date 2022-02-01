import { dataLibrary, quickTable } from './botlib';

const state = {
  command: ''
}

/** @param {import("../index").NS } ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const sourceServer = 'home';
  const fileLibrary = ['botlib.js', 'hacker-bot.js']; // use settings
  const startupFiles = ['hacker-bot.js'];
  const { getWorldData, logData } = dataLibrary(ns);
  const { args } = ns;
  const runOnce = 'once' === args[args.length - 1]; // last argument
  state.command = args[0];
  const isDeployCommand = state.command === 'deploy';
  const isExecCommand = state.command === 'exec';
  const isKillCommand = state.command === 'kill';
  const showIsActive = state.command === 'active';

  const scpFiles = async ({ files, hostname, source }) => {
    const results = [];
    for(let fi = 0; fi < files.length;fi++){
      const didCopy = await ns.scp(files, hostname, source);
      logData({ event: 'scp', didCopy, fileLibrary, hostname });
      results.push({ hostname, files, didCopy });
      await ns.sleep(100);
    }
    return results;
  }

  const execFiles = async ({ files, hostname, threads = 1 }) => {
    const results = [];
    for(let fileIndex = 0; fileIndex < files.length; fileIndex++){
      const script = files[fileIndex];
      const execResult = await ns.exec(script, hostname, threads);
      results.push({ hostname, files, execResult, threads });
      logData({ event: 'exec', script, hostname, threads, execResult })
    }
    return results;
  }

  const killFiles = async ({ files, hostname, threads = 1 }) => {
    const results = [];
    for(let fileIndex = 0; fileIndex < files.length; fileIndex++){
      const script = files[fileIndex];
      const killResult = await ns.kill(script, hostname);
      results.push({ hostname, files, killResult, threads, script });
      logData({ event: 'kill', script, hostname, threads, killResult })
      await ns.sleep(100);
    }
    return results;
  }

  const scpFilesToAllServers = async (serverList = [], files = []) => {
    const scpResults = [];
    const queue = serverList.map(({ hostname }) => ({
      hostname,
      files
    }));

    for(let i = 0; i < queue.length; i++){
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
    for(let s = 0; s < serverList.length; s++){
      const { hostname } = serverList[s];
      execResults.push(await execFiles({ hostname, files, threads }));
    }
    return execResults;
  }

  const killFilesOnServers = async (serverList = [], files = []) => {
    const threads = 1;
    const killResults = [];
    for(let s = 0; s < serverList.length; s++){
      const { hostname } = serverList[s];
      const killResult = await killFiles({ hostname, files, threads });
      ns.tprint({command: 'kill', hostname, killResult})
      killResults.push(killResult);
    }
    return killResults;
  };

  const getActiveScripts = ({ hostname, files = [], fileargs = []}) => {
    const result = files.map(file => {
      return {
        file,
        hostname,
        isRunning: ns.isRunning(file, hostname),
        runningScript: ns.getRunningScript(file, hostname),
        scriptIncome: ns.getScriptIncome(file, hostname),
        expGain: ns.getScriptExpGain(file, hostname)
      }
    })
    return result;
  }

  while (true) {
    const { servers } = await getWorldData();
    const validServers = Object.values(servers).filter(({ hasAdminRights, hostname }) => (hostname !== 'home' && hasAdminRights));
    
    if (isDeployCommand) {
      const { scpResults, isAllSuccess, isAllFail, isSomeFail } = await scpFilesToAllServers(validServers, fileLibrary);
      if(isAllSuccess){ ns.tprint(`SUCCESS: all files copied to ${scpResults.length} servers`) }
      if(isAllFail){ ns.tprint(`ERROR: NO files copied to ${scpResults.length} servers`) }
      if(isSomeFail){ ns.tprint(`WARN: some files did not copy to ${scpResults.length} servers`) }
    }
    if(showIsActive) {
      const allScripts = validServers.map(({ hostname }) => getActiveScripts({ hostname, files: startupFiles }));
      ns.tprint(allScripts[0]);
      // ns.tprint(allAcripts);
    }
    if(isExecCommand) {
      const execFilesResults = await execFilesOnServers(validServers, startupFiles);
      ns.tprint(execFilesResults);
    }
    if(isKillCommand){
      const killFilesResults = await killFilesOnServers(validServers, startupFiles)
      ns.tprint(killFilesResults);
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
