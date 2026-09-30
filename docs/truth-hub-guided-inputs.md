# Guided Truth Hub inputs

All seven business templates now define field type, label, section, help text, recommendation, optional aliases, options, units, and offering-type relevance. The saved template is a business-level `business_template` fact. Before a preference is saved, the UI suggests a template from the business industry.

## Storage

No database migration is required. Business names remain on `businesses`; offering name/type/description remain on `offerings`. Guided attributes remain in `facts.fact_key` / `facts.fact_value`, linked to the business and optionally an offering.

- Text, descriptions, contact fields, selections, dates, times, numbers, percentages, and durations use normalized text. Units are specified by the field configuration (e.g. duration in minutes).
- Boolean answers use `true` / `false` text, decoded as booleans by the AI context builder.
- Tags, lists, and multiple selections use JSON array text.
- Weekly hours use a `weekly_hours` object with a day map, open/closed/unset state, and 24-hour opening/closing times. A closing time before opening means the next day. Split shifts are not supported. All seven days must be set to count as complete.
- Prices use a `pricing` object with USD currency, fixed/starting/range/quote/free mode, and decimal amounts.
- Locations use a `location` object with street, city, region, and postal code.
- Service areas use a `service_area` object with place tags and optional radius/unit.

Structured objects are encoded as JSON text for compatibility with the current fact value column. The UI displays human-readable summaries and never asks users to enter JSON. `buildQueryContext()` decodes these values while preserving legacy plain text. No new OpenAI requests are introduced.

Legacy keys are retained when matching configured aliases. Existing unstructured hours/prices/locations can be kept via explicit custom text. Custom facts remain under Advanced. Existing facts outside the active template are retained. Blank new offering fields are not created; only changed offering details are updated. Changed details require fresh verification confirmation, while unchanged details retain their verification and source.

Offering identity and fact writes are separate requests. If detail saving fails after identity saving, the form retains the offering ID and reports the partial save so retries do not create another offering. Source attribution and last-updated values are displayed from existing records; source linking is not added by this change.

Completion counts the business name and active template's required/recommended business and offering fields. Arbitrary custom facts are excluded. With no offerings, one offering's recommended fields remain outstanding. False boolean answers count as completed answers.

## Verification performed

Production build, TypeScript, and targeted lint passed. Normalization checks covered weekly hours, price ranges, boolean false, legacy values, and template key uniqueness. The existing Cuisine and Location records were saved through the real UI and read back from Supabase with the same business meaning and verification status, now normalized as tags and a location object. Seeded offerings and other facts remained available. The in-app preview rendered successfully, but its interaction automation did not respond; successful live saves were performed in Chrome before that preview issue.

CSV/file upload and spreadsheet/feed imports remain their existing clearly labeled prototypes/coming-soon features. Guided field controls are wired to persistence; they are not visual-only. No AI calls were made.
