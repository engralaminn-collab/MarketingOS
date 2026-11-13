# MarketingOS reference library — full link inventory

**Verified:** 2026-10-26  
**Unique links:** 190  
**Combined upstream stars:** 3,343,067  
**Source of truth:** `scripts/data/reference-links.json` → `docs/link-verification.json` → `src/data/reference-library.ts`

This file is generated. Do not edit it by hand — run:

```bash
node scripts/verify-reference-links.mjs   # re-check every link
node scripts/build-reference-library.mjs  # rebuild data + this document
```

## What the statuses mean

| Status | Meaning |
|---|---|
| Adopted | The pattern is implemented natively in this repository; the evidence column in the app points at the code path. |
| Blueprint | Assessed as valuable for a named module and deliberately scheduled instead of rushed in. |
| Evaluated | Reviewed against product scope; kept as a reference, not integrated. |
| Licence review | Copyleft or unasserted licence/asset terms must be reviewed before any reuse. |
| Access required | The link exists in the request but returned HTTP 403 from the audit account. |
| Verified externally | A live site the build sandbox cannot reach, checked from a general network; the probe result and method are recorded per entry. |

**No upstream source, asset, model weight or dataset is bundled.** A link in this table is a reference, not a dependency.

## Summary

| Measure | Count |
|---|---|
| Unique links | 190 |
| Adopted with evidence | 18 |
| Blueprints | 54 |
| Licence review | 9 |
| Verified | 184 |
| … of which checked outside the build sandbox | 18 |
| Verified but archived upstream | 2 |
| Access required (HTTP 403) | 4 |
| External sites still unverified anywhere | 0 |
| Categories | 12 |

## Adopted patterns and their evidence

- **Firecrawl** (firecrawl/firecrawl) → `src/lib/firecrawl-scraper.ts` — Optional self-hosted Firecrawl adapter with size and timeout limits.
- **Humanizer** (blader/humanizer) → `src/app/api/ai/humanize/route.ts` — De-robotise copy pass with banned-phrase detection.
- **Marketingskills** (coreyhaines31/marketingskills) → `src/lib/marketing-studio.ts` — 52-skill marketing kit catalogue plus diagram and CTA generators.
- **RSSHub** (DIYgod/RSSHub) → `src/components/views/feeds-view.tsx` — Feed source registry, refresh and item ingestion.
- **Open SEO** (every-app/open-seo) → `src/app/api/seo/crawl/route.ts` — Live crawler, topic clustering and on-page audit scoring.
- **Languagetool** (languagetool-org/languagetool) → `src/app/api/ai/grammar-check/route.ts` — Grammar and style findings API; local model by default.
- **Open Enrich** (brightdata/open-enrich) → `src/lib/enrichment.ts` — Provider-agnostic enrichment contract with SSRF guards.
- **Market Intelligence Radar** (guifav/market-intelligence-radar) → `src/components/studio/radar-icp-panel.tsx` — ICP scoring and market radar over competitor and feed signals.
- **N8n Gtm Lead Enrichment** (parthasarathy123/n8n-gtm-lead-enrichment) → `src/components/studio/lead-enrichment-panel.tsx` — Domain-based lead enrichment with confidence and source rows.
- **CRM** (frappe/crm) → `src/components/views/crm-view.tsx` — Drag-and-drop deal pipeline with inline lead status changes.
- **Httpsms** (NdoleStudio/httpsms) → `src/app/api/sms/send/route.ts` — HTTP SMS gateway delivery path with per-message failure records.
- **SMS.Domovina.AI** (domovinatv/sms.domovina.ai) → `src/app/api/sms/send/route.ts` — Self-hosted handset gateway pattern for low-cost SMS.
- **Diagram Design** (cathrynlavery/diagram-design) → `src/app/api/ai/diagram/route.ts` — 14 diagram grammars rendered as Mermaid from structured input.
- **Video Captioner** (WEIFENG2333/VideoCaptioner) → `src/components/studio/video-captioner-panel.tsx` — Transcription plus SRT/VTT export and translation.
- **AI Memory** (akitaonrails/ai-memory) → `src/app/api/ai/memory/route.ts` — Scoped memory records that agents read before answering.
- **Doc GPT Langchain** (Lin-jun-xiang/docGPT-langchain) → `src/app/api/knowledge/wiki/route.ts` — Document-grounded answers returning citations.
- **LLM Wiki** (nashsu/llm_wiki) → `src/app/api/knowledge/wiki/route.ts` — Incremental wiki nodes with summaries and [[WikiLinks]].
- **Open Viking** (volcengine/OpenViking) → `src/app/api/knowledge/wiki/route.ts` — Context retrieval service pattern for agent knowledge.

## Licence review queue

- [idurar/idurar-erp-crm](https://github.com/idurar/idurar-erp-crm) — AGPL-3.0
- [BelledonneCommunications/linphone-iphone](https://github.com/BelledonneCommunications/linphone-iphone) — GPL-3.0
- [elebumm/RedditVideoMakerBot](https://github.com/elebumm/RedditVideoMakerBot) — GPL-3.0
- [Kosinkadink/ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) — GPL-3.0
- [dunossauro/videomaker-helper](https://github.com/dunossauro/videomaker-helper) — GPL-3.0
- [ramon-victor/freegpt-webui](https://github.com/ramon-victor/freegpt-webui) — GPL-3.0 (archived upstream)
- [nikmcfly/MiroFish-Offline](https://github.com/nikmcfly/MiroFish-Offline) — AGPL-3.0
- [siyuan-note/siyuan](https://github.com/siyuan-note/siyuan) — AGPL-3.0
- [vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop) — LGPL-3.0

## Links needing a manual check

- [engralaminn-collab/Ai-Markting-crm](https://github.com/engralaminn-collab/Ai-Markting-crm) — Access required
- [engralaminn-collab/alo-education-uk-final](https://github.com/engralaminn-collab/alo-education-uk-final) — Access required
- [engralaminn-collab/ukvi-ai-markting_n8n](https://github.com/engralaminn-collab/ukvi-ai-markting_n8n) — Access required
- [developer.meta.com](https://developer.meta.com/ai) — Access required

## Verified outside the build sandbox

The build environment only allows outbound traffic to GitHub, npm and PyPI, so other websites were previously recorded as
"not fetched here". Those hosts are now checked from a general network and merged in from
`scripts/data/external-verification.json`; the sandbox's own probe result is preserved per entry.

- [aipraktor.com](https://www.aipraktor.com) — page-fetch, 2026-10-26
- [astryx.atmeta.com](https://astryx.atmeta.com) — host-probe, 2026-10-26
- [buffer.com](https://buffer.com) — page-fetch, 2026-10-26
- [cline.bot](https://cline.bot) — host-probe, 2026-10-26
- [coder.qwen.ai](https://coder.qwen.ai) — host-probe, 2026-10-26
- [enerpize.com](https://www.enerpize.com) — page-fetch, 2026-10-26
- [hatchable.com](https://hatchable.com) — host-probe, 2026-10-26
- [hetrixtools.com](https://hetrixtools.com) — host-probe, 2026-10-26
- [join.supercool.com](https://join.supercool.com) — page-fetch, 2026-10-26
- [larksuite.com](https://www.larksuite.com) — host-probe, 2026-10-26
- [mat3ra.com](https://mat3ra.com) — page-fetch, 2026-10-26
- [mureka.ai](https://www.mureka.ai) — host-probe, 2026-10-26
- [openrouter.ai](https://openrouter.ai) — host-probe, 2026-10-26
- [openrouter.ai](https://openrouter.ai/blog/tutorials/build-tool-calling-agent-loop) — page-fetch, 2026-10-26
- [platform.mat3ra.com](https://platform.mat3ra.com) — host-probe, 2026-10-26
- [refine.ink](https://www.refine.ink) — host-probe, 2026-10-26
- [stackoverflow.com](https://stackoverflow.com) — host-probe, 2026-10-26
- [supercool.com](https://supercool.com) — page-fetch, 2026-10-26

Audit of a submitted link batch (duplicates, typos and all):

```bash
node scripts/audit-submitted-links.mjs scripts/data/submitted-links-2026-10-26.txt
```
→ `docs/SUBMITTED-LINKS-AUDIT.md`

## Renamed upstream (links still resolve)

- [Gitlawb/openclaude](https://github.com/Gitlawb/openclaude) → now served as [Twigpine/openclaude](https://github.com/Twigpine/openclaude)

## Archived upstream (still referenced)

- [ramon-victor/freegpt-webui](https://github.com/ramon-victor/freegpt-webui) — 5599 stars
- [huggingface/education-toolkit](https://github.com/huggingface/education-toolkit) — 389 stars

## Full inventory by category

### Marketing, SEO & Growth (19)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | SMS, VoIP & Scraper | Adopted | 195566 | AGPL-3.0 | Verified |
| 2 | [blader/humanizer](https://github.com/blader/humanizer) | Marketing Studio | Adopted | 60913 | MIT | Verified |
| 3 | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | Marketing Studio | Adopted | 56640 | MIT | Verified |
| 4 | [TryGhost/Ghost](https://github.com/TryGhost/Ghost) | Content & Queue | Blueprint | 55611 | MIT | Verified |
| 5 | [DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) | News Feeds | Adopted | 46672 | AGPL-3.0 | Verified |
| 6 | [umami-software/umami](https://github.com/umami-software/umami) | Analytics & UTM | Blueprint | 39710 | MIT | Verified |
| 7 | [every-app/open-seo](https://github.com/every-app/open-seo) | SEO & Live Crawler | Adopted | 25037 | MIT | Verified |
| 8 | [languagetool-org/languagetool](https://github.com/languagetool-org/languagetool) | Marketing Studio | Adopted | 15197 | LGPL-2.1 | Verified |
| 9 | [songguoxs/gpt4o-image-prompts](https://github.com/songguoxs/gpt4o-image-prompts) | Media Studio | Evaluated | 3862 | NOASSERTION | Verified |
| 10 | [firecrawl/web-agent](https://github.com/firecrawl/web-agent) | SMS, VoIP & Scraper | Blueprint | 1250 | MIT | Verified |
| 11 | [BraaMohammed/bricks](https://github.com/BraaMohammed/bricks) | Marketing Studio | Evaluated | 71 | NOASSERTION | Verified |
| 12 | [ioi-labs/molx](https://github.com/ioi-labs/molx) | SMS, VoIP & Scraper | Blueprint | 24 | NOASSERTION | Verified |
| 13 | [clawnify/OpenProspector](https://github.com/clawnify/OpenProspector) | CRM | Blueprint | 18 | MIT | Verified |
| 14 | [brightdata/open-enrich](https://github.com/brightdata/open-enrich) | CRM | Adopted | 12 | NOASSERTION | Verified |
| 15 | [guifav/market-intelligence-radar](https://github.com/guifav/market-intelligence-radar) | Market Intelligence | Adopted | 4 | MIT | Verified |
| 16 | [workwithlos-ui/dave](https://github.com/workwithlos-ui/dave) | Marketing Studio | Evaluated | 0 | MIT | Verified |
| 17 | [mohamed11sk/Email-markting](https://github.com/mohamed11sk/Email-markting) | Marketing Studio | Evaluated | 0 | NOASSERTION | Verified |
| 18 | [knsoftic/Email_Markting](https://github.com/knsoftic/Email_Markting) | Marketing Studio | Evaluated | 0 | NOASSERTION | Verified |
| 19 | [parthasarathy123/n8n-gtm-lead-enrichment](https://github.com/parthasarathy123/n8n-gtm-lead-enrichment) | CRM | Adopted | 0 | MIT | Verified |

### CRM & Sales (17)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [twentyhq/twenty](https://github.com/twentyhq/twenty) | CRM | Blueprint | 59802 | NOASSERTION | Verified |
| 2 | [trycompai/crm](https://github.com/trycompai/crm) | CRM | Evaluated | 11690 | MIT | Verified |
| 3 | [crmeb/CRMEB](https://github.com/crmeb/CRMEB) | CRM | Evaluated | 9443 | Apache-2.0 | Verified |
| 4 | [idurar/idurar-erp-crm](https://github.com/idurar/idurar-erp-crm) | Finance | Licence review | 8920 | AGPL-3.0 | Verified |
| 5 | [melgarafael/DeskcommCRM](https://github.com/melgarafael/DeskcommCRM) | CRM | Evaluated | 4855 | MIT | Verified |
| 6 | [frappe/crm](https://github.com/frappe/crm) | CRM | Adopted | 3861 | AGPL-3.0 | Verified |
| 7 | [fatfreecrm/fat_free_crm](https://github.com/fatfreecrm/fat_free_crm) | CRM | Evaluated | 3632 | NOASSERTION | Verified |
| 8 | [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) | CRM | Blueprint | 2617 | MIT | Verified |
| 9 | [Django-CRM/Django-CRM](https://github.com/Django-CRM/Django-CRM) | CRM | Evaluated | 2461 | MIT | Verified |
| 10 | [oroinc/crm-application](https://github.com/oroinc/crm-application) | CRM | Evaluated | 1016 | NOASSERTION | Verified |
| 11 | [ChurchCRM/CRM](https://github.com/ChurchCRM/CRM) | CRM | Evaluated | 974 | MIT | Verified |
| 12 | [VonHoltenCodes/SlowBooks-Pro-2026](https://github.com/VonHoltenCodes/SlowBooks-Pro-2026) | Finance | Evaluated | 820 | NOASSERTION | Verified |
| 13 | [thu-ml/CRM](https://github.com/thu-ml/CRM) | CRM | Evaluated | 701 | MIT | Verified |
| 14 | [oroinc/crm](https://github.com/oroinc/crm) | CRM | Evaluated | 688 | NOASSERTION | Verified |
| 15 | [dennisivy/crash-course-CRM](https://github.com/dennisivy/crash-course-CRM) | CRM | Evaluated | 583 | NOASSERTION | Verified |
| 16 | [Odoo-mobile/crm](https://github.com/Odoo-mobile/crm) | CRM | Evaluated | 149 | NOASSERTION | Verified |
| 17 | [engralaminn-collab/Ai-Markting-crm](https://github.com/engralaminn-collab/Ai-Markting-crm) | CRM | Access required | — | — | Access required |

### Conversational AI & Chat (10)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | CRM | Blueprint | 38346 | NOASSERTION | Verified |
| 2 | [cometchat/cometchat-uikit-react-native](https://github.com/cometchat/cometchat-uikit-react-native) | Messages | Blueprint | 939 | NOASSERTION | Verified |
| 3 | [cometchat/cometchat-uikit-react](https://github.com/cometchat/cometchat-uikit-react) | Messages | Blueprint | 921 | NOASSERTION | Verified |
| 4 | [cometchat/cometchat-uikit-android](https://github.com/cometchat/cometchat-uikit-android) | Messages | Evaluated | 776 | MIT | Verified |
| 5 | [cometchat/cometchat-uikit-ios](https://github.com/cometchat/cometchat-uikit-ios) | Messages | Evaluated | 638 | NOASSERTION | Verified |
| 6 | [cometchat/cometchat-skills](https://github.com/cometchat/cometchat-skills) | AI Command | Evaluated | 155 | MIT | Verified |
| 7 | [cometchat/docs-mcp](https://github.com/cometchat/docs-mcp) | Knowledge Wiki & RAG | Blueprint | 130 | Apache-2.0 | Verified |
| 8 | [sibnerian/electron-promise-ipc](https://github.com/sibnerian/electron-promise-ipc) | Integrations | Blueprint | 69 | MIT | Verified |
| 9 | [ketanyekale/android-java-chat-app](https://github.com/ketanyekale/android-java-chat-app) | Messages | Evaluated | 1 | NOASSERTION | Verified |
| 10 | [cometchat](https://github.com/cometchat) | Messages | Evaluated | — | — | Verified |

### Voice, Telephony & Contact Center (15)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [debpalash/VoiceStudio](https://github.com/debpalash/VoiceStudio) | Media Studio | Blueprint | 88381 | AGPL-3.0 | Verified |
| 2 | [microsoft/call-center-ai](https://github.com/microsoft/call-center-ai) | SMS, VoIP & Scraper | Blueprint | 6689 | Apache-2.0 | Verified |
| 3 | [NdoleStudio/httpsms](https://github.com/NdoleStudio/httpsms) | SMS, VoIP & Scraper | Adopted | 6108 | AGPL-3.0 | Verified |
| 4 | [PennyroyalTea/gibberlink](https://github.com/PennyroyalTea/gibberlink) | AI Command | Evaluated | 4920 | MIT | Verified |
| 5 | [jitsi/jitsi-videobridge](https://github.com/jitsi/jitsi-videobridge) | Messages | Blueprint | 3107 | Apache-2.0 | Verified |
| 6 | [video-db/call.md](https://github.com/video-db/call.md) | Knowledge Wiki & RAG | Blueprint | 1836 | NOASSERTION | Verified |
| 7 | [BelledonneCommunications/linphone-iphone](https://github.com/BelledonneCommunications/linphone-iphone) | SMS, VoIP & Scraper | Licence review | 663 | GPL-3.0 | Verified |
| 8 | [rasonyang/ai-native-callcenter](https://github.com/rasonyang/ai-native-callcenter) | SMS, VoIP & Scraper | Blueprint | 404 | Apache-2.0 | Verified |
| 9 | [0perationPrivacy/VoIP](https://github.com/0perationPrivacy/VoIP) | SMS, VoIP & Scraper | Blueprint | 298 | GPL-3.0 | Verified |
| 10 | [amulchapla/AI-Powered-Call-Center-Intelligence](https://github.com/amulchapla/AI-Powered-Call-Center-Intelligence) | Market Intelligence | Blueprint | 268 | MIT | Verified |
| 11 | [developerspace-samples/WebRTC-Kotlin-Sample](https://github.com/developerspace-samples/WebRTC-Kotlin-Sample) | SMS, VoIP & Scraper | Evaluated | 117 | MIT | Verified |
| 12 | [CALLE-AI/awesome-phone-call-agents](https://github.com/CALLE-AI/awesome-phone-call-agents) | SMS, VoIP & Scraper | Blueprint | 112 | MIT | Verified |
| 13 | [NdoleStudio/httpsms-node](https://github.com/NdoleStudio/httpsms-node) | SMS, VoIP & Scraper | Evaluated | 32 | MIT | Verified |
| 14 | [developerspace-samples/VoIP-Call-Sample](https://github.com/developerspace-samples/VoIP-Call-Sample) | SMS, VoIP & Scraper | Evaluated | 32 | Apache-2.0 | Verified |
| 15 | [domovinatv/sms.domovina.ai](https://github.com/domovinatv/sms.domovina.ai) | SMS, VoIP & Scraper | Adopted | 3 | NOASSERTION | Verified |

### Content, Video & Media (39)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [ytdl-org/youtube-dl](https://github.com/ytdl-org/youtube-dl) | Media Studio | Evaluated | 141396 | Unlicense | Verified |
| 2 | [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | Media Studio | Blueprint | 135353 | MIT | Verified |
| 3 | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | Media Studio | Blueprint | 72783 | Apache-2.0 | Verified |
| 4 | [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | Media Studio | Blueprint | 67770 | NOASSERTION | Verified |
| 5 | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | Media Studio | Adopted | 61290 | MIT | Verified |
| 6 | [ATH-MaaS/Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) | Media Studio | Evaluated | 29411 | Apache-2.0 | Verified |
| 7 | [CapSoftware/Cap](https://github.com/CapSoftware/Cap) | Media Studio | Evaluated | 23821 | NOASSERTION | Verified |
| 8 | [bradautomates/claude-video](https://github.com/bradautomates/claude-video) | Media Studio | Evaluated | 19304 | MIT | Verified |
| 9 | [leandromoreira/digital_video_introduction](https://github.com/leandromoreira/digital_video_introduction) | Media Studio | Evaluated | 16374 | BSD-3-Clause | Verified |
| 10 | [WEIFENG2333/VideoCaptioner](https://github.com/WEIFENG2333/VideoCaptioner) | Media Studio | Adopted | 16370 | GPL-3.0 | Verified |
| 11 | [YaoFANGUK/video-subtitle-remover](https://github.com/YaoFANGUK/video-subtitle-remover) | Media Studio | Evaluated | 13450 | Apache-2.0 | Verified |
| 12 | [zai-org/CogVideo](https://github.com/zai-org/CogVideo) | Media Studio | Evaluated | 13111 | Apache-2.0 | Verified |
| 13 | [Tencent-Hunyuan/HunyuanVideo](https://github.com/Tencent-Hunyuan/HunyuanVideo) | Media Studio | Evaluated | 12669 | NOASSERTION | Verified |
| 14 | [elebumm/RedditVideoMakerBot](https://github.com/elebumm/RedditVideoMakerBot) | Media Studio | Licence review | 12557 | GPL-3.0 | Verified |
| 15 | [3b1b/videos](https://github.com/3b1b/videos) | Media Studio | Evaluated | 11414 | NOASSERTION | Verified |
| 16 | [Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video) | Media Studio | Evaluated | 11186 | Apache-2.0 | Verified |
| 17 | [meituan-longcat/LongCat-Video](https://github.com/meituan-longcat/LongCat-Video) | Media Studio | Evaluated | 9260 | MIT | Verified |
| 18 | [MeiGen-AI/InfiniteTalk](https://github.com/MeiGen-AI/InfiniteTalk) | Media Studio | Blueprint | 8181 | Apache-2.0 | Verified |
| 19 | [OpenTalker/video-retalking](https://github.com/OpenTalker/video-retalking) | Media Studio | Blueprint | 7294 | Apache-2.0 | Verified |
| 20 | [0voice/audio_video_streaming](https://github.com/0voice/audio_video_streaming) | Media Studio | Evaluated | 6260 | NOASSERTION | Verified |
| 21 | [Augani/openreel-video](https://github.com/Augani/openreel-video) | Media Studio | Evaluated | 5470 | MIT | Verified |
| 22 | [MarkTechStation/VideoCode](https://github.com/MarkTechStation/VideoCode) | Media Studio | Evaluated | 4297 | NOASSERTION | Verified |
| 23 | [HKUDS/VideoAgent](https://github.com/HKUDS/VideoAgent) | Media Studio | Evaluated | 1973 | MIT | Verified |
| 24 | [Kosinkadink/ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) | Media Studio | Licence review | 1898 | GPL-3.0 | Verified |
| 25 | [HITsz-TMG/VideoClaw](https://github.com/HITsz-TMG/VideoClaw) | Media Studio | Evaluated | 1878 | MIT | Verified |
| 26 | [qdrzwd/VideoRecorder](https://github.com/qdrzwd/VideoRecorder) | Media Studio | Evaluated | 1792 | Apache-2.0 | Verified |
| 27 | [LoSealL/VideoSuperResolution](https://github.com/LoSealL/VideoSuperResolution) | Media Studio | Evaluated | 1685 | MIT | Verified |
| 28 | [GAIR-NLP/LiveTalk](https://github.com/GAIR-NLP/LiveTalk) | Media Studio | Blueprint | 353 | NOASSERTION | Verified |
| 29 | [HM-RunningHub/ComfyUI_RH_APICall](https://github.com/HM-RunningHub/ComfyUI_RH_APICall) | Media Studio | Evaluated | 303 | NOASSERTION | Verified |
| 30 | [Onyx-Dev-Labs/doodle-note](https://github.com/Onyx-Dev-Labs/doodle-note) | Knowledge Wiki & RAG | Blueprint | 183 | MIT | Verified |
| 31 | [dunossauro/videomaker-helper](https://github.com/dunossauro/videomaker-helper) | Media Studio | Licence review | 136 | GPL-3.0 | Verified |
| 32 | [burhankocabiyik/videomaker](https://github.com/burhankocabiyik/videomaker) | Media Studio | Evaluated | 28 | NOASSERTION | Verified |
| 33 | [wtz2017/VideoMaker](https://github.com/wtz2017/VideoMaker) | Media Studio | Blueprint | 20 | NOASSERTION | Verified |
| 34 | [WuTao-CS/VideoMaker](https://github.com/WuTao-CS/VideoMaker) | Media Studio | Evaluated | 17 | NOASSERTION | Verified |
| 35 | [shubhamdevhouse/Animated-VideoMaker](https://github.com/shubhamdevhouse/Animated-VideoMaker) | Media Studio | Evaluated | 13 | MIT | Verified |
| 36 | [viniciusenari/slideshow-videomaker](https://github.com/viniciusenari/slideshow-videomaker) | Media Studio | Evaluated | 11 | MIT | Verified |
| 37 | [seed0001/videoMaker](https://github.com/seed0001/videoMaker) | Media Studio | Evaluated | 2 | NOASSERTION | Verified |
| 38 | [Bilal-Belli/videoMakerBOT](https://github.com/Bilal-Belli/videoMakerBOT) | Media Studio | Evaluated | 2 | MIT | Verified |
| 39 | [Nncstudio/VideoMakerPro](https://github.com/Nncstudio/VideoMakerPro) | Media Studio | Evaluated | 2 | NOASSERTION | Verified |

### AI Models, Agents & Skills (33)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [affaan-m/ECC](https://github.com/affaan-m/ECC) | AI Command | Blueprint | 289454 | MIT | Verified |
| 2 | [tt-a1i/archify](https://github.com/tt-a1i/archify) | Workflow Studio | Blueprint | 89658 | Apache-2.0 | Verified |
| 3 | [ruvnet/ruflo](https://github.com/ruvnet/ruflo) | Workflow Studio | Blueprint | 79443 | MIT | Verified |
| 4 | [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) | AI Command | Blueprint | 71026 | MIT | Verified |
| 5 | [cline/cline](https://github.com/cline/cline) | AI Command | Evaluated | 70882 | Apache-2.0 | Verified |
| 6 | [jingyaogong/minimind](https://github.com/jingyaogong/minimind) | AI Command | Evaluated | 64443 | Apache-2.0 | Verified |
| 7 | [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) | Market Intelligence | Blueprint | 60312 | NOASSERTION | Verified |
| 8 | [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | AI Command | Blueprint | 54737 | MIT | Verified |
| 9 | [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) | AI Command | Blueprint | 41542 | MIT | Verified |
| 10 | [google-research/timesfm](https://github.com/google-research/timesfm) | Analytics & UTM | Blueprint | 34781 | Apache-2.0 | Verified |
| 11 | [Gitlawb/openclaude](https://github.com/Gitlawb/openclaude) | AI Command | Evaluated | 34162 | NOASSERTION | Verified |
| 12 | [mksglu/context-mode](https://github.com/mksglu/context-mode) | AI Command | Blueprint | 32387 | NOASSERTION | Verified |
| 13 | [cursor/plugins](https://github.com/cursor/plugins) | Integrations | Blueprint | 14152 | NOASSERTION | Verified |
| 14 | [akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory) | Knowledge Wiki & RAG | Adopted | 13712 | MIT | Verified |
| 15 | [zai-org/GLM-5](https://github.com/zai-org/GLM-5) | Free AI Agent Hub | Blueprint | 7389 | Apache-2.0 | Verified |
| 16 | [ramon-victor/freegpt-webui](https://github.com/ramon-victor/freegpt-webui) | Free AI Agent Hub | Licence review | 5599 | GPL-3.0 | Verified · archived |
| 17 | [mattpocock/dictionary-of-ai-coding](https://github.com/mattpocock/dictionary-of-ai-coding) | Knowledge Wiki & RAG | Evaluated | 5282 | NOASSERTION | Verified |
| 18 | [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) | Integrations | Blueprint | 4770 | Apache-2.0 | Verified |
| 19 | [JetBrains/go-modern-guidelines](https://github.com/JetBrains/go-modern-guidelines) | AI Command | Evaluated | 3895 | Apache-2.0 | Verified |
| 20 | [alsk1992/CloddsBot](https://github.com/alsk1992/CloddsBot) | AI Command | Evaluated | 3008 | MIT | Verified |
| 21 | [nikmcfly/MiroFish-Offline](https://github.com/nikmcfly/MiroFish-Offline) | Market Intelligence | Licence review | 2661 | AGPL-3.0 | Verified |
| 22 | [Lin-jun-xiang/docGPT-langchain](https://github.com/Lin-jun-xiang/docGPT-langchain) | Knowledge Wiki & RAG | Adopted | 261 | MIT | Verified |
| 23 | [teremterem/claude-code-gpt-5-codex](https://github.com/teremterem/claude-code-gpt-5-codex) | AI Command | Evaluated | 239 | MIT | Verified |
| 24 | [GetGoAPI/Free-GPT-Grok-Gemini-Claude-API](https://github.com/GetGoAPI/Free-GPT-Grok-Gemini-Claude-API) | Free AI Agent Hub | Evaluated | 216 | MIT | Verified |
| 25 | [Kayforkind/reimagine-it](https://github.com/Kayforkind/reimagine-it) | Media Studio | Evaluated | 212 | MIT | Verified |
| 26 | [EfficientStreet/youtube-subscriptions-ingest](https://github.com/EfficientStreet/youtube-subscriptions-ingest) | News Feeds | Evaluated | 187 | MIT | Verified |
| 27 | [meta-models/meta-model-cookbook](https://github.com/meta-models/meta-model-cookbook) | Free AI Agent Hub | Evaluated | 183 | MIT | Verified |
| 28 | [EfficientStreet/hindsight](https://github.com/EfficientStreet/hindsight) | Knowledge Wiki & RAG | Blueprint | 174 | MIT | Verified |
| 29 | [timharris707/modeldeck](https://github.com/timharris707/modeldeck) | Free AI Agent Hub | Blueprint | 118 | NOASSERTION | Verified |
| 30 | [templetongroup/radiant](https://github.com/templetongroup/radiant) | AI Command | Blueprint | 117 | MIT | Verified |
| 31 | [sulabhdubey/rta-smriti-brain](https://github.com/sulabhdubey/rta-smriti-brain) | Knowledge Wiki & RAG | Blueprint | 94 | MIT | Verified |
| 32 | [Artistsyn/cortex_suite](https://github.com/Artistsyn/cortex_suite) | Knowledge Wiki & RAG | Blueprint | 84 | NOASSERTION | Verified |
| 33 | [unorouter/unorouter](https://github.com/unorouter/unorouter) | Free AI Agent Hub | Blueprint | 21 | AGPL-3.0 | Verified |

### Knowledge, Docs & Data (3)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [public-apis/public-apis](https://github.com/public-apis/public-apis) | Integrations | Evaluated | 492352 | MIT | Verified |
| 2 | [siyuan-note/siyuan](https://github.com/siyuan-note/siyuan) | Knowledge Wiki & RAG | Licence review | 46943 | AGPL-3.0 | Verified |
| 3 | [nashsu/llm_wiki](https://github.com/nashsu/llm_wiki) | Knowledge Wiki & RAG | Adopted | 20991 | NOASSERTION | Verified |

### Automation, ERP & Business Ops (7)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [dani-garcia/vaultwarden](https://github.com/dani-garcia/vaultwarden) | Settings | Blueprint | 69707 | AGPL-3.0 | Verified |
| 2 | [ToolJet/ToolJet](https://github.com/ToolJet/ToolJet) | Workflow Studio | Blueprint | 41128 | AGPL-3.0 | Verified |
| 3 | [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | Knowledge Wiki & RAG | Adopted | 40876 | AGPL-3.0 | Verified |
| 4 | [nextcloud/server](https://github.com/nextcloud/server) | Settings | Blueprint | 37302 | AGPL-3.0 | Verified |
| 5 | [vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop) | AI Command | Licence review | 7324 | LGPL-3.0 | Verified |
| 6 | [monkscode/Natural-Language-to-Robot-Framework](https://github.com/monkscode/Natural-Language-to-Robot-Framework) | Workflow Studio | Blueprint | 17 | Apache-2.0 | Verified |
| 7 | [iamakshayshar/AITestCaseGenerator](https://github.com/iamakshayshar/AITestCaseGenerator) | Workflow Studio | Blueprint | 5 | MIT | Verified |

### Education & Study Abroad (12)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [bugcrowd/bugcrowd_university](https://github.com/bugcrowd/bugcrowd_university) | Knowledge Wiki & RAG | Evaluated | 2807 | CC-BY-4.0 | Verified |
| 2 | [nwuzmedoutlook/university](https://github.com/nwuzmedoutlook/university) | Students | Evaluated | 1230 | Apache-2.0 | Verified |
| 3 | [xiaochong/hi-kid](https://github.com/xiaochong/hi-kid) | Students | Evaluated | 1169 | MIT | Verified |
| 4 | [huggingface/education-toolkit](https://github.com/huggingface/education-toolkit) | Study Abroad & UKVI | Blueprint | 389 | Apache-2.0 | Verified · archived |
| 5 | [xckevin/magic-english-buddy](https://github.com/xckevin/magic-english-buddy) | Media Studio | Evaluated | 316 | NOASSERTION | Verified |
| 6 | [graykode/toeicbert](https://github.com/graykode/toeicbert) | Exams & Results | Evaluated | 127 | MIT | Verified |
| 7 | [TheExplainthis/ChatGPT-AI-English-Tutor](https://github.com/TheExplainthis/ChatGPT-AI-English-Tutor) | AI Command | Evaluated | 100 | MIT | Verified |
| 8 | [arupdas0825/studytra](https://github.com/arupdas0825/studytra) | Study Abroad & UKVI | Blueprint | 27 | NOASSERTION | Verified |
| 9 | [Bhawana0218/NextStep-Abroad](https://github.com/Bhawana0218/NextStep-Abroad) | Study Abroad & UKVI | Blueprint | 2 | NOASSERTION | Verified |
| 10 | [nabaleducation/EducationConsultancyWebsite](https://github.com/nabaleducation/EducationConsultancyWebsite) | Study Abroad & UKVI | Evaluated | 0 | NOASSERTION | Verified |
| 11 | [engralaminn-collab/alo-education-uk-final](https://github.com/engralaminn-collab/alo-education-uk-final) | Study Abroad & UKVI | Access required | — | — | Access required |
| 12 | [engralaminn-collab/ukvi-ai-markting_n8n](https://github.com/engralaminn-collab/ukvi-ai-markting_n8n) | Study Abroad & UKVI | Access required | — | — | Access required |

### Developer Tooling & Infrastructure (7)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [omacom/omarchy](https://github.com/omacom/omarchy) | Settings | Evaluated | 45729 | MIT | Verified |
| 2 | [fmtlib/fmt](https://github.com/fmtlib/fmt) | Integrations | Evaluated | 25895 | MIT | Verified |
| 3 | [AprilNEA/OpenLogi](https://github.com/AprilNEA/OpenLogi) | Settings | Evaluated | 24157 | Apache-2.0 | Verified |
| 4 | [Lakr233/vphone-cli](https://github.com/Lakr233/vphone-cli) | Settings | Evaluated | 16030 | MIT | Verified |
| 5 | [armory3d/armorpaint](https://github.com/armory3d/armorpaint) | Media Studio | Evaluated | 5417 | NOASSERTION | Verified |
| 6 | [YutaroHayakawa/ipftrace2](https://github.com/YutaroHayakawa/ipftrace2) | SMS, VoIP & Scraper | Evaluated | 411 | NOASSERTION | Verified |
| 7 | [tinystruct/smalltalk](https://github.com/tinystruct/smalltalk) | AI Command | Evaluated | 354 | NOASSERTION | Verified |

### Websites & Platforms (19)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [aipraktor.com](https://www.aipraktor.com) | Workflow Studio | Evaluated | — | — | Verified |
| 2 | [astryx.atmeta.com](https://astryx.atmeta.com) | Media Studio | Evaluated | — | — | Verified |
| 3 | [buffer.com](https://buffer.com) | Content & Queue | Evaluated | — | — | Verified |
| 4 | [cline.bot](https://cline.bot) | AI Command | Evaluated | — | — | Verified |
| 5 | [coder.qwen.ai](https://coder.qwen.ai) | AI Command | Evaluated | — | — | Verified |
| 6 | [developer.meta.com](https://developer.meta.com/ai) | Free AI Agent Hub | Access required | — | — | Access required |
| 7 | [enerpize.com](https://www.enerpize.com) | Finance | Evaluated | — | — | Verified |
| 8 | [hatchable.com](https://hatchable.com) | Marketing Studio | Evaluated | — | — | Verified |
| 9 | [hetrixtools.com](https://hetrixtools.com) | SEO & Live Crawler | Evaluated | — | — | Verified |
| 10 | [join.supercool.com](https://join.supercool.com) | Marketing Studio | Evaluated | — | — | Verified |
| 11 | [larksuite.com](https://www.larksuite.com) | Workflow Studio | Evaluated | — | — | Verified |
| 12 | [mat3ra.com](https://mat3ra.com) | AI Command | Evaluated | — | — | Verified |
| 13 | [mureka.ai](https://www.mureka.ai) | Media Studio | Evaluated | — | — | Verified |
| 14 | [openrouter.ai](https://openrouter.ai) | Free AI Agent Hub | Evaluated | — | — | Verified |
| 15 | [openrouter.ai](https://openrouter.ai/blog/tutorials/build-tool-calling-agent-loop) | AI Command | Evaluated | — | — | Verified |
| 16 | [platform.mat3ra.com](https://platform.mat3ra.com) | AI Command | Evaluated | — | — | Verified |
| 17 | [refine.ink](https://www.refine.ink) | Marketing Studio | Evaluated | — | — | Verified |
| 18 | [stackoverflow.com](https://stackoverflow.com) | Knowledge Wiki & RAG | Evaluated | — | — | Verified |
| 19 | [supercool.com](https://supercool.com) | Marketing Studio | Evaluated | — | — | Verified |

### Community & Credits (9)

| # | Reference | Module | Status | Stars | Licence | Link check |
|---|---|---|---|---|---|---|
| 1 | [CallumIO](https://github.com/CallumIO) | Ecosystem | Evaluated | — | — | Verified |
| 2 | [CordlessCoder](https://github.com/CordlessCoder) | Ecosystem | Evaluated | — | — | Verified |
| 3 | [cyteon](https://github.com/cyteon) | Ecosystem | Evaluated | — | — | Verified |
| 4 | [FreebieII](https://github.com/FreebieII) | Ecosystem | Evaluated | — | — | Verified |
| 5 | [JasonLovesDoggo](https://github.com/JasonLovesDoggo) | Ecosystem | Evaluated | — | — | Verified |
| 6 | [elebumm](https://github.com/elebumm) | Ecosystem | Evaluated | — | — | Verified |
| 7 | [LukaHietala](https://github.com/LukaHietala) | Ecosystem | Evaluated | — | — | Verified |
| 8 | [OpenSourceSimon](https://github.com/OpenSourceSimon) | Ecosystem | Evaluated | — | — | Verified |
| 9 | [electro199](https://github.com/electro199) | Ecosystem | Evaluated | — | — | Verified |

## Method and limits

- Repeats in the request were de-duplicated by canonical URL, keeping the most specific note.
- GitHub repositories and profiles were checked through the REST API for description, stars, licence, language, archive state and last push time. HTTP 403 is recorded, never hidden.
- GitHub org links are recorded without a metadata lookup.
- Non-GitHub sites were probed once; the sandbox egress allowlist blocks them, so they are marked external rather than dead.
- Licence metadata is a signal, not a legal opinion. Model weights, datasets, media and trademarks are licensed separately from code.
