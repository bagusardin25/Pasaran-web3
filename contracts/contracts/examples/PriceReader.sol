// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The part of Pasaran another contract needs.
interface IPasaran {
    function priceOf(
        uint8 commodityId,
        uint16 regionCode
    ) external view returns (uint256 price, uint256 reporters, uint256 updatedAt, bool confirmed);
}

/// @title PriceReader — an example of using Pasaran prices from another contract
/// @notice Reads a community reference price and refuses to use it unless enough wallets
///         reported it recently. Copy the checks, not necessarily the contract.
contract PriceReader {
    IPasaran public immutable pasaran;
    /// @notice Oldest report this contract is willing to rely on, in seconds.
    uint256 public immutable maxAge;

    error NotConfirmed(uint8 commodityId, uint16 regionCode, uint256 reporters);
    error TooOld(uint8 commodityId, uint16 regionCode, uint256 updatedAt);
    error LengthMismatch();

    constructor(IPasaran pasaran_, uint256 maxAge_) {
        pasaran = pasaran_;
        maxAge = maxAge_;
    }

    /// @notice Rupiah per unit, or a revert if the data is too thin or too old to rely on.
    function reliablePrice(uint8 commodityId, uint16 regionCode) public view returns (uint256) {
        (uint256 price, uint256 reporters, uint256 updatedAt, bool confirmed) = pasaran.priceOf(commodityId, regionCode);
        if (!confirmed) revert NotConfirmed(commodityId, regionCode, reporters);
        if (block.timestamp - updatedAt > maxAge) revert TooOld(commodityId, regionCode, updatedAt);
        return price;
    }

    /// @notice What a shopping basket costs in one region, e.g. 10 kg of rice and 2 kg of eggs.
    /// @param quantities whole units of each item, in the same order as `commodityIds`
    function basketCost(
        uint8[] calldata commodityIds,
        uint256[] calldata quantities,
        uint16 regionCode
    ) external view returns (uint256 total) {
        if (commodityIds.length != quantities.length) revert LengthMismatch();
        for (uint256 i = 0; i < commodityIds.length; ++i) {
            total += reliablePrice(commodityIds[i], regionCode) * quantities[i];
        }
    }
}
