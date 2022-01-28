/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	while(true){
        const servers = {};
        const getNetwork = (host = 'home') => {
            if(servers[host]) return {};
            const network = ns.scan(host);
            const localServer = ns.getServer(host);
            localServer.network = network;
            servers[host] = localServer;
            return network.reduce((results, hostname) => {
                results[hostname] = getNetwork(hostname);
                return results;
            }, {})
        };
        const data = {
            network: getNetwork(),
            servers
        }
        ns.clearLog();
        ns.print(JSON.stringify(data));
        // ns.write('network.json.txt', JSON.stringify(data, null, 2));
		await ns.sleep(1000 * 10);
	}
}
