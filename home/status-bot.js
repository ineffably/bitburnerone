import { statusPane, el, serversView } from './statusPane';
import { dataLibrary } from './botlib';

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	const { args } = ns;
	const { getWorldData, JSONSafeParse } = dataLibrary(ns);
	const { adjustPane, out, off, reset, getGraphEl, clearConsole } = statusPane(ns);

	if (args[0] === 'reset') {
		reset();
		return;
	}

	if (args[0] === 'off') {
		off();
		return;
	}

	ns.atExit = () => {
		off();
	}
	
	reset();
	const stateTracker = {}
	const graphElement = getGraphEl();
	let serverTable = document.getElementById('serverTable');
	if (!serverTable) {
		serverTable = el('div', { id: 'serverTable' });
		graphElement.innerHTML = '';
		graphElement.appendChild(serverTable);
	}
	else {
		serverTable.innerHTML = '';
	}
	const hackbot = 'hacker-bot.js';
	const homeScripts = [
		'file-bot.js',
		'nethack-bot.js',
		'purchase-bot.js',
	]
	while (true) {
		const { servers } = await getWorldData();
		const serverList = Object.values(servers);
		const outQueue = [];
		const queueEntry = ({ scriptname, hostname }) => {
			const scriptLogs = ns.getScriptLogs(scriptname, hostname) || [];
			if (scriptLogs.length === 0) { return }
			const lastTick = stateTracker[hostname + scriptname] || 0;
			// const filter = entry => entry && entry.datetime > lastTick;
			const parsedLog = scriptLogs.map(entry => {
				if (typeof entry === 'string' && entry.startsWith('{')) {
					if(entry.includes('"event":'))
						return JSONSafeParse(entry);
					else {
						const obj = JSONSafeParse(entry);
						obj.event = 'unknown'
					}
				}
				else {
					// ns.tprint('unknown entry : ' + entry);
					return { event: 'textLog', message: entry }
				}
			}); //.filter(filter);
			parsedLog.filter(e => e !== null).forEach(logentry => outQueue.push(logentry));
			stateTracker[hostname + hackbot] = Date.now();
		}
		const hackerServers = serverList.filter(server => (server.hasAdminRights && ns.isRunning(hackbot, server.hostname)));
		hackerServers.forEach(server => {
			const { hostname } = server;
			const scriptname = 'hacker-bot.js';
			queueEntry({ hostname, scriptname });
		})

		homeScripts.forEach(scriptname => {
			const hostname = 'home';
			queueEntry({ hostname, scriptname });
		})

		clearConsole();
		outQueue.sort((a = {datetime: 0}, b = {datetime: 0}) => (a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0)).slice(0, 1000).forEach(entry => out(entry));
		serverTable.children[0] && serverTable.children[0].remove();
		const view = await serversView(ns, serverList);
		serverTable.appendChild(view);

		adjustPane();
		await ns.sleep(500);
	}
}
