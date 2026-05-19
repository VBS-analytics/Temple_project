# Ubhayam Month Override

Use this only when a month must be frozen to a manually approved baseline.

## 1) Configure settings

Set this in Django settings/environment:

- `UBHAYAM_MONTH_OVERRIDES_FILE = "backend/data/ubhayam_overrides/overrides.json"`

Optional in settings directly:

- `UBHAYAM_MONTH_OVERRIDES = {...}`

If both are provided, file values take precedence.

## 2) JSON format

```json
{
  "2026-05": {
    "day_options": {
      "dates": []
    },
    "donor_registrations": {
      "dates": []
    },
    "tamil_nakshatras": []
  }
}
```

## 3) Endpoint behavior

- `calendar/day-options/` uses `day_options` override for that month.
- `calendar/donor-registrations/` uses `donor_registrations` override for that month (admin requests only).
- `calendar/tamil-nakshatras/` uses `tamil_nakshatras` override for that month.

When override is active, API response includes:

- `"source": "manual_override"` (for day-options and donor-registrations).

## 4) Important

- Keep this for exceptional production stabilization only.
- Review/approve data with admin team before enabling.
- Remove override after the affected month if not needed further.

