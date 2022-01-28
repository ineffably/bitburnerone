/* eslint-disable no-empty */
import { dataLibrary } from './botlib';

/** @param {import("../index").NS } ns */
export async function main(ns) {
  const { args } = ns;
  const { getNetworkData, logData } = dataLibrary(ns);
  const runonce = args[0] === 'once';
  const config = {
    sleeptime: 1000 * 90
  }
  while (true) {
    const { servers = [] } = await getNetworkData();
    const serverList = Object.values(servers).filter(server => !server.hasAdminRights);
    logData({ event: 'rootBotPass', candidates: serverList.length })
    serverList.forEach(server => {
      const {
        hostname,
        numOpenPortsRequired,
        openPortCount,
        ftpPortOpen,
        httpPortOpen,
        smtpPortOpen,
        sqlPortOpen,
        sshPortOpen
      } = server;
      if (openPortCount >= numOpenPortsRequired) {
        try {
          logData({event: 'nukeAttempt', hostname });
          const nukeResults = ns.nuke(hostname);
          logData({event: 'nukeResult', hostname, nukeResults });
        }
        catch (error) {
          logData({event: 'nukeFail', error });
        }
      }
      else {
        if (!sshPortOpen) {
          try {
            if(ns.brutessh(hostname)){
              logData({ event: 'brutessh', hostname })
            }
          } catch (error) {}
        }
        if (!ftpPortOpen) {
          try {
            if(ns.ftpcrack(hostname)) {
              logData({ event: 'ftpcrack', hostname })
            }
          } catch (error) { }
        }
        if (!smtpPortOpen) {
          try {
            if(ns.relaysmtp(hostname)) {
              logData({ event: 'relaysmtp', hostname })
            }
          } catch (error) { }
        }
        if (!httpPortOpen) {
          try {
            if(ns.httpworm(hostname)) {
              logData({ event: 'httpworm', hostname })
            }
          } catch (error) { }
        }
        if (!sqlPortOpen) {
          try {
            if(ns.sqlinject(hostname)) {
              logData({ event: 'sqlinject', hostname })
            }
          } catch (error) { }
        }
      }
    })
    if(runonce){ 
      break;
    }
    await ns.sleep(config.sleeptime);
  }

}
