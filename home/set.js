import { dataLibrary } from './botlib';
export const dataFile = '_settings.json';
export const defaultSettings = {
    loglevel: 1,
    lowestRam: 64,
    focusTargets: ''
}

export function autocomplete(data, args) {
    const value = args[0];
    if (value) return Object.keys(defaultSettings);
}

/** @param {NS} ns **/
export async function main(ns) {
    const { updateSettings, JSONSafeParse } = dataLibrary(ns);
    const { args } = ns;
    const key = args[0];
    const value = args[1];
    const lastSettings = await ns.read(dataFile);
    const settings = lastSettings ? JSONSafeParse(lastSettings) : defaultSettings;
    if (!key) {
        ns.tprint(JSON.stringify(settings, null, 1))
    }
    const newSettings = key ? { ...settings, ...{ [key]: value } } : settings;
    updateSettings(newSettings)
    const sealedSettings = JSON.stringify(newSettings, null, 1);
    await ns.write(dataFile, sealedSettings, 'w');
    ns.print(sealedSettings);
}

/*
alias init="run network-data.js; run player-data.js; run targets-data.js; run settings-data.js; run root-bot.js;"
alias set=run set.js
alias q=run q.js
*/
