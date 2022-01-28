export const LOGLEVEL = {
	0: '',
	1: 'INFO',
	2: 'WARN',
	3: 'ERROR'
}

export const LOGTYPE = {
	process: 'process', // start/stop/running mundane
	info: 'info',
	notable: 'notable',
	error: 'error',
	excite: 'excite',
	wtf: 'wtf',
	event: 'event'
}

const config = {
	data: {
		targets: {
			script: 'targets-data.js',
			host: 'home'
		},
		settings: {
			script: 'settings-data.js',
			host: 'home'
		},
		stock: {
			script: 'stock-data.js',
			host: 'home'
		},
		world: {
			script: 'world-data.js',
			host: 'home'
		}
	}
}

export const getConfig = () => config;

export const getRandomInt = (max) => Math.floor(Math.random() * max)

export const roundTo = (places, value) => {
	return Math.round(value * Math.pow(10, places)) / Math.pow(10, places);
}

export const maxThreads = (scriptRam = 1, max, used, buffer = 0) => {
	const free = max - used - buffer;
	return Math.max(1, Math.floor(free / scriptRam));
}

export const localState = {
	settings: {
		loglevl: 1,
		showDataLogs: true
	}
}

export const formats = fieldType => {
	const num = '0.000';
	const formattings = {
		coin: '$0.00a',
		num,
		percent: '0.00%',
	}
	return formattings[fieldType] || num;
}

const JSONSafeParse = (jsonString) => {
	let results = null;
	if (typeof jsonString !== 'string') return {
		error: 'SafeParse expects a string'
	};
	try {
		results = JSON.parse(jsonString);
	} catch (error) {
		results = { jsonParseError: true, error: error };
	}
	return results;
}

/** @param {import("../index").NS } ns */
export const dataLibrary = ns => {

	const getSettings = async (field) => {
		const settings = await ns.read('_settings.json');
		const json = JSONSafeParse(settings);
		localState.settings = json;
		return field ? json[field] : json;
	}

	const updateSettings = (settings = {}) => {
		localState.settings = settings;
	}

	const getDataLog = (botname, host) => {
		const data = ns.getScriptLogs(botname, host);
		if (data) {
			return data[data.length - 1];
		}
		else {
			log(`${host}.${botname} may not be running`, LOGTYPE.process);
		}
		return null;
	}

	const getDataFor = async (dataType) => {
		if (!Object.keys(config.data).includes(dataType)) {
			return { error: 'invalid datatype' };
		}
		const { script, host } = config.data[dataType];
		const logData = getDataLog(script, host);
		if (logData) {
			return JSONSafeParse(logData, 'logData ' + dataType);
		}
		try {
			const cacheFile = await ns.read(`_${dataType}.json`);
			return JSONSafeParse(cacheFile, 'cacheFile');
		}
		catch (e) {
			log(`cachefileFailed: ${dataType}`, LOGTYPE.wtf);
		}
		return {}
	}

	const getNetworkData = async () => { 
		const { server, network } = await getDataFor('world');
		return { server, network };
	};
	const getPlayerData = async () => await getDataFor('world').player
	const getWorldData = async () => await getDataFor('world');
	const getSettingsData = async () => await getDataFor('settings');
	const getStockData = async () => await getDataFor('stock');

	const logData = (data = {}) => {
		if (typeof data === 'object') {
			data.datetime = Date.now();
			ns.print(JSON.stringify(data));
			if(localState.settings.showDataLogs){
				log(Object.keys(data).map(key => `${key}: ${data[key]} `).join('|'), LOGTYPE.info);
			}
		}
	}

	const log = (msg, logtype) => {
		let loglevel = 0; 
		const levels = [
			'ALL',
			['error', 'wtf', 'notable', 'excite']
		]

		const prefixMap = {
			process: 1,
			info: 1,
			notable: 2,
			error: 3,
			excite: 2,
			wtf: 3
		}
		const decoration = {
			process: ['--== ', ' ==--'],
			info: ['-[o] ', ' [o]-'],
			notable: ['[!== ', ' ==!]'],
			error: ['-!!! ', ' !!!-'],
			excite: ['~\\o/ ', ' \\o/~'],
			wtf: ['WTF! ', ' !FTW'],
		}
		const prefix = LOGLEVEL[prefixMap[logtype]];
		const ends = decoration[logtype] || ['', ''];
		const logmsg = `${prefix} ${ends[0]}${msg}${ends[1]}`;

		if (loglevel < 99) {
			if ((levels[loglevel] === 'ALL' || levels[loglevel]?.includes(logtype))) {
				ns.tprint(logmsg);
			}
		}
	}

	const fcoin = (n = 0) => ns.nFormat(n, '$0.000a');
	const fnum = (n = 0) => ns.nFormat(n, '0.00');
	const fpercent = (n = 0) => ns.nFormat(n, '0.00%');

	return {
		log,
		logData,
		fcoin,
		fnum,
		fpercent,
		getNetworkData,
		getPlayerData,
		getSettingsData,
		getStockData,
		getDataFor,
		getDataLog,
		JSONSafeParse,
		getSettings,
		updateSettings,
		getWorldData,
		LOGTYPE
	}

}
