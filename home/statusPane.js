import { dataLibrary } from './botlib';

const dateValues = tick => {
	const d = new Date(tick);
	return{
		date: d.getDate(),
		day: d.getDay(),
		fullYear: d.getFullYear(),
		hours: d.getHours(),
		ms: d.getMilliseconds(),
		min: d.getMinutes(),
		month: d.getMonth(),
		seconds: d.getSeconds(),
		time: d.getTime(),
		dateString: d.toDateString(),
		timeString: d.toTimeString()
	}
}

const colors = {
	offwhite: '#E7E7E7',
	limeish: '#A7D447',
	brightgreen: '#71D18B',
	darkgreen: '#6B8240',
	seafoam: '#7BE3D3',
	peach: '#FCC95B',
	slate: '#E66F40',
	darkorange: '#DEC05D',
	rust: '#D69846',
	grayblue: '#7BC0DB',
	lightblue: '#9FCEE0',
	pink: '#F92672',
	lavender: '#AE81FF'
}

const defaultTemplate = (eventData = {}) => {
	if (!eventData) return '';
	const { datetime, event, hostname } = eventData;
	const { day, hours, min, ms, seconds} = dateValues(datetime);
	const common = ['hostname', 'event', 'datetime'];
	const props = Object.keys(eventData).filter(field => !common.includes(field))
	const eventProps = props.reduce((origin, field) => {
		origin += ` ${field}:${eventData[field]} `;
		return origin;
	}, '')
	return `[${hours}.${min}.${seconds}.${ms}] <b>${event}</b>: ${hostname} ${eventProps}`
}

const _eventColorMap = {
	weakAttempt: { color: colors.slate, template: defaultTemplate },
	growAttempt: { color: colors.seafoam, template: defaultTemplate },
	hackAttemtp: { color: colors.limeish, template: defaultTemplate },
	hack: { color: colors.pink, template: defaultTemplate },
	grow: { color: colors.brightgreen, template: defaultTemplate },
	weaken: { color: colors.brightgreen, template: defaultTemplate },
	exec: { color: colors.seafoam, template: defaultTemplate },
	filebotPass: { color: colors.slate, template: defaultTemplate },
	upgradeRam: { color: colors.grayblue, template: defaultTemplate },
	upgradeCore: { color: colors.lightblue, template: defaultTemplate },
	upgradeLevel: { color: colors.grayblue, template: defaultTemplate },
	purchaseNode: { color: colors.lavender, template: defaultTemplate }
}


const getEventTemplate = (entry = {}) => {
	const eventName = entry.event || ''
	const result = _eventColorMap[eventName] || { template: defaultTemplate, color: '#eee' }
	result.value = result.template(entry);
	return result;
};

const reserveSpace = (numSpaces, value) => {
	const str = value + '';
	const delta = numSpaces - str.length;
	const results = [value];
	while (results.length - 1 < delta) {
		results.push('&nbsp;');
	}
	return results.join('');
}

export const el = (tag, props = {}) => {
	const result = document.createElement(tag);
	Object.keys(props).forEach(propKey => {
		result[propKey] = props[propKey];
	})
	return result;
}

const history = [];

/** @param {NS} ns **/
export const statusPane = (ns) => {
	const { args } = ns;
	// instead of creating an interval off window, let's use the sleep functionality to check at intervals
	const adjustPane = () => {
		const root = document.getElementById("root");
		const watchEl = root.children[0].children[1].children[1].children[0];
		const sideDrawer = document.getElementsByClassName('css-fhsif5');
		const isTerminal = watchEl.className === 'MuiBox-root css-sj2rl1';
		const container = document.getElementById('paneContainer');
		if (!isTerminal) {
			container.style.display = 'none'
		}
		else {
			container.style.display = 'flex'
		}
		if (container) {
			container.style.left = '250px'
			container.style.width = '92%'
			if (sideDrawer.length > 0) {
				container.style.left = '57px';
				container.style.width = '98%'
			}
		}
	}

	const getConsoleEl = () => document.getElementById('consolePane');
	const getGraphEl = () => document.getElementById('graphPane');

	const initPane = () => {
		if (document.getElementById('paneContainer')) return;
		const root = document.getElementById("root");
		const parentEl = root.children[0];
		const { container } = makePane();
		parentEl.appendChild(container);
	}

	const clearConsole = () => {
		const consolePane = getConsoleEl();
		consolePane.innerHTML = '';
		history.splice(0, history.length - 1);
	}

	const out = (logObj) => {
		history.push(logObj);
		const consolePane = getConsoleEl();
		const { children } = consolePane;
		const count = children.length;
		const { color, value, template } = getEventTemplate(logObj);
		const div = el('div', {
			style: `display: flex; color: ${color};`,
			innerHTML: `${value}`,
			title: logObj
		});
		if (count > 2500) {
			let i = count;
			while (i-- > 500) {
				children[i].remove();
			}
		}
		consolePane.appendChild(div, children[0]);
		consolePane.scrollTop = consolePane.scrollHeight;
	}

	const clear = () => {
		getConsoleEl().innerHTML = '';
	}

	const reset = () => {
		const paneContainer = document.getElementById('paneContainer');
		if(paneContainer){
			paneContainer.remove();
		}
		initPane();
	}

	return ({
		out,
		clear,
		clearConsole,
		reset,
		initPane,
		adjustPane,
		getGraphEl,
		getConsoleEl
	});
}

const cardClasses = {
	serverCard: 'MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1 MuiGrid-root MuiGrid-item css-5gmet7',
	container: 'MuiBox-root css-5gmet7',
	serverTable: 'MuiTable-root css-1q9zzq4',
	tableBody: 'MuiTableBody-root css-1xnox0e',
	tableRow: 'MuiTableRow-root css-1dix92e',
	tableCell: 'jss43 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeSmall css-94vf19',
	paragraph: 'MuiTypography-root MuiTypography-body1 css-cxl1tz'
}

export const makeEl = () => {};

/*
"cpuCores",
            "ip",
            "isConnectedTo",
            "maxRam",
            "organizationName",
            "ramUsed",
            "network",
            "moneyGap",
            "shouldGrow",
            "shouldWeaken",
            "peekMoney",
            "hackChance",
            "hackThreads",
            "weakenTime",
            "growTime",
            "hackTime"
*/

const portList = {
	ftpPortOpen: 21,
	sshPortOpen: 22,
	smtpPortOpen: 25,
	httpPortOpen: 80,
	sqlPortOpen: 1433
}

export const serversView = async (ns, data = []) => {
	const { fcoin, fpercent, getWorldData } = dataLibrary(ns);
	const { servers, player } = await getWorldData();
	const { hacking } = player;
	const { nFormat } = ns;
	const container = el('div', {
		className: cardClasses.container,
		style: [
			'display: grid',
			'width: 100%',
			'grid-template-columns: repeat(3, 1fr)',
		].join(';')
	})
	const getGlyph = (check, text = '') => {
		return `<span title="${text}" style="background-color:${check ? 'darkgreen' : 'sienna'} ">&nbsp;</span>`
	}
	const cards = data.map(server => {
		const { 
			hostname, 
			moneyAvailable, 
			moneyMax, hasAdminRights, 
			backdoorInstalled, 
			purchasedByPlayer, 
			numOpenPortsRequired,
			baseDifficulty,
			hackDifficulty,
			minDifficulty,
			hackTime,
			serverGrowth,
			requiredHackingSkill
		} = server;
		const scores = servers[hostname]?.scores;
		const hackChance = ns.hackAnalyzeChance(hostname);
		const enoughPorts = Object.keys(portList).filter(field => server[field]).length >= numOpenPortsRequired;
		const percentLeft = moneyAvailable / moneyMax;
		const serverCard = el('div', {
			className: cardClasses.serverCard
		})
		const serverTable = el('table', { 
			style: 'font-family: "lucida console"; border-collapse: collapse;',
			className: cardClasses.serverTable
		});
		const tableBody = el('tbody', {
			style: 'font-family: "lucida console"; border-collapse: collapse;',
			className: cardClasses.tableBody
		});
		const titleRow = el('tr', {className: cardClasses.tableRow});
		titleRow.appendChild(el('td', {
			className: cardClasses.tableCell,
			style: 'border: 0;',
			innerHTML: `<p class="${cardClasses.paragraph}" style="color: #fff" >
							${getGlyph(hasAdminRights, 'hasAdminRights') + getGlyph(backdoorInstalled || purchasedByPlayer, 'backdoorInstalled or purchasedByPlayer')} ${hostname}
						</p>`
		}))
		const getPortColor = key => {
			return server[key] ? '#030' : 'sienna'
		}
		titleRow.appendChild(el('td', {
			className: cardClasses.tableCell,
			style: 'border: 0;text-align: right;',
			innerHTML: `<p class="${cardClasses.paragraph}" style="font-size: 90%;">|${Object.keys(portList).map(key => 
				`<span title="${key}" style="color: #ccc; background-color: ${getPortColor(key)}">${portList[key]}</span>`).join('|')}|
				<span style="color: #ccc; background-color: ${enoughPorts ? 'darkgreen' : 'sienna'}">[${numOpenPortsRequired}]</span></p>`
		}))		
		const row2 = el('tr', {className: cardClasses.tableRow})
		row2.appendChild(el('td', {
			className: cardClasses.tableCell,
			innerHTML: `<p class="${cardClasses.paragraph}">Money:</p>`, 
			style: 'border: 0;'
		}))
		row2.appendChild(el('td', {
			className: cardClasses.tableCell,
			style: 'border: 0;text-align: right;',
			colspan: 2, 
			innerHTML: `<p class="${cardClasses.paragraph}">${fcoin(moneyAvailable)} / ${fcoin(moneyMax)} | ${fpercent(percentLeft)} | ^${serverGrowth} </p>`}
		))
		const row3 = el('tr', {className: cardClasses.tableRow})
		row3.appendChild(el('td', {
			className: cardClasses.tableCell,
			innerHTML: `<p class="${cardClasses.paragraph}">Hackstats:</p>`, 
			style: 'border: 0;'
		}))
		const hackValue = (n, format = '0.00', title = '') => {
			return `<span title="${title}">${nFormat(n, format)}</span>`
		}
		row3.appendChild(el('td', {
			className: cardClasses.tableCell,
			style: 'border: 0;text-align: right;',
			colspan: 2, 
			innerHTML: `<p class="${cardClasses.paragraph}">(${hacking}/${requiredHackingSkill})|${hackValue(baseDifficulty, '0', 'baseDifficulty')}|${hackValue(minDifficulty, '0', 'minDifficulty')}|${hackValue(hackDifficulty, '0.00', 'hackDifficulty')} (${fpercent(hackChance)})</p>`}
		))
		const row4 = el('tr', {className: cardClasses.tableRow})
		row4.appendChild(el('td', {
			className: cardClasses.tableCell,
			innerHTML: `<p class="${cardClasses.paragraph}">${JSON.stringify(scores)}</p>`, 
			style: 'border: 0;'
		}))

		tableBody.appendChild(titleRow);
		tableBody.appendChild(row2);
		tableBody.appendChild(row3);
		tableBody.appendChild(row4);
		serverTable.appendChild(tableBody);
		serverCard.appendChild(serverTable);
		return serverCard;
	})
	cards.forEach(card => {
		container.appendChild(card);
	})
	
	return container;
}


export const makeTable = (data = [], props = {}) => {
	const tableEl = el('table', props);
	const tableBody = el('tbody');
	const tableHead = el('thead');
	const fields = Object.keys(data[0]).reduce((origin, entry) => {
		origin[entry] = entry;
		return origin;
	}, {});
	tableEl.appendChild(tableHead);
	tableEl.appendChild(tableBody);
	// const fieldnames = Object.keys(data[0]);
	const rows = [fields].concat(data).map(entry => {
		const cellKeys = Object.keys(entry);
		const tr = el('tr');
		cellKeys.forEach(key => {
			const value = entry[key];
			tr.appendChild(el('td', {
				innerHTML: `${value}`.substr(0, 24),
				title: value,
				style: 'white-space: nowrap'
			}))
		})
		return tr;
	})
	rows.forEach(row => tableBody.appendChild(row));
	return tableEl;
}

function makePane() {
	const left = 250;
	const width = 93;
	const state = {
		activePane: 0
	}
	const consoleStyles = [
		'display: flex',
		'flex-direction: column',
		'overflow-y: scroll',
		'font-family: "lucida console"'
	].join(';')
	const tabStyles = [
		'display: flex'
	].join(';')
	const containerStyles = [
		'display: flex',
		'flex-direction: column',
		'position: fixed',
		`left: ${left}px`,
		'top: 0px',
		`width: ${width}%`,
		'height: 300px',
		'color: white',
		'background-color: black',
		'padding: 4px',
	].join(';')
	const container = el('div', {
		id: 'paneContainer',
		className: 'css-1md5x9v',
		style: containerStyles
	});
	const graphStyles = [
		'display: none',
		'width: 100%',
		'overflow-y: scroll',
		'font-family: "lucida console"'
	].join(';')
	const graphElement = el('div', {
		id: 'graphPane',
		display: 'none',
		style: graphStyles
	});
	const consoleElement = el('div', {
		id: 'consolePane',
		style: consoleStyles
	});
	const tabs = el('div', { style: tabStyles });
	const buttonStyles = [
		'background-color: #111',
		'color: #ccc',
		'padding: 2px 6px',
		'font-size: 110%'
	].join(';');
	const consoleButton = el('button', {
		innerHTML: 'console',
		style: buttonStyles,
		onclick: ev => {
			state.activePane = 0;
			consoleElement.style.display = 'flex'
			graphElement.style.display = 'none'
			consoleButton.style.color = 'white';
			graphsButton.style.color = '#aaa';
		}
	});
	const graphsButton = el('button', {
		innerHTML: 'servers',
		style: buttonStyles,
		onclick: ev => {
			state.activePane = 1;
			consoleElement.style.display = 'none'
			graphElement.style.display = 'flex'
			consoleButton.style.color = '#aaa';
			graphsButton.style.color = 'white';
		}
	});
	const expandButton = el('button', {
		innerHTML: '^^^^^^',
		onClick: ev => {
			const el = document.getElementById('paneContainer');
			
		}
	})
	tabs.appendChild(consoleButton);
	tabs.appendChild(graphsButton);
	container.appendChild(tabs);

	container.appendChild(graphElement);
	container.appendChild(consoleElement)
	return {
		container,
		consoleElement
	};
}

/*
css-1qq0yg:
    display: grid;
    width: fit-content;
    grid-template-columns: repeat(3, 1fr);
*/
