# Razorpay RevX-Agent — Hackathon Demo

A high-fidelity autonomous revenue recovery and payment retry dashboard inspired by the supplied reference design. It includes a working React frontend, FastAPI backend, SQLite persistence, live Server-Sent Events webhook simulation, AI copilot simulation, explainable transaction audit trails, recovery-link actions, copy-to-clipboard, and WhatsApp sharing.

## Quick Start (Windows / macOS / Linux)

```bash
python run.py --setup
python run.py
```

Open **http://127.0.0.1:8000**. API docs are available at **http://127.0.0.1:8000/docs**.

## Working Demo Features

- Live Webhook Listener badge backed by an SSE endpoint.
- Dashboard metrics and charts fetched from the backend.
- Failure categorization: Issuer Bank Outage, Card Decline, Network Timeout.
- Searchable priority cases.
- AI strategies and confidence scores generated from seeded decision-engine data.
- AI Assistant quick prompts and free-text transaction explanations.
- Exact backend audit trace for each seeded transaction.
- Recovery payment-link modal.
- Copy recovery link action.
- Send recovery link via WhatsApp action.
- Persistent recovery action audit records in SQLite.
- FastAPI Swagger/OpenAPI docs.
- Responsive desktop/tablet/mobile layout.

## Demo Flow

1. Start the app and point to the green **Live Webhook Listener Active** badge.
2. Explain the 4 top KPIs: intercepted drops, auto-recovered payments, pending links, recovered revenue.
3. Show failure distribution and recovery trend.
4. Open `TXN-8801` from Priority Cases and show its generated recovery link.
5. Click **Copy Link** or **Send via WhatsApp**.
6. In AI Assistant click **Explain TXN-8801 failure** to show the backend audit trace, failure classification, error code, AI analysis, recovery strategy and confidence.
7. Point out the live webhook stream and the bottom cards for realtime processing, decision engine, revenue impact and customer experience.

## Architecture

React/Vite UI → FastAPI REST + SSE → SQLite → deterministic RevX decision/audit engine → recovery actions.

The AI copilot is intentionally deterministic for a reliable hackathon demo. It can later be swapped with an LLM while keeping the same API contract.

## Important

All transactions, amounts, recovery links, system statistics, and AI decisions in this package are demo/synthetic data. No real Razorpay production credentials or private APIs are included.
