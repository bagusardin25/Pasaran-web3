// Fills a LOCAL chain with sample price reports so the interface has something to show.
// Refuses to run anywhere else: invented prices must never reach a public network.
//
// `npm run node` starts the local clock 45 days in the past. This script lays down nine
// sepasars of reports from that point and finishes at the real time of day, so the charts
// have history and "2 h ago" means two real hours ago.
//
//   npx hardhat run scripts/seed.js --network localhost
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const catalog = require("./catalog");

const DAY = 86_400;
const SEPASAR = 5 * DAY;

// Typical prices, rupiah per unit, in catalogue order.
const BASE = [13_200, 15_400, 18_500, 17_800, 29_000, 37_000, 138_000, 46_000, 52_000, 38_000, 41_000, 12_500];
// Drift per sepasar: chillies climbing, shallots easing.
const DRIFT = [0, 0, 0, 0.003, 0.004, 0, 0, 0.025, 0.03, -0.015, 0, 0];

// Reporter accounts per city. Accounts 0 and 15–19 are left alone for the dev wallets.
const CITIES = [
  { code: 3273, level: 1.0, reporters: [1, 2, 3, 4], markets: ["Pasar Kosambi", "Pasar Kiaracondong", "Pasar Simpang Dago"] },
  { code: 3471, level: 0.96, reporters: [5, 6, 7], markets: ["Pasar Beringharjo", "Pasar Kranggan", ""], skip: [6] },
  { code: 3578, level: 0.98, reporters: [8, 9, 10], markets: ["Pasar Wonokromo", "Pasar Keputran"], skip: [1, 11] },
  { code: 3171, level: 1.06, reporters: [11, 12, 13, 14], markets: ["Pasar Santa", "Pasar Mayestik", ""] },
];
const SPARSE = { code: 7371, reporters: [2, 9], markets: ["Pasar Terong"], items: [0, 4, 7] }; // provisional only
const STALE = { code: 1275, reporters: [6], markets: ["Pasar Petisah"], items: [0, 3, 4, 6] }; // nothing recent

async function main() {
  const { ethers, network } = hre;
  if (network.name !== "localhost" && network.name !== "hardhat") {
    throw new Error(`seed.js only runs on a local chain, not "${network.name}".`);
  }

  const file = path.join(__dirname, "..", "deployments", "localhost.json");
  if (!fs.existsSync(file)) throw new Error("Deploy first: npm run deploy:local");
  const { address } = JSON.parse(fs.readFileSync(file, "utf8"));
  const pasaran = await ethers.getContractAt("Pasaran", address);
  const signers = await ethers.getSigners();

  let seed = 31337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const shuffle = (list) => [...list].sort(() => rand() - 0.5);

  const provider = ethers.provider;
  const realNow = Math.floor(Date.now() / 1000);
  let clock = (await provider.getBlock("latest")).timestamp;
  if (realNow - clock < 40 * DAY) {
    throw new Error("The local clock is not backdated. Restart the node with `npm run node`, then deploy and seed again.");
  }
  const start = clock;

  async function at(timestamp) {
    clock = Math.max(clock + 1, Math.floor(timestamp));
    await provider.send("evm_setNextBlockTimestamp", [clock]);
  }

  const priceFor = (item, level, step) => {
    const base = BASE[item] * level * (1 + DRIFT[item] * step);
    const noisy = base * (0.96 + rand() * 0.08);
    const round = item === 6 ? 500 : 100;
    return Math.round(noisy / round) * round;
  };

  let sent = 0;
  async function send(signerIndex, item, region, price, market) {
    const { min, max } = catalog[item];
    const clamped = Math.min(max, Math.max(min, price));
    await (await pasaran.connect(signers[signerIndex]).report(item, region, clamped, market)).wait();
    sent += 1;
  }

  const STEPS = 9;
  for (let step = 0; step < STEPS; step++) {
    let t = start + step * SEPASAR + 6 * 3600;

    for (const city of CITIES) {
      // Not every reporter turns up every sepasar.
      const today = city.reporters.filter(() => rand() > 0.15);
      for (const who of today) {
        const items = shuffle(catalog.map((_, i) => i).filter((i) => !(city.skip || []).includes(i))).slice(
          0,
          4 + Math.floor(rand() * 4)
        );
        const market = pick(city.markets);
        for (const item of items) {
          t += 60 + rand() * 1_800;
          await at(t);
          await send(who, item, city.code, priceFor(item, city.level, step), market);
        }
        t += 2 * 3600 + rand() * 6 * 3600;
      }
    }

    if (step === 1 || step === 2) {
      for (const item of STALE.items) {
        t += 600;
        await at(t);
        await send(STALE.reporters[0], item, STALE.code, priceFor(item, 1.01, step), STALE.markets[0]);
      }
    }
  }

  // A thin city: two people reported a few items in the last few days.
  let t = realNow - 3 * DAY;
  for (const who of SPARSE.reporters) {
    for (const item of SPARSE.items) {
      t += 1_200;
      await at(t);
      await send(who, item, SPARSE.code, priceFor(item, 1.02, STEPS - 1), SPARSE.markets[0]);
    }
    t += DAY;
  }

  // Bring the local clock back to the real time of day.
  if (clock < realNow) {
    await provider.send("evm_setNextBlockTimestamp", [realNow]);
    await provider.send("evm_mine", []);
  }

  const s = await pasaran.stats();
  console.log(
    `Seeded ${sent} reports: ${s.reports} reports, ${s.reporters} reporters, ${s.regions} regions, ${s.feeds} item-region feeds.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
