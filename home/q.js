import { dataLibrary, quickTable, padRight } from './botlib';

// q servers [field][op][criteria] fieldnames,,
// q servers fields              // all field names
// q servers fields fieldnames,, // specific fields
// q servers hostname
// q servers hostname field
// q servers
// q player
// q player field
// q settings
// q settings fields
// q targets [field][op][criteria] fieldnames,,
// q targets "fields"
// q targets hostname
// q targets hostname field

const pr = padRight;
const dbnames = ['servers', 'player', 'settings', 'targets', 'stocks', 'network'];
const usage = [
  'q servers [field][op][criteria] fieldnames,',
  'q servers "showfields"',
  'q servers hostname',
  'q servers hostname field',
  'q player',
  'q player field',
];
const opTable = {
  eq: ' == ',
  ne: ' != ',
  ge: ' >= ',
  le: ' <= ',
  gt: ' > ',
  lt: ' < ',
  mod: ' % ',
};

const filter2Common = ['showfields', 'fields', '[field][op][criteria]'];

export function autocomplete(data, args) {
  const database = args[0];
  const filter1 = args[1];
  if (filter1) {
    return [...filter2Common, ...(getFields(database) || [])];
  }
  if (database) return dbnames;
}

const stringify = (obj) => JSON.stringify(obj, null, 2);

/** @param {import("../index").NS } ns */
export async function main(ns) {
  const { getWorldData } = dataLibrary(ns);
  const { args } = ns;
  const [db, filter1, filter2] = args;
  const isQuery = filter1 && filter1.startsWith('[');

  if (!db && !filter1 && !filter2) {
    return ns.tprint('\n' + usage.join('\n'));
  }
  if (!dbnames.includes(db)) {
    return ns.tprint(`there is no "${db}" database`);
  }

  const allData = await getWorldData();
  const { player, servers, targets, network } = allData;
  if (isQuery) {
    return queryDb(ns, Object.values(allData[db]), filter1, filter2);
  }

  if (db === 'targets') {
    const onlyShow = ['hostname', 'serverGrowth', 'moneyAvailable', 'moneyMax', 'hackDifficulty', 'hackChance', 'percentLeft', 'weakenTime', 'hackTime'];
    const { grow, weaken, hack } = targets;
    if (grow.length > 0) {
      const growfields = Object.keys(grow[0]).filter(field => onlyShow.includes(field));
      ns.tprint('\nGrow:\n' + quickTable(grow, growfields).join('\n'));
    }
    if (weaken.length > 0) {
      const weakenFields = Object.keys(weaken[0]).filter(field => onlyShow.includes(field));
      ns.tprint('\nWeaken:\n' + quickTable(weaken, weakenFields).join('\n'));
    }
    if (hack.length > 0) {
      const hackFields = Object.keys(hack[0]).filter(field => onlyShow.includes(field));
      ns.tprint('\nHack:\n' + quickTable(hack, hackFields).join('\n'));

    }
    return;
  }

  const showServerTable = (serverResults, hideFields = ['files']) => {
    const rowTemplate = ([field, value], [maxField, maxValue]) =>
      (`| ${pr(field, maxField)} | ${pr(value, maxValue)} |`);
      const table = serverResults.map(server => {
        const fields = Object.keys(server).filter(field => !hideFields.includes(field));
        const maxField = fields.reduce((o, e) => Math.max(e.length, o), 0);
        const maxValue = fields.reduce((o, e) => Math.max((server[e] + '').length, o), 0);
        return `[ ${server.hostname} ]\n` + fields.map(key => {
          return rowTemplate([key, server[key]], [maxField, maxValue])
        }).join('\n')
      });
      ns.tprint([`\n`, table.join('')].join(''))
  }

  if (db === 'servers') {
    if (filter1) {
      const serverResults = Object.values(servers).filter(server => server.hostname === filter1);
      showServerTable(serverResults);
      return;
    }
    return ns.tprint('\n' + quickTable(Object.values(servers), 'hostname').join('\n'));
  }

  if (db === 'stocks') {
    return ns.tprint('\n' + quickTable(Object.values(servers), 'hostname').join('\n'));
  }

  if (db === 'network') {
    const getNet = (hostname, lan, depth = 0, parent) => {
      let net = `${pr('', depth, '.')}${hostname}\n`
      net += Object.keys(lan).filter(
        f => f !== parent).map(
          key => getNet(
            key, lan[key], depth + 1, hostname)).join('')
      return net;
    }
    return ns.tprint('\n' + getNet('home', network));
  }


  if (filter1) {
    const data = allData[db];
    const dbData = db === 'player' ? [data] : Object.values(data);
    const fields = filter1.split(',');
    const output = dbData.reduce((origin, entry) => {
      const { hostname } = entry;
      if (hostname) {
        const outputEntry = origin[hostname] || {};
        fields.forEach(field => (outputEntry[field] = entry[field]));
        origin[hostname] = outputEntry;
      } else {
        fields.forEach(field => (origin[field] = entry[field]));
      }
      return origin;
    }, {});
    return ns.tprint(stringify(output));
  }

  if (db === 'player') {
    return ns.tprint(stringify(player));
  }

}

function queryDb(ns, dataList, filter1) {
  const partNames = ['field', 'op', 'value'];
  const userFilter = filter1.split(']').slice(0, 3);

  const criterion = userFilter.reduce((origin, entry, i) => {
    const part = i % 3;
    if ((part === 0 || part === 1) && !partNames[part]) {
      return;
    }
    origin[partNames[part]] = entry.substr(1);
    return origin;
  }, {});

  const getResults = () => {
    const { field, op, value = '' } = criterion;
    const operator = opTable[op];
    if (!operator) return;
    const results = dataList.filter((entry) => {
      const fieldData = entry[field];
      if (op === 'eq') return fieldData == value;
      if (op === 'gt') return fieldData > value;
      if (op === 'lt') return fieldData < value;
      if (op === 'le') return fieldData <= value;
      if (op === 'gt') return fieldData > value;
      if (op === 'ge') return fieldData >= value;
      if (op === 'mod') return fieldData % value;
    });
    return results;
  };
  const results = getResults();

  return results;
}


function getFields(dbname) {
  const fieldData = {
    servers: [
      'cpuCores',
      'ftpPortOpen',
      'hasAdminRights',
      'hostname',
      'httpPortOpen',
      'ip',
      'isConnectedTo',
      'maxRam',
      'organizationName',
      'ramUsed',
      'smtpPortOpen',
      'sqlPortOpen',
      'sshPortOpen',
      'purchasedByPlayer',
      'backdoorInstalled',
      'baseDifficulty',
      'hackDifficulty',
      'minDifficulty',
      'moneyAvailable',
      'moneyMax',
      'numOpenPortsRequired',
      'openPortCount',
      'requiredHackingSkill',
      'serverGrowth',
      'network',
    ],
    player: [
      'hacking',
      'hp',
      'max_hp',
      'strength',
      'defense',
      'dexterity',
      'agility',
      'charisma',
      'intelligence',
      'hacking_chance_mult',
      'hacking_speed_mult',
      'hacking_money_mult',
      'hacking_grow_mult',
      'hacking_exp',
      'strength_exp',
      'defense_exp',
      'dexterity_exp',
      'agility_exp',
      'charisma_exp',
      'hacking_mult',
      'strength_mult',
      'defense_mult',
      'dexterity_mult',
      'agility_mult',
      'charisma_mult',
      'hacking_exp_mult',
      'strength_exp_mult',
      'defense_exp_mult',
      'dexterity_exp_mult',
      'agility_exp_mult',
      'charisma_exp_mult',
      'company_rep_mult',
      'faction_rep_mult',
      'numPeopleKilled',
      'money',
      'city',
      'location',
      'companyName',
      'crime_money_mult',
      'crime_success_mult',
      'isWorking',
      'workType',
      'currentWorkFactionName',
      'currentWorkFactionDescription',
      'workHackExpGainRate',
      'workStrExpGainRate',
      'workDefExpGainRate',
      'workDexExpGainRate',
      'workAgiExpGainRate',
      'workChaExpGainRate',
      'workRepGainRate',
      'workMoneyGainRate',
      'workMoneyLossRate',
      'workHackExpGained',
      'workStrExpGained',
      'workDefExpGained',
      'workDexExpGained',
      'workAgiExpGained',
      'workChaExpGained',
      'workRepGained',
      'workMoneyGained',
      'createProgramName',
      'createProgramReqLvl',
      'className',
      'crimeType',
      'work_money_mult',
      'hacknet_node_money_mult',
      'hacknet_node_purchase_cost_mult',
      'hacknet_node_ram_cost_mult',
      'hacknet_node_core_cost_mult',
      'hacknet_node_level_cost_mult',
      'hasWseAccount',
      'hasTixApiAccess',
      'has4SData',
      'has4SDataTixApi',
      'bladeburner_max_stamina_mult',
      'bladeburner_stamina_gain_mult',
      'bladeburner_analysis_mult',
      'bladeburner_success_chance_mult',
      'bitNodeN',
      'totalPlaytime',
      'playtimeSinceLastAug',
      'playtimeSinceLastBitnode',
      'jobs',
      'factions',
      'tor',
      'hasCorporation',
    ],
    targets: [
      'cpuCores',
      'ftpPortOpen',
      'hasAdminRights',
      'hostname',
      'httpPortOpen',
      'ip',
      'isConnectedTo',
      'maxRam',
      'organizationName',
      'ramUsed',
      'smtpPortOpen',
      'sqlPortOpen',
      'sshPortOpen',
      'purchasedByPlayer',
      'backdoorInstalled',
      'baseDifficulty',
      'hackDifficulty',
      'minDifficulty',
      'moneyAvailable',
      'moneyMax',
      'numOpenPortsRequired',
      'openPortCount',
      'requiredHackingSkill',
      'serverGrowth',
      'network',
      'moneyGap',
      'shouldGrow',
      'shouldWeaken',
      'peekMoney',
      'hackChance',
      'hackThreads',
      'weakenTime',
      'growTime',
      'hackTime',
    ],
  };
  return fieldData[dbname];
}


