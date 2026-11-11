// The starting catalogue, added by deploy.js in this order (the order sets each item's id).
//
// Sensible ranges are deliberately wide — roughly a third to three times a normal 2025–2026
// market price — so they catch a missing or extra zero without blocking real price swings.
// They are estimates and should be reviewed before mainnet; the owner can move them later
// with setBounds().
module.exports = [
  { name: "Beras medium", unit: "kg", min: 5_000, max: 40_000 },
  { name: "Beras premium", unit: "kg", min: 7_000, max: 50_000 },
  { name: "Minyak goreng kemasan", unit: "liter", min: 8_000, max: 60_000 },
  { name: "Gula pasir", unit: "kg", min: 8_000, max: 60_000 },
  { name: "Telur ayam ras", unit: "kg", min: 12_000, max: 90_000 },
  { name: "Daging ayam ras", unit: "kg", min: 15_000, max: 120_000 },
  { name: "Daging sapi", unit: "kg", min: 60_000, max: 400_000 },
  { name: "Cabai merah keriting", unit: "kg", min: 8_000, max: 300_000 },
  { name: "Cabai rawit merah", unit: "kg", min: 8_000, max: 350_000 },
  { name: "Bawang merah", unit: "kg", min: 10_000, max: 150_000 },
  { name: "Bawang putih", unit: "kg", min: 10_000, max: 150_000 },
  { name: "Tepung terigu", unit: "kg", min: 5_000, max: 40_000 },
];
