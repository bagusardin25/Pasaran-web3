const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const catalog = require("../scripts/catalog");

const DAY = 24 * 3600;
const HOUR = 3600;
const WINDOW = 14 * DAY;
const COOLDOWN = 20 * HOUR;
const SEPASAR = 5 * DAY;

const RICE = 0; // Beras medium, 5,000–40,000 per kg
const EGGS = 4; // Telur ayam ras
const BANDUNG = 3273;
const SURABAYA = 3578;

async function deploy() {
  const signers = await ethers.getSigners();
  const [owner] = signers;
  const Pasaran = await ethers.getContractFactory("Pasaran");
  const pasaran = await Pasaran.deploy();
  await pasaran.waitForDeployment();
  for (const item of catalog) {
    await pasaran.addCommodity(item.name, item.unit, item.min, item.max);
  }
  // Reporters: every account but the owner.
  return { pasaran, owner, reporters: signers.slice(1), signers };
}

/** Median the way the contract defines it: even counts average the middle two, rounding down. */
function median(values) {
  const v = [...values].sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.floor((v[mid - 1] + v[mid]) / 2);
}

/** Move to the start of the next sepasar, plus `offset` seconds. */
async function toNextSepasar(offset = HOUR) {
  const now = await time.latest();
  await time.increaseTo((Math.floor(now / SEPASAR) + 1) * SEPASAR + offset);
}

describe("Pasaran", function () {
  describe("catalogue", function () {
    it("lists the starting items in order", async function () {
      const { pasaran } = await loadFixture(deploy);
      const items = await pasaran.getCommodities();
      expect(items).to.have.lengthOf(catalog.length);
      expect(items[RICE].name).to.equal("Beras medium");
      expect(items[RICE].unit).to.equal("kg");
      expect(items[RICE].minPrice).to.equal(5_000);
      expect(items[RICE].maxPrice).to.equal(40_000);
      expect(items[RICE].active).to.equal(true);
    });

    it("lets only the owner add items, move ranges and switch items off", async function () {
      const { pasaran, owner, reporters } = await loadFixture(deploy);
      const [ayu] = reporters;

      await expect(pasaran.connect(ayu).addCommodity("Kedelai", "kg", 5_000, 50_000)).to.be.revertedWithCustomError(
        pasaran,
        "NotOwner"
      );
      await expect(pasaran.connect(owner).addCommodity("Kedelai", "kg", 5_000, 50_000))
        .to.emit(pasaran, "CommodityAdded")
        .withArgs(catalog.length, "Kedelai", "kg", 5_000, 50_000);

      await expect(pasaran.connect(ayu).setBounds(RICE, 6_000, 45_000)).to.be.revertedWithCustomError(pasaran, "NotOwner");
      await expect(pasaran.connect(owner).setBounds(RICE, 6_000, 45_000))
        .to.emit(pasaran, "BoundsChanged")
        .withArgs(RICE, 6_000, 45_000);
      expect((await pasaran.getCommodities())[RICE].minPrice).to.equal(6_000);

      await expect(pasaran.connect(ayu).setCommodityActive(RICE, false)).to.be.revertedWithCustomError(pasaran, "NotOwner");
      await expect(pasaran.connect(owner).setCommodityActive(RICE, false))
        .to.emit(pasaran, "CommodityActiveSet")
        .withArgs(RICE, false);
    });

    it("rejects bad ranges and names", async function () {
      const { pasaran } = await loadFixture(deploy);
      await expect(pasaran.addCommodity("Kedelai", "kg", 0, 10)).to.be.revertedWithCustomError(pasaran, "InvalidBounds");
      await expect(pasaran.addCommodity("Kedelai", "kg", 10, 10)).to.be.revertedWithCustomError(pasaran, "InvalidBounds");
      await expect(pasaran.addCommodity("", "kg", 1, 10)).to.be.revertedWithCustomError(pasaran, "InvalidName");
      await expect(pasaran.addCommodity("x".repeat(41), "kg", 1, 10)).to.be.revertedWithCustomError(pasaran, "InvalidName");
      await expect(pasaran.addCommodity("Kedelai", "", 1, 10)).to.be.revertedWithCustomError(pasaran, "InvalidName");
      await expect(pasaran.setBounds(99, 1, 10)).to.be.revertedWithCustomError(pasaran, "UnknownCommodity");
      await expect(pasaran.setBounds(RICE, 50, 10)).to.be.revertedWithCustomError(pasaran, "InvalidBounds");
    });
  });

  describe("regions", function () {
    it("accepts regency and city codes in known provinces", async function () {
      const { pasaran } = await loadFixture(deploy);
      for (const code of [1101, 1171, 3171, 3273, 3578, 5171, 6571, 7371, 9171, 9671]) {
        expect(await pasaran.isValidRegion(code), String(code)).to.equal(true);
      }
    });

    it("rejects codes outside the scheme", async function () {
      const { pasaran } = await loadFixture(deploy);
      // province 00, 10, 20, 37, 99; local part 00; nonsense
      for (const code of [0, 99, 1000, 1100, 2001, 3200, 3700, 9901, 65535]) {
        expect(await pasaran.isValidRegion(code), String(code)).to.equal(false);
      }
    });
  });

  describe("report", function () {
    it("records a report and gives a provisional price", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu] = reporters;

      await expect(pasaran.connect(ayu).report(RICE, BANDUNG, 13_500, "Pasar Kosambi"))
        .to.emit(pasaran, "PriceReported")
        .withArgs(0, RICE, BANDUNG, ayu.address, 13_500);

      const [price, count, updatedAt, confirmed] = await pasaran.priceOf(RICE, BANDUNG);
      expect(price).to.equal(13_500);
      expect(count).to.equal(1);
      expect(updatedAt).to.equal(await time.latest());
      expect(confirmed).to.equal(false);

      const [page] = await pasaran.getReports(RICE, BANDUNG, 0, 10);
      expect(page).to.have.lengthOf(1);
      expect(page[0].market).to.equal("Pasar Kosambi");
      expect(page[0].counted).to.equal(true);
    });

    it("rejects an unknown or switched-off item", async function () {
      const { pasaran, owner, reporters } = await loadFixture(deploy);
      const [ayu] = reporters;
      await expect(pasaran.connect(ayu).report(99, BANDUNG, 13_500, "")).to.be.revertedWithCustomError(
        pasaran,
        "UnknownCommodity"
      );
      await pasaran.connect(owner).setCommodityActive(RICE, false);
      await expect(pasaran.connect(ayu).report(RICE, BANDUNG, 13_500, "")).to.be.revertedWithCustomError(
        pasaran,
        "CommodityInactive"
      );
    });

    it("rejects an invalid region", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      await expect(pasaran.connect(reporters[0]).report(RICE, 3200, 13_500, "")).to.be.revertedWithCustomError(
        pasaran,
        "InvalidRegion"
      );
    });

    it("rejects prices outside the sensible range, and says what the range is", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu] = reporters;
      await expect(pasaran.connect(ayu).report(RICE, BANDUNG, 4_999, ""))
        .to.be.revertedWithCustomError(pasaran, "PriceOutOfRange")
        .withArgs(5_000, 40_000);
      // An extra zero.
      await expect(pasaran.connect(ayu).report(RICE, BANDUNG, 135_000, ""))
        .to.be.revertedWithCustomError(pasaran, "PriceOutOfRange")
        .withArgs(5_000, 40_000);
      await expect(pasaran.connect(ayu).report(RICE, BANDUNG, 5_000, "")).not.to.be.reverted;
      await expect(pasaran.connect(reporters[1]).report(RICE, BANDUNG, 40_000, "")).not.to.be.reverted;
    });

    it("limits the market name to 40 bytes", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      await expect(pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_500, "x".repeat(41))).to.be.revertedWithCustomError(
        pasaran,
        "MarketTooLong"
      );
      await expect(pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_500, "x".repeat(40))).not.to.be.reverted;
    });

    it("makes a wallet wait 20 hours before reporting the same item in the same region", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu] = reporters;
      await pasaran.connect(ayu).report(RICE, BANDUNG, 13_500, "");
      const reportedAt = await time.latest();

      await expect(pasaran.connect(ayu).report(RICE, BANDUNG, 13_600, ""))
        .to.be.revertedWithCustomError(pasaran, "TooSoon")
        .withArgs(reportedAt + COOLDOWN);
      expect(await pasaran.nextReportTime(ayu.address, RICE, BANDUNG)).to.equal(reportedAt + COOLDOWN);

      // Other items and other regions are not affected.
      await expect(pasaran.connect(ayu).report(EGGS, BANDUNG, 28_000, "")).not.to.be.reverted;
      await expect(pasaran.connect(ayu).report(RICE, SURABAYA, 13_000, "")).not.to.be.reverted;

      await time.increaseTo(reportedAt + COOLDOWN);
      expect(await pasaran.nextReportTime(ayu.address, RICE, BANDUNG)).to.equal(0);
      await expect(pasaran.connect(ayu).report(RICE, BANDUNG, 13_600, "")).not.to.be.reverted;
    });
  });

  describe("reference price", function () {
    it("needs three different wallets to be confirmed", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu, bima, citra] = reporters;

      await pasaran.connect(ayu).report(RICE, BANDUNG, 13_000, "");
      await pasaran.connect(bima).report(RICE, BANDUNG, 14_000, "");
      let [price, count, , confirmed] = await pasaran.priceOf(RICE, BANDUNG);
      expect([price, count, confirmed]).to.deep.equal([13_500n, 2n, false]); // even count: average of the middle two

      await pasaran.connect(citra).report(RICE, BANDUNG, 20_000, "");
      [price, count, , confirmed] = await pasaran.priceOf(RICE, BANDUNG);
      expect([price, count, confirmed]).to.deep.equal([14_000n, 3n, true]); // one high report does not move the median
    });

    it("rounds an even median down", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      await pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_001, "");
      await pasaran.connect(reporters[1]).report(RICE, BANDUNG, 13_002, "");
      expect((await pasaran.priceOf(RICE, BANDUNG))[0]).to.equal(13_001);
    });

    it("counts one vote per wallet: a new report replaces the old one", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu, bima] = reporters;
      await pasaran.connect(ayu).report(RICE, BANDUNG, 13_000, "first");
      await pasaran.connect(bima).report(RICE, BANDUNG, 15_000, "");
      await time.increase(COOLDOWN);
      await pasaran.connect(ayu).report(RICE, BANDUNG, 14_000, "second");

      const [price, count] = await pasaran.priceOf(RICE, BANDUNG);
      expect(count).to.equal(2);
      expect(price).to.equal(14_500);

      // The replaced report stays in the record but no longer counts.
      const [page] = await pasaran.getReports(RICE, BANDUNG, 0, 10);
      expect(page.map((r) => [r.market, r.counted])).to.deep.equal([
        ["second", true],
        ["", true],
        ["first", false],
      ]);
    });

    it("drops reports older than 14 days and remembers the last known price", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu, bima] = reporters;
      await pasaran.connect(ayu).report(RICE, BANDUNG, 13_000, "");
      await time.increase(3 * DAY);
      await pasaran.connect(bima).report(RICE, BANDUNG, 15_000, "");

      await time.increase(WINDOW - 3 * DAY + 1); // ayu's report is now 14 days and 1 second old
      let [price, count] = await pasaran.priceOf(RICE, BANDUNG);
      expect([price, count]).to.deep.equal([15_000n, 1n]);

      await time.increase(3 * DAY);
      [price, count] = await pasaran.priceOf(RICE, BANDUNG);
      expect([price, count]).to.deep.equal([0n, 0n]);

      const row = await pasaran.getFeed(RICE, BANDUNG);
      expect(row.price).to.equal(0);
      expect(row.lastKnownPrice).to.equal(14_000);
      expect(row.lastKnownAt).to.be.greaterThan(0);

      const [page] = await pasaran.getReports(RICE, BANDUNG, 0, 10);
      expect(page.every((r) => !r.counted)).to.equal(true);
    });

    it("keeps the 15 most recent reporters and lets the oldest vote go", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      // 15 reporters at 10,000 … 24,000, one hour apart.
      for (let i = 0; i < 15; i++) {
        await pasaran.connect(reporters[i]).report(RICE, BANDUNG, 10_000 + i * 1_000, "");
        await time.increase(HOUR);
      }
      expect((await pasaran.priceOf(RICE, BANDUNG))[0]).to.equal(17_000);

      // A sixteenth wallet replaces the oldest vote (10,000).
      await pasaran.connect(reporters[15]).report(RICE, BANDUNG, 40_000, "");
      const [price, count] = await pasaran.priceOf(RICE, BANDUNG);
      expect(count).to.equal(15);
      expect(price).to.equal(median([...Array.from({ length: 14 }, (_, i) => 11_000 + i * 1_000), 40_000]));

      const [page] = await pasaran.getReports(RICE, BANDUNG, 0, 50);
      expect(page.find((r) => r.reporter === reporters[0].address).counted).to.equal(false);
    });

    it("matches a reference median over random reports", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      let seed = 677;
      const rand = (n) => {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        return seed % n;
      };

      const votes = new Map(); // reporter -> { price, time }
      for (let step = 0; step < 80; step++) {
        await time.increase(rand(30) * HOUR + 1);
        const who = reporters[rand(reporters.length)];
        const next = await pasaran.nextReportTime(who.address, RICE, BANDUNG);
        if (next !== 0n) continue;

        const price = 9_000 + rand(9_000);
        await pasaran.connect(who).report(RICE, BANDUNG, price, "");
        const now = await time.latest();
        votes.set(who.address, { price, time: now });

        // The contract keeps 15 voters; drop the oldest beyond that, as it does.
        const sorted = [...votes.entries()].sort((a, b) => b[1].time - a[1].time);
        for (const [addr] of sorted.slice(15)) votes.delete(addr);

        const live = [...votes.values()].filter((v) => now - v.time <= WINDOW).map((v) => v.price);
        const [got, count] = await pasaran.priceOf(RICE, BANDUNG);
        expect(Number(count), `step ${step}`).to.equal(live.length);
        expect(Number(got), `step ${step}`).to.equal(median(live));
      }
    });
  });

  describe("sepasar history", function () {
    it("keeps the closing median of a sepasar when the next one starts", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu, bima, citra, dewi] = reporters;
      await toNextSepasar();
      const first = Math.floor((await time.latest()) / SEPASAR);

      await pasaran.connect(ayu).report(RICE, BANDUNG, 13_000, "");
      await pasaran.connect(bima).report(RICE, BANDUNG, 14_000, "");
      await pasaran.connect(citra).report(RICE, BANDUNG, 15_000, "");
      expect(await pasaran.history(RICE, BANDUNG, 10)).to.have.lengthOf(0);

      await toNextSepasar();
      await expect(pasaran.connect(dewi).report(RICE, BANDUNG, 16_000, ""))
        .to.emit(pasaran, "SepasarClosed")
        .withArgs(RICE, BANDUNG, first, 14_000, 3);

      const points = await pasaran.history(RICE, BANDUNG, 10);
      expect(points).to.have.lengthOf(1);
      expect(points[0].sepasar).to.equal(first);
      expect(points[0].median).to.equal(14_000);
      expect(points[0].reporters).to.equal(3);

      const row = await pasaran.getFeed(RICE, BANDUNG);
      expect(row.previousMedian).to.equal(14_000);
      expect(row.previousSepasar).to.equal(first);
      expect(row.spark).to.deep.equal([14_000n]);
      expect(row.price).to.equal(14_500); // four live votes now
    });

    it("closes only once per sepasar and skips quiet ones", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu, bima, citra] = reporters;
      await toNextSepasar();
      await pasaran.connect(ayu).report(RICE, BANDUNG, 13_000, "");

      await toNextSepasar();
      await pasaran.connect(bima).report(RICE, BANDUNG, 14_000, "");
      await pasaran.connect(citra).report(RICE, BANDUNG, 15_000, ""); // same sepasar: no new point
      expect(await pasaran.history(RICE, BANDUNG, 10)).to.have.lengthOf(1);

      // Five quiet sepasars later, the last active one is closed; the empty ones leave no point.
      await time.increase(5 * SEPASAR);
      await pasaran.connect(ayu).report(RICE, BANDUNG, 16_000, "");
      const points = await pasaran.history(RICE, BANDUNG, 10);
      expect(points.map((p) => p.median)).to.deep.equal([13_000n, 14_000n]);
    });

    it("measures the closing median at the end of the sepasar, not at the next report", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      await toNextSepasar();
      await pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_000, "");
      // So long that the old vote has expired by the time anyone reports again.
      await time.increase(WINDOW + SEPASAR);
      await pasaran.connect(reporters[1]).report(RICE, BANDUNG, 15_000, "");
      const points = await pasaran.history(RICE, BANDUNG, 10);
      expect(points.map((p) => [p.median, p.reporters])).to.deep.equal([[13_000n, 1n]]);
    });

    it("returns the last points, oldest first", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      for (let i = 0; i < 11; i++) {
        await toNextSepasar();
        await pasaran.connect(reporters[i % 3]).report(RICE, BANDUNG, 10_000 + i * 100, "");
      }
      const points = await pasaran.history(RICE, BANDUNG, 3);
      expect(points).to.have.lengthOf(3);
      expect(points[2].sepasar).to.be.greaterThan(points[1].sepasar);
      expect((await pasaran.getFeed(RICE, BANDUNG)).spark).to.have.lengthOf(8);
    });
  });

  describe("board and lists", function () {
    it("returns every item for a region in one call", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      await pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_500, "");
      await pasaran.connect(reporters[0]).report(EGGS, BANDUNG, 28_000, "");

      const rows = await pasaran.getBoard(BANDUNG);
      expect(rows).to.have.lengthOf(catalog.length);
      expect(rows[RICE].price).to.equal(13_500);
      expect(rows[EGGS].price).to.equal(28_000);
      expect(rows[1].price).to.equal(0);
      expect(rows[1].reporters).to.equal(0);
    });

    it("lists one item across regions", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      await pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_500, "");
      await pasaran.connect(reporters[1]).report(RICE, SURABAYA, 12_800, "");
      await pasaran.connect(reporters[2]).report(RICE, BANDUNG, 13_700, "");

      const [rows, next] = await pasaran.getAcrossRegions(RICE, 0, 10);
      expect(next).to.equal(0);
      expect(rows.map((r) => [r.regionCode, r.price])).to.deep.equal([
        [BigInt(BANDUNG), 13_600n],
        [BigInt(SURABAYA), 12_800n],
      ]);

      const [first, cursor] = await pasaran.getAcrossRegions(RICE, 0, 1);
      expect(first).to.have.lengthOf(1);
      expect(cursor).to.equal(1);
      const [second, done] = await pasaran.getAcrossRegions(RICE, cursor, 1);
      expect(second[0].regionCode).to.equal(SURABAYA);
      expect(done).to.equal(0);
    });

    it("tracks active regions, reporters and totals", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu, bima] = reporters;
      await pasaran.connect(ayu).report(RICE, BANDUNG, 13_500, "");
      await pasaran.connect(ayu).report(EGGS, BANDUNG, 28_000, "");
      await pasaran.connect(ayu).report(RICE, SURABAYA, 12_800, "");
      await pasaran.connect(bima).report(RICE, BANDUNG, 13_700, "");

      const [codes, counts] = await pasaran.activeRegions();
      expect(codes.map(Number)).to.deep.equal([BANDUNG, SURABAYA]);
      expect(counts.map(Number)).to.deep.equal([3, 1]);

      expect(await pasaran.reporterOf(ayu.address)).to.deep.equal([3n, 2n]);
      expect(await pasaran.reporterOf(bima.address)).to.deep.equal([1n, 1n]);

      const [wallets, reports, regions, next] = await pasaran.getReporters(0, 10);
      expect(wallets).to.deep.equal([ayu.address, bima.address]);
      expect(reports.map(Number)).to.deep.equal([3, 1]);
      expect(regions.map(Number)).to.deep.equal([2, 1]);
      expect(next).to.equal(0);

      const s = await pasaran.stats();
      expect(s.reports).to.equal(4);
      expect(s.reporters).to.equal(2);
      expect(s.regions).to.equal(2);
      expect(s.feeds).to.equal(3);
      expect(s.commodities).to.equal(catalog.length);
    });

    it("pages a wallet's reports newest first", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const [ayu] = reporters;
      for (let i = 0; i < 5; i++) await pasaran.connect(ayu).report(i, BANDUNG, 20_000, `m${i}`);

      const [first, cursor] = await pasaran.reportsBy(ayu.address, 0, 2);
      expect(first.map((r) => r.market)).to.deep.equal(["m4", "m3"]);
      expect(cursor).to.equal(3);
      const [second, cursor2] = await pasaran.reportsBy(ayu.address, cursor, 2);
      expect(second.map((r) => r.market)).to.deep.equal(["m2", "m1"]);
      const [third, done] = await pasaran.reportsBy(ayu.address, cursor2, 2);
      expect(third.map((r) => r.market)).to.deep.equal(["m0"]);
      expect(done).to.equal(0);

      const [none, zero] = await pasaran.reportsBy(reporters[5].address, 0, 10);
      expect(none).to.have.lengthOf(0);
      expect(zero).to.equal(0);
    });
  });

  describe("moderation", function () {
    it("lets the owner hide a market name without touching the price", async function () {
      const { pasaran, owner, reporters } = await loadFixture(deploy);
      await pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_500, "something rude");

      await expect(pasaran.connect(reporters[0]).setReportHidden(0, true)).to.be.revertedWithCustomError(pasaran, "NotOwner");
      await expect(pasaran.connect(owner).setReportHidden(0, true)).to.emit(pasaran, "ReportHiddenSet").withArgs(0, true);
      await expect(pasaran.connect(owner).setReportHidden(7, true)).to.be.revertedWithCustomError(pasaran, "UnknownReport");

      const [page] = await pasaran.getReports(RICE, BANDUNG, 0, 10);
      expect(page[0].hidden).to.equal(true);
      expect(page[0].market).to.equal("");
      expect(page[0].counted).to.equal(true);
      expect((await pasaran.priceOf(RICE, BANDUNG))[0]).to.equal(13_500);
    });

    it("transfers ownership", async function () {
      const { pasaran, owner, reporters } = await loadFixture(deploy);
      await expect(pasaran.connect(owner).transferOwnership(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        pasaran,
        "ZeroAddress"
      );
      await expect(pasaran.connect(owner).transferOwnership(reporters[0].address))
        .to.emit(pasaran, "OwnershipTransferred")
        .withArgs(owner.address, reporters[0].address);
      expect(await pasaran.owner()).to.equal(reporters[0].address);
    });
  });

  describe("PriceReader example", function () {
    async function withReader() {
      const ctx = await deploy();
      const Reader = await ethers.getContractFactory("PriceReader");
      const reader = await Reader.deploy(await ctx.pasaran.getAddress(), 3 * DAY);
      return { ...ctx, reader };
    }

    it("refuses a price fewer than three wallets stand behind", async function () {
      const { pasaran, reader, reporters } = await loadFixture(withReader);
      await pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_000, "");
      await pasaran.connect(reporters[1]).report(RICE, BANDUNG, 14_000, "");
      await expect(reader.reliablePrice(RICE, BANDUNG))
        .to.be.revertedWithCustomError(reader, "NotConfirmed")
        .withArgs(RICE, BANDUNG, 2);
    });

    it("reads a confirmed, recent price and prices a basket", async function () {
      const { pasaran, reader, reporters } = await loadFixture(withReader);
      for (let i = 0; i < 3; i++) {
        await pasaran.connect(reporters[i]).report(RICE, BANDUNG, 13_000 + i * 500, "");
        await pasaran.connect(reporters[i]).report(EGGS, BANDUNG, 28_000 + i * 1_000, "");
      }
      expect(await reader.reliablePrice(RICE, BANDUNG)).to.equal(13_500);
      expect(await reader.basketCost([RICE, EGGS], [10, 2], BANDUNG)).to.equal(10 * 13_500 + 2 * 29_000);
      await expect(reader.basketCost([RICE], [1, 2], BANDUNG)).to.be.revertedWithCustomError(reader, "LengthMismatch");
    });

    it("refuses a price older than its limit", async function () {
      const { pasaran, reader, reporters } = await loadFixture(withReader);
      for (let i = 0; i < 3; i++) await pasaran.connect(reporters[i]).report(RICE, BANDUNG, 13_000, "");
      await time.increase(3 * DAY + 1);
      await expect(reader.reliablePrice(RICE, BANDUNG)).to.be.revertedWithCustomError(reader, "TooOld");
    });
  });

  describe("gas", function () {
    it("stays within the budget the PRD quotes", async function () {
      const { pasaran, reporters } = await loadFixture(deploy);
      const deployGas = (await pasaran.deploymentTransaction().wait()).gasUsed;

      const firstTx = await (await pasaran.connect(reporters[0]).report(RICE, BANDUNG, 13_500, "Pasar Kosambi")).wait();
      const secondTx = await (await pasaran.connect(reporters[1]).report(RICE, BANDUNG, 13_700, "Pasar Kosambi")).wait();
      // A full board, then a report that also closes a sepasar.
      for (let i = 2; i < 15; i++) await pasaran.connect(reporters[i]).report(RICE, BANDUNG, 13_000 + i * 50, "");
      await toNextSepasar();
      const busyTx = await (await pasaran.connect(reporters[15]).report(RICE, BANDUNG, 13_600, "Pasar Kosambi")).wait();

      // A wallet that has reported here before, updating its vote.
      await time.increase(COOLDOWN);
      const returningTx = await (await pasaran.connect(reporters[1]).report(RICE, BANDUNG, 13_650, "Pasar Kosambi")).wait();

      const Reader = await ethers.getContractFactory("PriceReader");
      const reader = await Reader.deploy(await pasaran.getAddress(), 3 * DAY);
      const readGas = await reader.reliablePrice.estimateGas(RICE, BANDUNG);
      const addGas = await pasaran.addCommodity.estimateGas("Kedelai", "kg", 5_000, 50_000);

      console.log(
        `      gas — deploy ${deployGas}, addCommodity ${addGas}, first report here ${firstTx.gasUsed}, ` +
          `new reporter ${secondTx.gasUsed}, full board + sepasar close ${busyTx.gasUsed}, ` +
          `returning reporter ${returningTx.gasUsed}, priceOf via reader ${readGas}`
      );
      // The first report of an item in a region writes many fresh storage slots; later ones are cheaper.
      expect(deployGas).to.be.lessThan(3_500_000n);
      expect(firstTx.gasUsed).to.be.lessThan(500_000n);
      expect(secondTx.gasUsed).to.be.lessThan(350_000n);
      expect(busyTx.gasUsed).to.be.lessThan(450_000n);
      expect(returningTx.gasUsed).to.be.lessThan(250_000n);
    });
  });
});
