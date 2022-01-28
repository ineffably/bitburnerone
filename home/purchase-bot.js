import { dataLibrary } from './botlib';

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	const { args } = ns;
	const { getSettings, getPlayerData, logData  } = dataLibrary(ns);
	const reserve = 1000000;
	const runonce = args[0] === 'once';
	const sleepTime = 1000 * 60;
	const { lowestRam } = await getSettings() || 16;
	while(true) {
		const ownedServers = ns.getPurchasedServers();
		const { money } = await getPlayerData();
		const budget = (money - reserve) / 2;
		const ramList = [];
		for(let rc = 3; rc <= 20; rc++) {
			ramList.unshift(Math.pow(2, rc))
		}
		const validRam = ramList.filter(ram => (ram >= lowestRam));
		const priceList = validRam.map(n => ns.getPurchasedServerCost(n));
		const underBudget = priceList.filter(price => price <= budget);
		const budgetRam = validRam.reverse().slice(0, underBudget.length).reverse();

		if(budgetRam.length > 0){
			const cart = { ram: budgetRam[0], price: underBudget[0] }
			const serverShopping = { event: 'serverShopping', money, budget, price: cart.price, ram: cart.ram }
			logData({ event: 'serverShopping', money, budget, price: cart.price, ram: cart.ram })
			ns.purchaseServer(`hamster${ownedServers.length}`, cart.ram);
			logData({ ...serverShopping, ...{ event: 'serverPurchase' } })
		}
		if(runonce){ break }
		await ns.sleep(sleepTime)
	}

}
