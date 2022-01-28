const state = {
	money: 0,
	lastWrite: 0,
	initTick: 0,
	initMoney: 0
};

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');

	const calcCoinPerSecond = (money, lastWriteTick, lastMoney) => {
		const { initTick, initMoney } = state;
		const delta = Date.now() - initTick;
		const gain = money - initMoney;
		const seconds = delta / 1000;
		return gain / seconds;
	}

	const { args } = ns;
	const seconds = args[0] || 30;
	state.initTick = Date.now();
	while (true) {
		const playerData = ns.getPlayer();
		if(state.initMoney === 0){
			state.initMoney = playerData.money;
		}
		const coinpersec = calcCoinPerSecond(playerData.money, state.lastWrite, state.money);
		playerData.coinpersec = coinpersec;
		ns.clearLog();
		const json = JSON.stringify(playerData);
		ns.print(json);
		await ns.write('player.json.txt', json, 'w');
		state.money = playerData.money;
		state.lastWrite = Date.now();
		await ns.sleep(1000 * seconds) // use settings chad!
	}
}
