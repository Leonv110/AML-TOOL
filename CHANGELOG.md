# Changelog

All notable changes to the GAFA AML Platform are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

---

## [1.1.0] — 2026-04-24

### Release: Presidential Review Update

Implements all AML rule adjustments and UI/UX improvements discussed in the April 15 meeting with the GAFA President.

### Changed
- **Velocity Spike** — Now triggers on odd-hour activity (midnight–5AM IST) combined with frequency. freq≥3 at odd hours = critical flag (35 pts)
- **New Device High Value** — Weight reduced from 25 → 10 (low AML relevance per review)
- **Rapid Fund Movement** — Weight increased from 25 → 35 (high AML relevance per review)
- **Structuring** — Rewritten to use 30-day rolling window against ₹10,00,000 Indian CTR limit
- **Income label** — Changed from "Income" to "Average Income" on Customer Profile

### Added
- **Cryptocurrency Activity** — New transaction-level rule (35 pts) with expanded keyword matching (crypto, bitcoin, eth, defi, wallet, exchange, binance, coinbase)
- **Triggered Rule Flags** — Red pill badges on Customer Profile showing all active rule violations
- **Layering seed data** — `seed-layering-data.js` for demo-ready cyclic multi-hop transaction flows
- **Landing page JSON** — `public/landing-content.json` for code-free content editing
- **CHANGELOG.md** — This file

### Fixed
- **Screening Visit Source** — External links now correctly prepend `https://` and use `noopener noreferrer`
- **Rapid Fund Movement label** — Fixed typo "draint" → "drain"

### Security
- 6 known npm vulnerabilities (4 high, 1 critical, 1 moderate) — all in dev/build dependencies (vite, picomatch, dompurify, xlsx). No production runtime impact.

---

## [1.0.0] — 2026-04-11

### Initial Release
- Core AML platform with 10 transaction monitoring rules
- Customer Master Data ingestion and management
- Screening module with AML Watcher API integration
- Risk scoring engine (customer-level + transaction-level)
- Investigation workspace with AI pattern analysis
- Role-based access control (Admin, Investigator, Student)
- PDF report generation (SAR, STR, CTR)
- Audit logging
- Admin panel with user management
- Swagger API documentation
