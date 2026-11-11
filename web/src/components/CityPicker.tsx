import { useMemo } from 'react'
import { regionName, regionsByProvince } from '../data/regions'

type Props = {
  id: string
  label: string
  value: number | undefined
  onChange: (code: number) => void
  /** Regions that already have reports, most reported first. They are listed at the top. */
  active?: Array<{ code: number; reports: number }>
  disabled?: boolean
  hideLabel?: boolean
}

/** A native select grouped by province: it works with every keyboard, phone and screen reader. */
export function CityPicker({ id, label, value, onChange, active = [], disabled, hideLabel }: Props) {
  const groups = useMemo(() => {
    const withData = new Set(active.map((a) => a.code))
    return regionsByProvince()
      .map((g) => ({ ...g, regions: g.regions.filter((r) => !withData.has(r.code)) }))
      .filter((g) => g.regions.length > 0)
  }, [active])

  const sortedActive = useMemo(() => [...active].sort((a, b) => b.reports - a.reports), [active])

  return (
    <div className="picker">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </label>
      <select
        id={id}
        className="field"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      >
        {value === undefined && (
          <option value="" disabled>
            Choose a regency or city
          </option>
        )}
        {sortedActive.length > 0 && (
          <optgroup label="With prices">
            {sortedActive.map((a) => (
              <option key={a.code} value={a.code}>
                {regionName(a.code)}
              </option>
            ))}
          </optgroup>
        )}
        {groups.map((g) => (
          <optgroup key={g.province} label={g.province}>
            {g.regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
