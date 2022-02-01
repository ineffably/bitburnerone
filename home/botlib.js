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

export const quickTable = (objRecords = [], showFields = [], colwidth = 11, custom) => {
	if(objRecords.length <= 0) return ['No Records Found'];
  const render = custom || ((val) => val);
  const fields = Object.keys(objRecords[0]).filter(f => showFields.includes(f));
  const sep = fields.reduce((o, e) => { o[e] = '-------------'; return o; }, {});
  const header = fields.reduce((o, e) => { o[e] = e; return o; }, {});
  const records = [header, sep]
    .concat(objRecords)
    .map((obj) => fields.map((field) => `${obj[field]}`));
  return records.map((row) =>
    row.map((cellValue, i) =>
      padRight(render(cellValue, Object.keys(header)[i]).substring(0, colwidth), colwidth, ' ')
    ).join('| ')
  );
}

export const padRight = (value, len, padWith) => {
  let result = value;
  while (result.length < len) {
    result += padWith;
  }
  return result;
}

export const sortByField = (objArray, field, treatment = n => n) => {
  return objArray.sort((a, b) =>
    (treatment(a[field]) < treatment(b[field])) ? -1 : (treatment(a[field]) > treatment(b[field])) ? 1 : 0
  );
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

export const instancesWithMaxThreads = (scriptRam = 1, max, used, buffer, maxThreads = 10) => {
	const free = max - used - buffer;
	const ramPerScript = scriptRam * maxThreads;
	const instances = Math.max(1, Math.floor(free / ramPerScript));
	const ramLeft = free - (ramPerScript * instances)
	// free - threads * scriptRam
	return { 
		instances, 
		ramLeft
	};
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

export const JSONSafeParse = (jsonString) => {
	let results = null;
	if (typeof jsonString !== 'string') return {
		error: 'SafeParse expects a string'
	};
	try {
		results = JSON.parse(jsonString);
	} catch (error) {
		results = { jsonParseError: true, error: JSON.stringify(error) };
	}
	return results;
}

/** @param {import("../index").NS } ns */
export const dataLibrary = ns => {

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
			return JSONSafeParse(logData);
		}
		try {
			return JSONSafeParse(await ns.read(`_${dataType}.json`));
		}
		catch (e) {
			log(`cachefileFailed: ${dataType}`, LOGTYPE.wtf);
		}
		return {}
	}

	const getWorldData = async () => await getDataFor('world');
	const getStockData = async () => await getDataFor('stock');
	const getSettingsData = async () => await getDataFor('settings');

	const logData = (data = {}) => {
		if (typeof data === 'object') {
			data.datetime = Date.now();
			ns.print(JSON.stringify(data));
			if(localState.settings.showDataLogs){
				const noShow = ['hackAttempt','weakAttempt','growAttempt', 'grow', 'weaken']
				if(data.event && noShow.includes(data.event)){return}
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
		getStockData,
		getSettingsData,
		getDataFor,
		getDataLog,
		JSONSafeParse,
		getWorldData,
		LOGTYPE
	}

}
