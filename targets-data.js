import { dataLibrary } from './home/botlib';

/** @param {NS} ns **/
const results = {
    servers: {}
};
const sleepInterval = 2 * 1000;
export async function main(ns) {
    ns.disableLog('ALL');
    const { getNetworkData, getPlayerData, getSettings } = dataLibrary(ns);
    const focusTargets = (await getSettings('focusTargets') || '').split(',');

    const { args } = ns;
    const runOnce = args[0];
    while (true) {
        const { servers } = await getNetworkData();
        const { hacking, money } = await getPlayerData();
        const threads = 1;
        const thefilter = server => server.hasAdminRights && !server.purchasedByPlayer;
        Object.values(servers).filter(thefilter).map(server => {
            // make this a reduce. chad!!
            const {
                hostname,
                hackDifficulty,
                minDifficulty,
                moneyMax,
                moneyAvailable,
                requiredHackingSkill,
                serverGrowth
            } = server;
            // const weakenAnalyze = allCores.map(cores => ns.weakenAnalyze(threads, cores));
            const moneyThreshold = 0.3;
            const difficultyDelta = 25;
            const peekMoney = ns.hackAnalyze(hostname);
            const hackChance = ns.hackAnalyzeChance(hostname);
            const weakenTime = ns.getWeakenTime(hostname, threads);
            const growTime = ns.getGrowTime(hostname);
            const hackTime = ns.getHackTime(hostname);
            const moneyGap = moneyMax - moneyAvailable;
            const shouldGrow = moneyAvailable < moneyMax * moneyThreshold;
            const shouldWeaken = hackDifficulty > 80;
            const percentLeft = moneyAvailable / moneyMax;

            const shouldHack = hacking > requiredHackingSkill && moneyAvailable > 100000 && hackDifficulty < 90; // && hackChance > 50 && percentLeft > 1; // && moneyAvailable > 500000;

            // weaken
            // checkmoney
            // hack
            const scores = {
                hack: 0,
                grow: 0,
                weaken: 0
            }

            scores.weaken += 100 - (100 * hackChance);
            if(hacking < requiredHackingSkill){
                scores.weaken += 100;
            }
            if(hackDifficulty > 25){
                scores.weaken += hackDifficulty;
            }
            else {
                scores.weaken += hackDifficulty - minDifficulty;
            }

            if(moneyAvailable === 0){
                scores.grow += 100 + serverGrowth;
            }
            if(percentLeft < 0.1 && moneyAvailable < money / 2){
                scores.grow += serverGrowth;
            }
            if(moneyMax - moneyAvailable === 0){
                scores.grow = 0;
            }
            scores.hack += 100 - hackDifficulty;
            if(hackDifficulty < 25){
                scores.hack += percentLeft * 100;
            }
            if(moneyAvailable > money / 2){
                scores.hack += 25;
            }
            if(hackChance < 0.4){
                scores.hack = 0
            }

            let action = 'hack';
            if(scores.weaken >= 100){
                action = 'weaken';
            }
            if(scores.grow >= 100){
                action = 'grow';
            }
            

            const hackData = {
                action,
                moneyGap,
                shouldGrow,
                shouldWeaken,
                peekMoney,
                shouldHack,
                percentLeft,
                hackChance,
                hackThreads,
                weakenTime,
                growTime,
                hackTime
            }
            results.servers[hostname] = { ...server, ...hackData, scores };
            results.targets = (focusTargets[0] !== '' && focusTargets) || [];

        })

        ns.clearLog();
        ns.print(JSON.stringify(results));

        if (runOnce) break;
        await ns.sleep(sleepInterval)
    }
}
