import { dataLibrary } from './botlib';
const makeEvent = (id, value) => ({ event: id, ...value });

/** @param {import("../index").NS } ns */
export async function main(ns) {
	ns.disableLog('ALL');
	const { logData } = dataLibrary(ns);
	const sleepTime = 120 * 1000;
	const { hacknet } = ns;

	while (true) {
		const {
			numNodes,
			getPurchaseNodeCost,
			getHashUpgrades,
			getNodeStats,
			getLevelUpgradeCost,
			getRamUpgradeCost,
			maxNumNodes,
			getCoreUpgradeCost,
			purchaseNode,
			upgradeCore,
			upgradeLevel,
			upgradeRam
		} = hacknet;

		const reserve = 0; //1000000;
		const purchaseCount = 1;

		const homeMoney = ns.getServerMoneyAvailable('home') - reserve;
		const initBudget = homeMoney / 2;
		const session = { history: [] }
		const { history } = session;
		const nodeCount = numNodes()
		const getHacknetData = () => ({
			nodeCost: getPurchaseNodeCost(),
			maxNodes: maxNumNodes(),
			nodeCount,
			hashUpgrades: getHashUpgrades(),
			nodes: [nodeCount].map(count => {
				let i = count - 1;
				const results = [];
				while (i >= 0) {
					const nodeStats = getNodeStats(i);
					results.push({
						...nodeStats, ...{
							levelCost: getLevelUpgradeCost(i, purchaseCount),
							ramCost: getRamUpgradeCost(i, purchaseCount),
							coreCost: getCoreUpgradeCost(i, purchaseCount),
							index: i
						}
					})
					i--;
				}
				return results.reverse();
			})[0]
		});

		const purchaseCycle = (budget) => {
			let trackBudget = budget;
			const data = getHacknetData();
			const { nodeCost, nodes } = data;
			history.push(data);
			if (nodeCost < trackBudget) {
				const event = makeEvent('purchaseNode', { nodeCost });
				const purchase = purchaseNode();
				event.purchase = purchase;
				logData(event)
				history.push({ event, purchase, trackBudget });
				return purchaseCycle(trackBudget - nodeCost);
			}

			nodes.forEach(node => {
				const { coreCost, index } = node;

				if (coreCost < trackBudget) {
					const event = makeEvent('upgradeCore', { coreCost, index });
					const coreUpgrade = upgradeCore(index, purchaseCount);
					event.coreUpgrade = coreUpgrade;
					logData(event);
					trackBudget -= coreCost;
					history.push({ event, coreUpgrade, trackBudget });
				}
			})

			// if we did purchase a core, keep purchasing cores if we can...
			if (trackBudget < budget) return purchaseCycle(trackBudget);

			nodes.forEach(node => {
				const { ramCost, index } = node;
				if (ramCost < trackBudget) {
					const event = makeEvent('upgradeRam', { ramCost, index });
					const ramUpgrade = upgradeRam(index, purchaseCount);
					event.ramUpgrade = ramUpgrade
					logData(event);
					trackBudget -= ramCost;
					history.push({ event, ramUpgrade, trackBudget });
				}
			});
			// same with ram
			if (trackBudget < budget) return purchaseCycle(trackBudget);

			nodes.forEach(node => {
				const { levelCost, index } = node;

				if (levelCost < trackBudget) {
					const event = makeEvent('upgradeLevel', { levelCost, index });
					const levelUpgrade = upgradeLevel(index, purchaseCount);
					event.levelUpgrade = levelUpgrade;
					logData(event);
					trackBudget -= levelCost;
					history.push({ event, levelUpgrade, trackBudget });
					return;
				}
			})

			// and repeate with levels
			if (trackBudget < budget) return purchaseCycle(trackBudget);
		}

		purchaseCycle(initBudget);
		await ns.sleep(sleepTime)

	}

}
