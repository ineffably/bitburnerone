import { dataLibrary } from './botlib';

// statusPane

/** @param {NS} ns **/
/** @param {import("../index").NS } ns */
export async function main(ns) {
	const { getWorldData } = dataLibrary(ns);
	const worldData = await getWorldData();
	ns.tprint(Object.keys(worldData));
	// const { clear, out, reset } = statusPane(ns);
	// if(command === 'clear'){
	// 	return clear();
	// }
	// if(command === 'reset') {
	// 	return reset();
	// }
	// out({ msg: command })

	// clear();
	
	// out({msg: 'hello world'});

	// const terminalInput = document.getElementById("terminal-input");
	// const { servers } = await getNetworkData(ns);
    // const { args } = ns;
	// await ns.exec('flight.exe', 'home')

	// if(args[0] === 'find'){
	// 	const file = args[1]
	// 	if(!file) return;
	// 	const validServers = Object.values(servers).filter(server => server.hasAdminRights);
	// 	const results = [];
	// 	validServers.forEach(server => {
	// 		if(ns.fileExists(file, server.hostname)){
	// 			results.push(file);
	// 		}
	// 	})
	// 	ns.tprint(results);
	// }

	// if(args[0] === 'server'){
	// 	const name = args[1]
	// 	if(!name) return;
	// 	ns.tprint(JSON.stringify(servers[name], null, 1))
	// }

	// if(args[0] === 'servers'){
	// 	const field = args[1]
	// 	if(!field) return;
	// 	const values = Object.values(servers).map(server => `${server.hostname}: ${server[field]}`)
	// 	ns.tprint(values.join('\n'));
	// }

	// const purchaseCost = hacknetmem(ns,'getPurchaseNodeCost');
	// ns.tprint(ns.peek(1));
	// ns.tprint(ns.getScriptRam('lilhack.js'));
	// ns.tprint(eval('ns.corporation.getCorporation()') // 1tb mem;
	// ns.tprint(ns.stock.getSymbols());
	// const player = ns.getPlayer();
	// ns.tprint(Object.keys(player).map(key => `${key}: ${player[key]}`).join('\n'));
	// botlib.neffPrint()
	// ns.tprint(botlib.maxThreads(2, 236, 32, 8))
		// ns.tprint(nextTargets);

}
