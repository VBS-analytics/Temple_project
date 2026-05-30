# Ubhayam Report Issue - Tamil Star Mismatch (May 2026)

## Issue Summary
- **Reported by**: Admin/user (production usage)
- **Module**: `Ubhayam Report` (`/admin/pooja-details`)
- **Issue window**: May 20 to May 26, 2026
- **Reference used by admin**: Tamil daily calendar images (Mahacalendar/Rani Muthu convention)
- **Observed behavior**: Tamil star values in Ubhayam report are shifted during this window.

## Evidence Captured
- Production Ubhayam report screenshots for May 2026
- Tamil daily calendar images for dates May 19 to May 27, 2026

## Date-wise Comparison (Observed)

| Date | Reference Calendar (Daily image label) | Ubhayam Report (Production) | Match |
|---|---|---|---|
| 2026-05-19 | மிருகசீரிடம் | மிருகசீரிடம் | Yes |
| 2026-05-20 | திருவாதிரை | திருவாதிரை | Yes |
| 2026-05-21 | புனர்பூசம் | பூசம் | No |
| 2026-05-22 | பூசம் | ஆயில்யம் | No |
| 2026-05-23 | ஆயில்யம் | மகம் | No |
| 2026-05-24 | மகம் | பூரம் | No |
| 2026-05-25 | பூரம் | உத்தரம் | No |
| 2026-05-26 | உத்தரம் | அஸ்தம் | No |
| 2026-05-27 | அஸ்தம் | சித்திரை | No |
| 2026-05-28 | சித்திரை | சித்திரை | Yes (realigns from this date) |

## Pattern Identified
- Starting on **May 21**, one star is skipped in report output (`புனர்பூசம்` is missing).
- Then subsequent days are shifted by one star until **May 27**.
- On **May 28**, values realign.

## Likely Technical Cause
- This is consistent with a **boundary/transition assignment issue** in star-of-day calculation.
- The calculation model currently used in backend (Skyfield + custom alignment and ayanamsa approximation) appears to diverge from the admin’s calendar convention on this period.
- A likely trigger is star transition timing near early morning hours where day assignment rule differs.

## Impact
- Ubhayam report star column is incorrect for a contiguous date window.
- Admin trust in report correctness is affected.
- Downstream communication or planning based on this star value may be impacted.

## Immediate Fix Recommendation
1. Apply manual override for May 21 to May 27, 2026 in report star output.
2. Re-verify report export (PDF/XLSX) with corrected values.

## Preventive Actions
1. Finalize one official reference calendar convention with admin.
2. Add a date-wise override mechanism (`date`, `star`, `source`, `approved_by`).
3. Add monthly pre-validation process before month starts.
4. Add regression test dataset for known mismatch windows (including May 2026).
5. Keep any pilot provider comparison separate from production report until validated.

## Current Status
- Hotfix applied in calendar service for May 21 to May 27, 2026.
- Unit test added to lock this behavior and prevent regression.
- Production `Ubhayam Report` remains active.
- This issue document is created for tracking closure.

---

## Additional Issues Logged - October, November, December 2026

## October 2026 - Tamil Star Corrections

| Date | Wrong in Ubhayam Report | Correct Value |
|---|---|---|
| 2026-10-01 | பூரட்டாதி | கிருத்திகை |
| 2026-10-02 | ரேவதி | ரோகிணி |

## November 2026 - Tamil Star Corrections

| Date | Wrong in Ubhayam Report | Correct Value | Note |
|---|---|---|---|
| 2026-11-01 | பூசம் | புனர்பூசம் | 2nd Ashtami window context |
| 2026-11-02 | ஆயில்யம் | பூசம் | 2nd Ashtami day |
| 2026-11-03 | மகம் | ஆயில்யம் | |
| 2026-11-04 | பூரம் | மகம் | |
| 2026-11-05 | உத்தரம் | பூரம் | |
| 2026-11-07 | சித்திரை | அஸ்தம் | |
| 2026-11-08 | சுவாதி | சித்திரை | அமாவாசை day |
| 2026-11-09 | சுவாதி | சுவாதி | No star change (label confirmation) |
| 2026-11-20 | பூரட்டாதி | உத்திரட்டாதி | |
| 2026-11-21 | உத்திரட்டாதி | ரேவதி | |

## December 2026 - Canonical Day-Option Date Corrections

| Canonical Option | Wrong Date in Ubhayam | Correct Date |
|---|---|---|
| Sankata Chaturthi | 2026-12-26 | 2026-12-27 |
| Second Ashtami | 2026-12-30 | 2026-12-31 |

## Technical Cause (Oct-Dec pattern)
- Same class of issue as prior windows: day-assignment mismatch between computed astronomical boundaries and temple-admin reference calendar convention.
- For December items, mismatch affected canonical day-option mapping dates (not Tamil star labels).

## Code-Level Fix Applied
1. Updated nakshatra date overrides for October/November 2026 in `backend/pooja/services/calendar.py`.
2. Updated canonical day-option date overrides for December 2026 in `backend/pooja/views.py`.
3. Added regression tests in `backend/pooja/tests.py` to lock Oct-Nov star overrides and Dec canonical override dates.

## Validation Status
- Django targeted tests executed successfully for override behavior.
- Expected Ubhayam report alignment for October-November-December 2026 is now locked by tests.
