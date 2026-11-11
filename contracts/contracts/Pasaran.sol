// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Pasaran — staple food prices reported by residents, with a median worked out on-chain
/// @notice For every item in every regency or city, the contract keeps the latest report from
///         each reporter (one wallet, one vote) and takes the median of those made in the last
///         14 days as the reference price. Three or more reporters make a price "confirmed".
///         Each time a five-day sepasar ends, its closing median is kept as one history point.
/// @dev    Prices are whole rupiah. Regions are the four-digit Indonesian regency/city codes
///         (e.g. 3273). Holds no funds and has no payable entry point. The public BOT Chain RPC
///         does not serve eth_getLogs, so every piece of state is readable through view functions;
///         events are for explorers only.
contract Pasaran {
    // ───────────────────────────── Method ─────────────────────────────

    uint32 public constant WINDOW = 14 days; // reports older than this are not counted
    uint32 public constant COOLDOWN = 20 hours; // per wallet, per item and region
    uint32 public constant SEPASAR = 5 days; // one turn of the five-day market week
    uint8 public constant BOARD_SIZE = 15; // most recent reporters kept per item and region
    uint8 public constant CONFIRM_AT = 3; // reporters needed for a confirmed price
    uint8 public constant SPARK_POINTS = 8; // history points returned with each board row

    uint256 public constant MAX_COMMODITIES = 64;
    uint256 public constant MAX_NAME_BYTES = 40;
    uint256 public constant MAX_UNIT_BYTES = 12;
    uint256 public constant MAX_MARKET_BYTES = 40;
    uint256 public constant MAX_PAGE = 50;

    /// @dev Bit p is set when p is an Indonesian province code.
    uint256 private constant PROVINCES =
        (1 << 11) | (1 << 12) | (1 << 13) | (1 << 14) | (1 << 15) | (1 << 16) | (1 << 17) | (1 << 18) | (1 << 19) |
        (1 << 21) |
        (1 << 31) | (1 << 32) | (1 << 33) | (1 << 34) | (1 << 35) | (1 << 36) |
        (1 << 51) | (1 << 52) | (1 << 53) |
        (1 << 61) | (1 << 62) | (1 << 63) | (1 << 64) | (1 << 65) |
        (1 << 71) | (1 << 72) | (1 << 73) | (1 << 74) | (1 << 75) | (1 << 76) |
        (1 << 81) | (1 << 82) |
        (1 << 91) | (1 << 92) | (1 << 93) | (1 << 94) | (1 << 95) | (1 << 96);

    // ───────────────────────────── Storage ─────────────────────────────

    struct Commodity {
        uint32 minPrice; // sensible range, whole rupiah per unit
        uint32 maxPrice;
        bool active;
        string name; // e.g. "Beras medium"
        string unit; // e.g. "kg"
    }

    /// @dev One reporter's current vote on one item in one region. Fits one slot.
    struct Entry {
        address reporter;
        uint32 price;
        uint32 time;
    }

    /// @notice The closing median of one sepasar.
    struct Point {
        uint32 sepasar; // index: timestamp / SEPASAR
        uint32 median;
        uint8 reporters;
    }

    struct Feed {
        uint32 lastSepasar; // sepasar of the most recent report; 0 until the first one
        uint32 lastMedian; // reference price right after the most recent report
        uint32 lastReportAt;
        uint8 size;
        Entry[BOARD_SIZE] entries;
        uint32[] reportIds;
        Point[] history;
    }

    /// @dev Fits one slot, plus the market name.
    struct Report {
        address reporter;
        uint32 price;
        uint32 time;
        uint8 commodityId;
        uint16 regionCode;
        bool hidden;
        string market;
    }

    struct ReporterStats {
        uint32 reports;
        uint16 regions;
    }

    // ───────────────────────────── Views ─────────────────────────────

    /// @notice Everything a price board row needs, in one read.
    struct Row {
        uint8 commodityId;
        uint16 regionCode;
        uint32 price; // median of reports in the window; 0 when there are none
        uint8 reporters; // reporters in the window
        uint32 updatedAt; // newest report in the window
        bool confirmed;
        uint32 lastKnownPrice; // reference right after the latest report ever made
        uint32 lastKnownAt;
        uint32 previousMedian; // last closed sepasar; 0 when none has closed
        uint32 previousSepasar;
        uint32[] spark; // up to SPARK_POINTS closed sepasar medians, oldest first
    }

    struct ReportView {
        uint32 id;
        address reporter;
        uint32 price;
        uint32 time;
        uint8 commodityId;
        uint16 regionCode;
        bool counted; // still this reporter's vote, and inside the window
        bool hidden;
        string market; // empty when hidden
    }

    address public owner;

    Commodity[] private _commodities;
    Report[] private _reports;
    mapping(uint24 => Feed) private _feeds; // key: commodityId << 16 | regionCode
    mapping(uint24 => mapping(address => uint32)) private _lastReportAt;
    mapping(address => uint32[]) private _reportsBy;
    mapping(uint8 => uint16[]) private _regionsOf; // regions that have data for an item

    uint16[] private _regions; // every region with at least one report
    mapping(uint16 => uint32) private _regionReports;

    address[] private _reporterList;
    mapping(address => ReporterStats) private _reporters;
    mapping(address => mapping(uint16 => bool)) private _reportedIn;

    uint256 public feedCount;

    // ───────────────────────────── Events ─────────────────────────────

    event PriceReported(
        uint256 indexed reportId,
        uint8 indexed commodityId,
        uint16 indexed regionCode,
        address reporter,
        uint32 price
    );
    event SepasarClosed(uint8 indexed commodityId, uint16 indexed regionCode, uint32 sepasar, uint32 median, uint8 reporters);
    event CommodityAdded(uint8 indexed commodityId, string name, string unit, uint32 minPrice, uint32 maxPrice);
    event BoundsChanged(uint8 indexed commodityId, uint32 minPrice, uint32 maxPrice);
    event CommodityActiveSet(uint8 indexed commodityId, bool active);
    event ReportHiddenSet(uint256 indexed reportId, bool hidden);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ───────────────────────────── Errors ─────────────────────────────

    error NotOwner();
    error ZeroAddress();
    error UnknownCommodity();
    error CommodityInactive();
    error InvalidRegion();
    error PriceOutOfRange(uint32 minPrice, uint32 maxPrice);
    error MarketTooLong();
    error TooSoon(uint32 nextAllowedAt);
    error InvalidBounds();
    error InvalidName();
    error TooManyCommodities();
    error UnknownReport();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ───────────────────────────── Reporting ─────────────────────────────

    /// @notice Report the price of one item in one regency or city.
    /// @param price   whole rupiah per unit of the item (see getCommodities)
    /// @param market  optional name of the market or shop, up to 40 bytes
    function report(
        uint8 commodityId,
        uint16 regionCode,
        uint32 price,
        string calldata market
    ) external returns (uint256 reportId) {
        if (commodityId >= _commodities.length) revert UnknownCommodity();
        Commodity storage c = _commodities[commodityId];
        if (!c.active) revert CommodityInactive();
        if (!isValidRegion(regionCode)) revert InvalidRegion();
        if (price < c.minPrice || price > c.maxPrice) revert PriceOutOfRange(c.minPrice, c.maxPrice);
        if (bytes(market).length > MAX_MARKET_BYTES) revert MarketTooLong();

        uint24 key = _key(commodityId, regionCode);
        uint32 now_ = uint32(block.timestamp);
        uint32 last = _lastReportAt[key][msg.sender];
        if (last != 0 && now_ < last + COOLDOWN) revert TooSoon(last + COOLDOWN);
        _lastReportAt[key][msg.sender] = now_;

        Feed storage f = _feeds[key];
        _turnSepasar(f, commodityId, regionCode, now_);
        _vote(f, msg.sender, price, now_);

        reportId = _reports.length;
        _reports.push(
            Report({
                reporter: msg.sender,
                price: price,
                time: now_,
                commodityId: commodityId,
                regionCode: regionCode,
                hidden: false,
                market: market
            })
        );
        f.reportIds.push(uint32(reportId));
        _reportsBy[msg.sender].push(uint32(reportId));
        _countReport(regionCode);

        (uint32 reference_, , ) = _median(f, now_);
        f.lastMedian = reference_;
        f.lastReportAt = now_;

        emit PriceReported(reportId, commodityId, regionCode, msg.sender, price);
    }

    // ───────────────────────────── Owner ─────────────────────────────

    function addCommodity(
        string calldata name,
        string calldata unit,
        uint32 minPrice,
        uint32 maxPrice
    ) external onlyOwner returns (uint8 commodityId) {
        if (_commodities.length >= MAX_COMMODITIES) revert TooManyCommodities();
        uint256 nameLen = bytes(name).length;
        uint256 unitLen = bytes(unit).length;
        if (nameLen == 0 || nameLen > MAX_NAME_BYTES || unitLen == 0 || unitLen > MAX_UNIT_BYTES) revert InvalidName();
        _checkBounds(minPrice, maxPrice);

        commodityId = uint8(_commodities.length);
        _commodities.push(Commodity({minPrice: minPrice, maxPrice: maxPrice, active: true, name: name, unit: unit}));
        emit CommodityAdded(commodityId, name, unit, minPrice, maxPrice);
    }

    /// @notice Move the sensible range, e.g. to follow inflation. Existing reports are untouched.
    function setBounds(uint8 commodityId, uint32 minPrice, uint32 maxPrice) external onlyOwner {
        if (commodityId >= _commodities.length) revert UnknownCommodity();
        _checkBounds(minPrice, maxPrice);
        Commodity storage c = _commodities[commodityId];
        c.minPrice = minPrice;
        c.maxPrice = maxPrice;
        emit BoundsChanged(commodityId, minPrice, maxPrice);
    }

    function setCommodityActive(uint8 commodityId, bool active) external onlyOwner {
        if (commodityId >= _commodities.length) revert UnknownCommodity();
        _commodities[commodityId].active = active;
        emit CommodityActiveSet(commodityId, active);
    }

    /// @notice Hide the market name of a report from the app. The price itself still counts:
    ///         nobody can change or remove a report.
    function setReportHidden(uint256 reportId, bool hidden) external onlyOwner {
        if (reportId >= _reports.length) revert UnknownReport();
        _reports[reportId].hidden = hidden;
        emit ReportHiddenSet(reportId, hidden);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ───────────────────────────── For other contracts ─────────────────────────────

    /// @notice The community reference price of one item in one region.
    /// @return price      whole rupiah per unit; 0 when nobody reported in the last 14 days
    /// @return reporters  distinct wallets behind the price
    /// @return updatedAt  time of the newest report counted
    /// @return confirmed  true when at least CONFIRM_AT wallets reported
    /// @dev Check `confirmed` and `updatedAt` before relying on `price`. This is community data,
    ///      not an oracle fit to settle funds on its own.
    function priceOf(
        uint8 commodityId,
        uint16 regionCode
    ) external view returns (uint256 price, uint256 reporters, uint256 updatedAt, bool confirmed) {
        if (commodityId >= _commodities.length) revert UnknownCommodity();
        (uint32 median, uint8 count, uint32 newest) = _median(_feeds[_key(commodityId, regionCode)], uint32(block.timestamp));
        return (median, count, newest, count >= CONFIRM_AT);
    }

    // ───────────────────────────── For the app ─────────────────────────────

    function commodityCount() external view returns (uint256) {
        return _commodities.length;
    }

    function getCommodities() external view returns (Commodity[] memory) {
        return _commodities;
    }

    /// @notice A valid region is a known province code followed by a non-zero two-digit number.
    function isValidRegion(uint16 regionCode) public pure returns (bool) {
        uint256 province = regionCode / 100;
        uint256 local = regionCode % 100;
        return province < 256 && local != 0 && (PROVINCES >> province) & 1 == 1;
    }

    /// @notice Every item in one region: the whole price board in a single call.
    function getBoard(uint16 regionCode) external view returns (Row[] memory rows) {
        uint256 n = _commodities.length;
        rows = new Row[](n);
        for (uint256 i = 0; i < n; ++i) {
            rows[i] = _row(uint8(i), regionCode);
        }
    }

    function getFeed(uint8 commodityId, uint16 regionCode) external view returns (Row memory) {
        if (commodityId >= _commodities.length) revert UnknownCommodity();
        return _row(commodityId, regionCode);
    }

    /// @notice One item across every region that has data for it. Pages run oldest region first.
    function getAcrossRegions(
        uint8 commodityId,
        uint256 cursor,
        uint256 limit
    ) external view returns (Row[] memory rows, uint256 nextCursor) {
        if (commodityId >= _commodities.length) revert UnknownCommodity();
        uint16[] storage regions = _regionsOf[commodityId];
        uint256 total = regions.length;
        if (limit > MAX_PAGE) limit = MAX_PAGE;
        uint256 end = cursor + limit > total ? total : cursor + limit;
        uint256 size = end > cursor ? end - cursor : 0;
        rows = new Row[](size);
        for (uint256 i = 0; i < size; ++i) {
            rows[i] = _row(commodityId, regions[cursor + i]);
        }
        nextCursor = end < total ? end : 0;
    }

    /// @notice Regions with at least one report, and how many reports each has.
    function activeRegions() external view returns (uint16[] memory codes, uint32[] memory reports) {
        uint256 n = _regions.length;
        codes = new uint16[](n);
        reports = new uint32[](n);
        for (uint256 i = 0; i < n; ++i) {
            codes[i] = _regions[i];
            reports[i] = _regionReports[_regions[i]];
        }
    }

    /// @notice The last `count` closed sepasars, oldest first.
    function history(uint8 commodityId, uint16 regionCode, uint256 count) external view returns (Point[] memory points) {
        Point[] storage all = _feeds[_key(commodityId, regionCode)].history;
        uint256 n = all.length < count ? all.length : count;
        points = new Point[](n);
        uint256 start = all.length - n;
        for (uint256 i = 0; i < n; ++i) {
            points[i] = all[start + i];
        }
    }

    /// @notice Reports for one item in one region, newest first.
    /// @param cursor  pass 0 for the newest page, then the returned nextCursor; 0 means no more
    function getReports(
        uint8 commodityId,
        uint16 regionCode,
        uint256 cursor,
        uint256 limit
    ) external view returns (ReportView[] memory page, uint256 nextCursor) {
        return _page(_feeds[_key(commodityId, regionCode)].reportIds, cursor, limit);
    }

    /// @notice Reports made by one wallet, newest first. Same cursor rules as getReports.
    function reportsBy(
        address wallet,
        uint256 cursor,
        uint256 limit
    ) external view returns (ReportView[] memory page, uint256 nextCursor) {
        return _page(_reportsBy[wallet], cursor, limit);
    }

    function reportCount() external view returns (uint256) {
        return _reports.length;
    }

    /// @notice When `wallet` may report this item in this region again; 0 means now.
    function nextReportTime(address wallet, uint8 commodityId, uint16 regionCode) external view returns (uint32) {
        uint32 last = _lastReportAt[_key(commodityId, regionCode)][wallet];
        if (last == 0 || block.timestamp >= uint256(last) + COOLDOWN) return 0;
        return last + COOLDOWN;
    }

    function reporterOf(address wallet) external view returns (uint32 reports, uint16 regions) {
        ReporterStats storage r = _reporters[wallet];
        return (r.reports, r.regions);
    }

    /// @notice Reporters in the order they first reported.
    function getReporters(
        uint256 cursor,
        uint256 limit
    ) external view returns (address[] memory wallets, uint32[] memory reports, uint16[] memory regions, uint256 nextCursor) {
        uint256 total = _reporterList.length;
        if (limit > MAX_PAGE) limit = MAX_PAGE;
        uint256 end = cursor + limit > total ? total : cursor + limit;
        uint256 size = end > cursor ? end - cursor : 0;
        wallets = new address[](size);
        reports = new uint32[](size);
        regions = new uint16[](size);
        for (uint256 i = 0; i < size; ++i) {
            address w = _reporterList[cursor + i];
            wallets[i] = w;
            reports[i] = _reporters[w].reports;
            regions[i] = _reporters[w].regions;
        }
        nextCursor = end < total ? end : 0;
    }

    function stats()
        external
        view
        returns (uint256 reports, uint256 reporters, uint256 regions, uint256 feeds, uint256 commodities)
    {
        return (_reports.length, _reporterList.length, _regions.length, feedCount, _commodities.length);
    }

    // ───────────────────────────── Internal ─────────────────────────────

    function _key(uint8 commodityId, uint16 regionCode) private pure returns (uint24) {
        return (uint24(commodityId) << 16) | uint24(regionCode);
    }

    function _checkBounds(uint32 minPrice, uint32 maxPrice) private pure {
        if (minPrice == 0 || minPrice >= maxPrice) revert InvalidBounds();
    }

    /// @dev On the first report of a new sepasar, keep the closing median of the previous one.
    function _turnSepasar(Feed storage f, uint8 commodityId, uint16 regionCode, uint32 now_) private {
        uint32 sepasar = now_ / SEPASAR;
        uint32 previous = f.lastSepasar;
        if (previous == 0) {
            // First report for this item here.
            feedCount += 1;
            _regionsOf[commodityId].push(regionCode);
        } else if (sepasar > previous) {
            uint32 closedAt = (previous + 1) * SEPASAR - 1;
            (uint32 median, uint8 count, ) = _median(f, closedAt);
            if (count != 0) {
                f.history.push(Point({sepasar: previous, median: median, reporters: count}));
                emit SepasarClosed(commodityId, regionCode, previous, median, count);
            }
        }
        f.lastSepasar = sepasar;
    }

    function _countReport(uint16 regionCode) private {
        if (_regionReports[regionCode] == 0) _regions.push(regionCode);
        _regionReports[regionCode] += 1;

        ReporterStats storage r = _reporters[msg.sender];
        if (r.reports == 0) _reporterList.push(msg.sender);
        r.reports += 1;
        if (!_reportedIn[msg.sender][regionCode]) {
            _reportedIn[msg.sender][regionCode] = true;
            r.regions += 1;
        }
    }

    /// @dev Replace the reporter's vote, or take a free slot, or replace the oldest vote.
    function _vote(Feed storage f, address reporter, uint32 price, uint32 time) private {
        uint256 size = f.size;
        uint256 oldest;
        uint32 oldestTime = type(uint32).max;
        for (uint256 i = 0; i < size; ++i) {
            Entry storage e = f.entries[i];
            if (e.reporter == reporter) {
                e.price = price;
                e.time = time;
                return;
            }
            if (e.time < oldestTime) {
                oldestTime = e.time;
                oldest = i;
            }
        }
        if (size < BOARD_SIZE) {
            f.entries[size] = Entry({reporter: reporter, price: price, time: time});
            f.size = uint8(size + 1);
        } else {
            f.entries[oldest] = Entry({reporter: reporter, price: price, time: time});
        }
    }

    /// @dev Median of the votes made within WINDOW before `asOf`. An even count averages the
    ///      two middle values, rounding down.
    function _median(Feed storage f, uint32 asOf) private view returns (uint32 median, uint8 count, uint32 newest) {
        uint32[BOARD_SIZE] memory values;
        uint256 size = f.size;
        uint256 n;
        for (uint256 i = 0; i < size; ++i) {
            Entry memory e = f.entries[i];
            if (e.time <= asOf && asOf - e.time <= WINDOW) {
                // Insertion sort as values arrive.
                uint256 j = n;
                while (j > 0 && values[j - 1] > e.price) {
                    values[j] = values[j - 1];
                    --j;
                }
                values[j] = e.price;
                ++n;
                if (e.time > newest) newest = e.time;
            }
        }
        if (n == 0) return (0, 0, 0);
        if (n % 2 == 1) {
            median = values[n / 2];
        } else {
            median = uint32((uint64(values[n / 2 - 1]) + uint64(values[n / 2])) / 2);
        }
        count = uint8(n);
    }

    function _row(uint8 commodityId, uint16 regionCode) private view returns (Row memory row) {
        Feed storage f = _feeds[_key(commodityId, regionCode)];
        (uint32 median, uint8 count, uint32 newest) = _median(f, uint32(block.timestamp));

        row.commodityId = commodityId;
        row.regionCode = regionCode;
        row.price = median;
        row.reporters = count;
        row.updatedAt = newest;
        row.confirmed = count >= CONFIRM_AT;
        row.lastKnownPrice = f.lastMedian;
        row.lastKnownAt = f.lastReportAt;

        Point[] storage points = f.history;
        uint256 total = points.length;
        if (total != 0) {
            Point storage last = points[total - 1];
            row.previousMedian = last.median;
            row.previousSepasar = last.sepasar;
        }
        uint256 n = total < SPARK_POINTS ? total : SPARK_POINTS;
        row.spark = new uint32[](n);
        for (uint256 i = 0; i < n; ++i) {
            row.spark[i] = points[total - n + i].median;
        }
    }

    function _page(
        uint32[] storage ids,
        uint256 cursor,
        uint256 limit
    ) private view returns (ReportView[] memory page, uint256 nextCursor) {
        uint256 total = ids.length;
        uint256 from = (cursor == 0 || cursor > total) ? total : cursor;
        if (limit > MAX_PAGE) limit = MAX_PAGE;
        uint256 size = from < limit ? from : limit;
        page = new ReportView[](size);
        for (uint256 i = 0; i < size; ++i) {
            page[i] = _reportView(ids[from - 1 - i]);
        }
        nextCursor = from - size;
    }

    function _reportView(uint32 id) private view returns (ReportView memory v) {
        Report storage r = _reports[id];
        v.id = id;
        v.reporter = r.reporter;
        v.price = r.price;
        v.time = r.time;
        v.commodityId = r.commodityId;
        v.regionCode = r.regionCode;
        v.hidden = r.hidden;
        v.market = r.hidden ? "" : r.market;

        // Counted while it is still this reporter's vote and inside the window.
        if (block.timestamp - r.time <= WINDOW) {
            Feed storage f = _feeds[_key(r.commodityId, r.regionCode)];
            uint256 size = f.size;
            for (uint256 i = 0; i < size; ++i) {
                Entry storage e = f.entries[i];
                if (e.reporter == r.reporter) {
                    v.counted = e.time == r.time;
                    break;
                }
            }
        }
    }
}
