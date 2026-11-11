// Deploys Pasaran, adds the starting catalogue, and records the address where the web app reads it.
//
//   npx hardhat run scripts/deploy.js --network localhost
//   npx hardhat run scripts/deploy.js --network botchainTestnet
//   npx hardhat run scripts/deploy.js --network botchain
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const catalog = require("./catalog");

// hardhat network name -> key used by web/src/config/deployments.json
const WEB_KEY = { localhost: "local", hardhat: "local", botchainTestnet: "testnet", botchain: "mainnet" };
const EXPLORER = { botchainTestnet: "https://scan.bohr.life", botchain: "https://scan.botchain.ai" };

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account. Copy .env.example to .env and set PRIVATE_KEY.");
  }

  const { chainId } = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network   ${network.name} (chain ${chainId})`);
  console.log(`Deployer  ${deployer.address}`);
  console.log(`Balance   ${ethers.formatEther(balance)} BOT`);

  const Pasaran = await ethers.getContractFactory("Pasaran");
  const pasaran = await Pasaran.deploy();
  const receipt = await pasaran.deploymentTransaction().wait();
  const address = await pasaran.getAddress();
  console.log(`Pasaran   ${address}`);
  console.log(`Tx        ${receipt.hash}`);
  console.log(`Gas used  ${receipt.gasUsed}`);

  let catalogGas = 0n;
  for (const item of catalog) {
    const tx = await pasaran.addCommodity(item.name, item.unit, item.min, item.max);
    catalogGas += (await tx.wait()).gasUsed;
  }
  console.log(`Catalogue ${catalog.length} items, ${catalogGas} gas`);
  if (EXPLORER[network.name]) console.log(`Explorer  ${EXPLORER[network.name]}/address/${address}`);

  const record = {
    network: network.name,
    chainId: Number(chainId),
    address,
    deployer: deployer.address,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
    catalogue: catalog.map((item, id) => ({ id, ...item })),
  };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(record, null, 2) + "\n");

  const webKey = WEB_KEY[network.name];
  const webFile = path.join(__dirname, "..", "..", "web", "src", "config", "deployments.json");
  if (webKey && fs.existsSync(webFile)) {
    const deployments = JSON.parse(fs.readFileSync(webFile, "utf8"));
    deployments[webKey] = address;
    fs.writeFileSync(webFile, JSON.stringify(deployments, null, 2) + "\n");
    console.log(`Updated   web/src/config/deployments.json (${webKey})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
