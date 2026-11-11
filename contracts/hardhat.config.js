require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

// The deployer key lives only in contracts/.env (see .env.example). It is never committed.
const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

// A local node (`npm run node`) starts its clock 45 days in the past, so the seed script can lay
// down several sepasars of history and finish at the real time of day. Tests are unaffected.
const runningNode = process.argv.includes("node");
const backdated = new Date(Date.now() - 45 * 24 * 3600 * 1000);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // "paris" avoids newer opcodes, so the bytecode runs on any BOT Chain node version.
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: { chainId: 31337, ...(runningNode ? { initialDate: backdated.toISOString() } : {}) },
    // Port 8549 keeps this node apart from the other projects' local chains.
    localhost: { url: "http://127.0.0.1:8549", chainId: 31337 },
    botchainTestnet: { url: "https://rpc.bohr.life", chainId: 968, accounts },
    botchain: { url: "https://rpc.botchain.ai", chainId: 677, accounts },
  },
};
