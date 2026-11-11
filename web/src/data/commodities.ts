// English names for the catalogue. The contract stores the Indonesian name; this maps it for
// the second language. An item added to the contract later still shows, under its own name.
const ENGLISH: Record<string, string> = {
  'Beras medium': 'Rice, medium grade',
  'Beras premium': 'Rice, premium grade',
  'Minyak goreng kemasan': 'Cooking oil, packaged',
  'Gula pasir': 'Granulated sugar',
  'Telur ayam ras': 'Chicken eggs',
  'Daging ayam ras': 'Chicken meat',
  'Daging sapi': 'Beef',
  'Cabai merah keriting': 'Curly red chilli',
  'Cabai rawit merah': 'Red bird’s-eye chilli',
  'Bawang merah': 'Shallots',
  'Bawang putih': 'Garlic',
  'Tepung terigu': 'Wheat flour',
}

export const englishName = (indonesian: string): string | undefined => ENGLISH[indonesian]

/** "liter" reads better as "litre" in the English interface; the contract keeps its own word. */
export const unitLabel = (unit: string): string => (unit === 'liter' ? 'litre' : unit)
