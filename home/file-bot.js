import { maxThreads, dataLibrary } from './botlib';

const bundle = ['botlib.js', 'hacker-bot.js'];
const runthese = ['hacker-bot.js'];

// const getInstanceCount = (scriptRam, freeRam, maxThreads) => {
// 	return Math.floor(freeRam / (scriptRam * maxThreads));
// }

/** @param {import("../index").NS } ns */
export async function main(ns) {
	const { getWorldData, logData } = dataLibrary(ns);
	ns.disableLog('ALL');

	// copy-bot once
	// copy-bot once update
	// copy-bot run update
	const { args } = ns;
	const command = args[0];
	const runonce = command === 'once'
	// const runfile = command === 'run';
	const task = args[1];
	const update = task === 'update' || command === 'update';
	const killit = task === 'kill';

	const scriptRam = 2.35;
	const sleepTime = 1000 * 60;
	while (true) {
		const { servers } = await getWorldData();
		const allHosts = Object.values(servers).filter(s => s.hasAdminRights && s.hostname !== 'home');
		logData({ event: 'filebotPass', count: allHosts.length });
		for (var i = 0; i < allHosts.length; i++) {
			const { hostname } = allHosts[i];
			const server = servers[hostname];
			const ramFree = server.maxRam - server.ramUsed;
			const isEnoughRam = ramFree > scriptRam;
			for (var x = 0; x < bundle.length; x++) {
				const script = bundle[x];
				if (update || !ns.fileExists(script, hostname)) {
					try {
						logData({ event: 'scp', script, hostname });
						await ns.scp(script, hostname);
					}
					catch (e) {
						logData({ event: 'scp_error', script, hostname });
					}
				}
			}
			for (var n = 0; n < runthese.length; n++) {
				const script = runthese[n];
				const isRunning = ns.isRunning(script, hostname);
				if ((update || killit) && isRunning) {
					logData({ event: 'killAttempt', script, hostname });
					const killResults = ns.kill(script, hostname);
					logData({ event: 'kill', killResults, script, hostname });
					await ns.sleep(200);
				}
				if (killit) {
					continue;
				}
				if ((update || !isRunning) && isEnoughRam) {
					const threads = maxThreads(scriptRam, server.maxRam, server.ramUsed);
					logData({ event: 'exec', script, hostname, threads, ramFree, isEnoughRam });
					await ns.exec(script, hostname, threads);
					await ns.sleep(200);
				}
			}
		}
		if (runonce) {
			break;
		}
		await ns.sleep(sleepTime)
	}
}
