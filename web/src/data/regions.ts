// Regencies and cities (kabupaten/kota) the app can show by name.
//
// Codes follow the Kemendagri regional code scheme: two digits for the province, two for the
// regency or city (city codes start at 71). The contract accepts any well-formed code; this list
// only decides which places appear in the pickers and how they are named.
//
// This is a curated starting set of large cities and regencies, written by hand. Before mainnet
// it should be checked against, or replaced by, the full official list.

export type Region = { code: number; name: string; province: string }

export const PROVINCES: Record<number, string> = {
  11: 'Aceh',
  12: 'Sumatera Utara',
  13: 'Sumatera Barat',
  14: 'Riau',
  15: 'Jambi',
  16: 'Sumatera Selatan',
  17: 'Bengkulu',
  18: 'Lampung',
  19: 'Kepulauan Bangka Belitung',
  21: 'Kepulauan Riau',
  31: 'DKI Jakarta',
  32: 'Jawa Barat',
  33: 'Jawa Tengah',
  34: 'DI Yogyakarta',
  35: 'Jawa Timur',
  36: 'Banten',
  51: 'Bali',
  52: 'Nusa Tenggara Barat',
  53: 'Nusa Tenggara Timur',
  61: 'Kalimantan Barat',
  62: 'Kalimantan Tengah',
  63: 'Kalimantan Selatan',
  64: 'Kalimantan Timur',
  65: 'Kalimantan Utara',
  71: 'Sulawesi Utara',
  72: 'Sulawesi Tengah',
  73: 'Sulawesi Selatan',
  74: 'Sulawesi Tenggara',
  75: 'Gorontalo',
  76: 'Sulawesi Barat',
  81: 'Maluku',
  82: 'Maluku Utara',
  91: 'Papua',
  92: 'Papua Barat',
  93: 'Papua Selatan',
  94: 'Papua Tengah',
  95: 'Papua Pegunungan',
  96: 'Papua Barat Daya',
}

const LIST: Array<[number, string]> = [
  [1171, 'Kota Banda Aceh'],
  [1275, 'Kota Medan'],
  [1371, 'Kota Padang'],
  [1471, 'Kota Pekanbaru'],
  [1571, 'Kota Jambi'],
  [1671, 'Kota Palembang'],
  [1771, 'Kota Bengkulu'],
  [1871, 'Kota Bandar Lampung'],
  [1971, 'Kota Pangkal Pinang'],
  [2171, 'Kota Batam'],
  [2172, 'Kota Tanjung Pinang'],
  [3171, 'Kota Jakarta Selatan'],
  [3172, 'Kota Jakarta Timur'],
  [3173, 'Kota Jakarta Pusat'],
  [3174, 'Kota Jakarta Barat'],
  [3175, 'Kota Jakarta Utara'],
  [3201, 'Kabupaten Bogor'],
  [3204, 'Kabupaten Bandung'],
  [3216, 'Kabupaten Bekasi'],
  [3271, 'Kota Bogor'],
  [3273, 'Kota Bandung'],
  [3274, 'Kota Cirebon'],
  [3275, 'Kota Bekasi'],
  [3276, 'Kota Depok'],
  [3277, 'Kota Cimahi'],
  [3278, 'Kota Tasikmalaya'],
  [3372, 'Kota Surakarta'],
  [3374, 'Kota Semarang'],
  [3375, 'Kota Pekalongan'],
  [3376, 'Kota Tegal'],
  [3402, 'Kabupaten Bantul'],
  [3404, 'Kabupaten Sleman'],
  [3471, 'Kota Yogyakarta'],
  [3515, 'Kabupaten Sidoarjo'],
  [3525, 'Kabupaten Gresik'],
  [3571, 'Kota Kediri'],
  [3573, 'Kota Malang'],
  [3578, 'Kota Surabaya'],
  [3603, 'Kabupaten Tangerang'],
  [3671, 'Kota Tangerang'],
  [3673, 'Kota Serang'],
  [3674, 'Kota Tangerang Selatan'],
  [5103, 'Kabupaten Badung'],
  [5171, 'Kota Denpasar'],
  [5271, 'Kota Mataram'],
  [5371, 'Kota Kupang'],
  [6171, 'Kota Pontianak'],
  [6271, 'Kota Palangka Raya'],
  [6371, 'Kota Banjarmasin'],
  [6471, 'Kota Balikpapan'],
  [6472, 'Kota Samarinda'],
  [6571, 'Kota Tarakan'],
  [7171, 'Kota Manado'],
  [7271, 'Kota Palu'],
  [7371, 'Kota Makassar'],
  [7471, 'Kota Kendari'],
  [7571, 'Kota Gorontalo'],
  [8171, 'Kota Ambon'],
  [8271, 'Kota Ternate'],
  [9171, 'Kota Jayapura'],
]

export const REGIONS: Region[] = LIST.map(([code, name]) => ({
  code,
  name,
  province: PROVINCES[Math.floor(code / 100)] ?? 'Indonesia',
}))

const BY_CODE = new Map(REGIONS.map((r) => [r.code, r]))

/** The region's name, or a readable fallback for a valid code this list does not name yet. */
export function regionName(code: number): string {
  return BY_CODE.get(code)?.name ?? `Region ${code}`
}

export function regionProvince(code: number): string {
  return BY_CODE.get(code)?.province ?? PROVINCES[Math.floor(code / 100)] ?? 'Indonesia'
}

export const isKnownRegion = (code: number): boolean => BY_CODE.has(code)

/** Regions grouped by province, in code order, for pickers. */
export function regionsByProvince(): Array<{ province: string; regions: Region[] }> {
  const groups = new Map<string, Region[]>()
  for (const r of REGIONS) {
    const list = groups.get(r.province) ?? []
    list.push(r)
    groups.set(r.province, list)
  }
  return [...groups.entries()].map(([province, regions]) => ({ province, regions }))
}

/** The short form used where space is tight: "Bandung", "Jakarta Selatan", "Kab. Bogor". */
export function shortRegionName(code: number): string {
  const name = regionName(code)
  if (name.startsWith('Kota ')) return name.slice(5)
  if (name.startsWith('Kabupaten ')) return `Kab. ${name.slice(10)}`
  return name
}
