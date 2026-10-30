## NEPSE Agentic Trade Assistant

This project now provides a browser-based NEPSE analysis assistant that can:

- rank stocks with strict buy rules (trend, momentum, volume, risk/reward),
- auto-generate entry, target, stop-loss and expected net profit after charges,
- run a recurring scheduler for recommendations,
- send alerts (browser + optional webhook/Telegram/Email/WhatsApp endpoints),
- support manual approval/advice-only safety flow,
- track signal outcomes and performance metrics over time.

## How to run

1. Open `/home/runner/work/schoolpage/schoolpage/index.html` in a browser.
2. Configure profile and risk controls.
3. Optionally set:
   - **Data Feed URL**: JSON array of stocks in format:
     - `[{ "symbol": "NABIL", "closes": [..], "volumes": [..] }]`
   - **Sync API URL**: endpoint for cross-device session sync.
   - Alert channel URLs for Telegram/Email/WhatsApp/Webhook.
4. Click **Run Analysis Now**.

## Notes

- Without a Data Feed URL, the app uses local simulated market data.
- Browser notifications require permission.
- This tool is for analysis and advisory workflows, not broker-side auto order execution.
