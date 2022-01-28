import { dataFile } from './set.js'
let _settings = {};
const sleepyTime = 500;

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    const { args } = ns;
    const runonce = args[0] === 'once';
    while (true) {
        const lastSettings = await ns.read(dataFile);
        if(_settings === lastSettings){
            await ns.sleep(sleepyTime);
            continue;
        }
        _settings = lastSettings;
        ns.clearLog();
        ns.print(lastSettings);
        if(runonce){ break; }
        await ns.sleep(sleepyTime);
    }
}
