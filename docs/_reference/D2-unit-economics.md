> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

*D2 — Verified Unit Economics & Financial Model*

**BP SMARTWATCH VENTURE**

**DELIVERABLE D2**

**Verified Unit Economics & Financial Model**

*Landed Cost, Pricing, Break-even, and Year 1 Scenarios*

|**Document**|D2 — Verified Unit Economics & Financial Model|
| :- | :- |
|**Project**|BP Smartwatch Venture (Urion U16H / U19M white-label)|
|**Builds On**|D1 — Competitive Landscape Report|
|**Date Issued**|4 May 2026|
|**Status**|Completed — for permanent reference|
|**Confidence**|High on hard inputs (FOB, MOQ, FDA fee, Omron benchmarks). Medium on freight, duty, and last-mile (estimated against current 2026 carrier and customs schedules; final numbers must be confirmed at PO time).|


# **1. Executive Summary**
This deliverable answers a single question: at the unit costs and minimum order quantity confirmed with the supplier, can the BP Smartwatch venture sustain a profitable business in the United States and Nigeria, and at what retail price points and volumes?

The short answer: yes — provided the founder commits to a premium-positioned strategy, accepts that Nigeria mathematically cannot undercut Omron upper-arm cuffs, and absorbs a fixed annual FDA Establishment Registration cost of $11,423 that is unavoidable for FY2026.

Gross margin per unit at the recommended US Shopify price points lands at 41–44% for U16H and U19M respectively. Year 1 base case projects approximately 750 units sold and approximately $20,000 in pre-tax operating profit after absorbing FDA registration, app development, and working capital. The minimum viable first order to test profitably before scaling is the supplier-confirmed 500-unit MOQ, split 300 U16H / 200 U19M.

|<p>**BOTTOM LINE**</p><p>500-unit MOQ split 300 U16H / 200 U19M. Total launch capital required ~$92,000. Year 1 base-case gross profit approximately $20,000. The FDA $11,423 annual fee is the single largest non-inventory line item and unavoidable. Nigeria runs as a parallel premium pharmacy channel, not a budget play.</p>|
| :- |
# **2. Confirmed Inputs**
All figures in this section have been verified directly with the supplier or against published government / carrier schedules. They are inputs to the model, not assumptions.

|**Input**|**Value**|**Source / Note**|
| :- | :- | :- |
|**U16H FOB unit cost**|$90|Direct from Urion (James Lee).|
|**U19M FOB unit cost**|$100|Direct from Urion (James Lee).|
|**Minimum Order Quantity**|500 units|Confirmed; can be split across SKUs.|
|Urion direct retail (U16H)|$200|Urion's own DTC list price.|
|Urion direct retail (U19M)|$250|Urion's own DTC list price.|
|**FDA Establishment Registration (FY2026)**|**$11,423**|MDUFA fee. Annual. Window: Oct 1 – Dec 31. Non-waivable above small-business threshold.|
|NAFDAC Class B device fee|~₦70,000 (~$50)|Per product, valid 5 years.|
|US Section 301 China tariff on consumer wrist devices|7\.5%|Applies under HTS 9018.19 unless medical-pro exclusion granted.|
|US MFN duty on HTS 9018|0%|Electromedical apparatus — duty-free baseline.|
|US de minimis for China-origin goods|Eliminated|As of August 2025 — formal entry required for all shipments.|


# **3. Landed Cost — United States**
Calculation for a 500-unit MOQ split 300 U16H + 200 U19M, shipped via air freight from Shenzhen (SZX) to a US port of entry, formal entry, fully-loaded.

|**Cost Line**|**USD**|**Note**|
| :- | :- | :- |
|FOB Shenzhen (300 × $90 + 200 × $100)|$47,000|Cargo value before freight.|
|Air freight SZX → US (~175 kg chargeable)|$875 – $1,225|Mid-2026 carrier rates.|
|US MFN duty (HTS 9018)|$0|Duty-free.|
|Section 301 tariff (7.5% of FOB)|$3,525|Assumes no exclusion.|
|Merchandise Processing Fee (MPF, ~0.3464%, capped)|$163|CBP fee.|
|Customs broker|$250 – $500|Per-shipment.|
|Last-mile (port → 3PL or FBA inbound)|$300 – $500|Domestic trucking.|
|**Total landed (mid case)**|**~$52,500**|Round number for planning.|
|Per-unit landed (U16H)|**~$100.80**|Includes pro-rata share of all freight, tariff, fees.|
|Per-unit landed (U19M)|**~$111.40**|Includes pro-rata share of all freight, tariff, fees.|


# **4. Landed Cost — Nigeria**
Calculation for a 500-unit MOQ shipped to Lagos (LOS) or Port Harcourt (PHC) via air freight, DDP basis, with NAFDAC-registered medical-device classification.

|**Cost Line**|**USD**|**Note**|
| :- | :- | :- |
|FOB Shenzhen (300 × $90 + 200 × $100)|$47,000|Same as US.|
|Air freight SZX → LOS / PHC|$1,225 – $1,575|Africa rates run higher than US lanes.|
|Customs duty (5% conservative)|$2,350|0% if Band 0 medical ruling secured.|
|Surcharge (7% of duty)|$165|Federal levy.|
|CISS (1% of FOB)|$470|Comprehensive Import Supervision Scheme.|
|ETLS (0.5% of CIF)|$245|ECOWAS Trade Liberalization Scheme.|
|VAT (7.5% on CIF + duty + charges)|$3,940|Recoverable if VAT-registered.|
|Customs broker + clearance|$400 – $600|Lagos / PHC.|
|**Total landed (mid case, 5% duty)**|**~$55,650**|Net of recoverable VAT: ~$53,140|
|Per-unit landed (U16H, 5% duty)|**~$106.30**|If 0% duty granted: ~$101.50|

|<p>**ACTION REQUIRED**</p><p>Request a binding HS-code classification ruling from Nigeria Customs Service for HS 9018.19 on a wrist BP monitor. Confirms whether 0% or 5% duty applies. Free, takes 4–8 weeks. Each percentage point of duty difference is approximately $470 across the MOQ — material to per-unit margin.</p>|
| :- |


# **5. Pricing and Gross Profit Per Unit**
All numbers below assume the per-unit landed costs from Sections 3 and 4 and exclude payment processor fees (estimated 2.9% + $0.30 / Stripe baseline) and selling-platform fees (Amazon FBA fees roughly 15% referral + $4–$6 fulfillment per unit). Effective net margin will be lower in Amazon channels and higher in direct Shopify channels.
## **5.1 United States**

|**SKU + Channel**|**Retail**|**Net to Seller**|**GP / Unit**|**Margin %**|
| :- | :- | :- | :- | :- |
|U16H — Amazon FBA|$179|~$135|**~$34**|19%|
|U16H — Shopify direct|$199|~$182|**~$81**|41%|
|U19M — Amazon FBA|$229|~$172|**~$61**|27%|
|U19M — Shopify direct|$229|~$211|**~$100**|44%|

## **5.2 Nigeria**

|**SKU + Channel**|**Retail (₦)**|**USD equiv (~)**|**GP / Unit**|**Margin %**|
| :- | :- | :- | :- | :- |
|U16H — Jumia|₦175,000|$125|~$4|3%|
|U16H — Pharmacy / direct|₦199,000|$142|**~$29**|21%|
|U19M — Pharmacy / direct|₦265,000|$189|**~$66**|35%|

|<p>**NIGERIA REALITY CHECK**</p><p>Cheapest profitable Nigeria retail price is ₦175,000+ — that is approximately 5x an Omron M3. Nigeria is a premium-positioned channel only. Any volume strategy that requires undercutting Omron is mathematically impossible at the current FOB cost.</p>|
| :- |


# **6. Break-Even Analysis**
Fixed costs that must be absorbed before unit economics produce profit:

|**Fixed Cost Line**|**USD**|**Frequency**|
| :- | :- | :- |
|FDA Establishment Registration FY2026|**$11,423**|Annual|
|App MVP development|$15,000 – $40,000|One-time|
|Regulatory consultant (US 510(k) review, labeling, SOPs)|$2,500|One-time|
|US Agent service (third-party, annual)|$1,500 – $3,000|Annual|
|NAFDAC application + technical file prep|$500|Every 5 years|
|Manufacturing & Supply Agreement (legal review)|$2,000|One-time|
|Trademark filings (USPTO + Nigeria)|$1,200|One-time|
|**Total Year 1 fixed (mid app cost)**|**~$39,500**||

Break-even unit volumes by retail price point (using Shopify direct margins, the highest-GP channel):

- U16H @ $199 ($81 GP/unit) — break-even on fixed costs at approximately 488 units.
- U19M @ $229 ($100 GP/unit) — break-even on fixed costs at approximately 395 units.
- Blended (60/40 split, weighted GP ~$89/unit) — break-even at approximately 444 units.

This means roughly 89% of the 500-unit MOQ must be sold through high-margin channels just to absorb fixed Year 1 costs. Amazon-only would require approximately 870 units — beyond the MOQ — to break even. The model only works with a Shopify direct channel pulling its weight.


# **7. Twelve-Month Revenue Scenarios**
Each scenario assumes the 500-unit MOQ landed and a mix of Amazon plus Shopify direct sales. Conservative = full-year sell-through at slow pace; Base = sell-through plus a small re-order; Aggressive = sell-through plus a meaningful re-order. All numbers in USD.

|**Scenario**|**Conservative**|**Base**|**Aggressive**|
| :- | :- | :- | :- |
|**Units sold (Year 1)**|300|750|1,500|
|Channel mix (Amazon : Shopify)|70 : 30|60 : 40|50 : 50|
|Blended GP per unit|~$50|~$70|~$85|
|Gross profit|$15,000|$52,500|$127,500|
|Less Year 1 fixed costs|($26,750)|($32,250)|($44,700)|
|**Pre-tax operating profit**|**($11,750)**|**$20,250**|**$82,800**|

Notes on scenarios:

- Conservative scenario absorbs the FDA fee, app development at the low end, and basic operating costs but does not generate enough volume to clear fixed costs. This is the loss case.
- Base scenario clears fixed costs and produces modest profit. This is the realistic plan.
- Aggressive scenario assumes a successful Shopify funnel, an Amazon listing in good standing, and one re-order during Year 1. It is achievable but requires marketing execution.
- Nigerian volumes are not modeled in these scenarios — Nigeria is treated as upside, contingent on NAFDAC clearance arriving in Q3 / Q4.


# **8. Subscription Layer Research**
Benchmark health-app subscription pricing (BP, sleep, fitness categories) sits in the following ranges, observed across iOS App Store and Google Play in May 2026:

|**Tier**|**Typical Price**|**Conversion Benchmark**|
| :- | :- | :- |
|Weekly trial (predatory)|$3.99 – $9.99 / week|High install but high refund / chargeback.|
|Monthly|$3.99 – $13.49 / month|3 – 6% of installs.|
|Annual|$29.99 – $99.99 / year|8 – 10% of engaged users when offered alongside generous free tier.|

Recommendation: launch with $3.99 / month or $29.99 / year as the price point. Free tier must be genuinely useful — at minimum, unlimited BP readings, unlimited history, basic trend charts, and Apple Health / Google Fit sync. Paid tier adds AI insights, doctor-shareable PDF reports, family member tracking, and reminder workflows.

Critical anti-pattern flagged in D1 customer research: Wellue and several Tier 2 sellers paywall historical readings. This is widely hated by users. Do not paywall historical data — under any circumstances.


# **9. Launch Capital Requirement**
Total capital required to ship the first 500 units, register with FDA, register the entity for NAFDAC, build the MVP app, and reach the launch starting line:

|**Capital Line**|**USD**|**Note**|
| :- | :- | :- |
|Inventory (500 units landed, US route)|$52,500|Largest line.|
|FDA registration FY2026|$11,423|Year 1.|
|App MVP|$15,000|Low-end estimate.|
|Regulatory + legal + entity (combined)|$8,500|Consultant, MSA, trademarks.|
|Photography, packaging design, brand assets|$3,000|Day-1 brand polish.|
|Initial marketing (Meta + TikTok + Amazon ads)|$5,000|First 3 months.|
|Working capital buffer|$5,000|Returns, surprises.|
|**Total launch capital**|**~$100,000**|Year 1.|

This is the realistic Year 1 capital ceiling. A bare-minimum bootstrap version (300-unit first order if Urion will accept, $15k app, no marketing reserve) could compress this to approximately $65,000 — but margin-of-safety becomes thin and any single mistake compounds.


# **10. Key Decisions Locked by D2**
1. First order = 500 units, split 300 U16H + 200 U19M. Confirmed against MOQ.
1. US is the lead market. EU is deferred to Year 2 or later (no in-region presence).
1. Nigeria runs as a parallel pharmacy B2B channel, not a primary revenue line in Year 1.
1. Pricing: U16H $199 / U19M $229 on Shopify direct. Amazon prices set lower to win the buy-box.
1. Subscription: $3.99 / month, $29.99 / year. Free tier generous and never paywalls historical readings.
1. Year 1 plan = base case (750 units, ~$20k operating profit). Anything below 444 units is unprofitable.
1. The FDA $11,423 fee is treated as an immovable Year 1 line item. Plan accordingly.
# **11. Variables Still to Confirm**
- Nigeria customs duty rate — pending binding ruling from NCS for HS 9018.19.
- Final freight quote — to be locked at PO time with chosen forwarder.
- Section 301 tariff status — eligible exclusions are reviewed periodically; recheck before each shipment.
- App development cost — exact figure depends on D4 spec.
- Re-order timing and volume — depends on Year 1 sell-through velocity.

*End of Deliverable D2.*
BP Smartwatch Venture  |  Confidential — for project reference  |  Page  of 
