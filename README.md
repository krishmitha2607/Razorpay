# ⚡ RevX-Agent
## Autonomous AI Revenue Recovery Engine

> **Detect. Decide. Recover.**

RevX-Agent is an autonomous revenue-recovery intelligence layer designed to transform failed digital payments into **prioritized, explainable, and actionable recovery opportunities**.

Instead of treating every payment failure with the same retry logic, RevX analyzes **why a transaction failed, how likely it is to recover, when recovery should be attempted, and which recovery strategy should be used**.

The result is an end-to-end workflow:

**Payment Failure → Root-Cause Analysis → Recovery Intelligence → Strategy Selection → Recovery Action → Revenue Protected**

---

## 🎯 Hackathon Track

**Track 3 — AI Revenue Recovery**

### The Question We Asked

Modern payment platforms already provide sophisticated infrastructure for payment acceptance, routing, checkout optimization, payment links, and failure visibility.

We wanted to explore the next layer:

> **What if a failed payment could intelligently determine its own best recovery path?**

Different failures require different responses.

An issuer-bank outage may require waiting.

A network timeout may justify a smart retry.

A recoverable card failure may require an alternate payment method or payment link.

RevX-Agent converts these failure signals into **context-aware recovery decisions**.

---

# 💡 The Problem

A failed payment is not necessarily permanently lost revenue.

However, treating all failures with generic retry logic can lead to:

- Repeated unsuccessful attempts
- Increased customer friction
- Poor prioritization of high-value recovery opportunities
- Additional operational effort
- Recoverable transactions being abandoned

The important questions are not simply:

> **Should this payment be retried?**

They are:

- Why did the payment fail?
- Is the failure recoverable?
- What is its recovery probability?
- When should recovery be attempted?
- Which recovery strategy is appropriate?
- How much revenue can potentially be recovered?

---

# 🚀 Proposed Solution

**RevX-Agent** introduces an autonomous decision layer for post-failure payment recovery.

For every failed transaction, RevX can:

1. Intercept the payment failure event
2. Classify the failure
3. Identify the probable root cause
4. Evaluate transaction signals
5. Estimate recovery probability
6. Generate an AI confidence score
7. Calculate expected recoverable revenue
8. Select an appropriate recovery strategy
9. Generate or schedule the recovery action
10. Record the complete decision in an audit trail

This transforms:

**Failed Transaction → Recovery Opportunity**

---

# 🧠 Recovery Decision Engine

RevX does not treat every failure equally.

| Failure Scenario | RevX Recovery Strategy |
|---|---|
| Issuer Bank Outage | Delayed Retry |
| Network Timeout | Smart Retry |
| Card Soft Decline | Alternate Payment Route |
| Recoverable Card Failure | Recovery Payment Link |

The goal is to choose the **right recovery action at the right time**, rather than blindly retrying every failed transaction.

---

# 💰 Revenue Intelligence

RevX goes beyond displaying failed-payment amounts.

It estimates the **expected recoverable value** of a transaction.

### Example

```text
Transaction Value          ₹1,25,000
Recovery Probability              86%
Expected Recoverable Value ₹1,07,500
AI Decision Confidence            94%
```

This allows merchants to prioritize failures based on **recovery potential**, not simply transaction value.

---

# 🎬 Hero Demo — TXN-8801

Our primary demo scenario demonstrates the complete RevX recovery lifecycle.

```text
₹1,25,000 Payment
        ↓
Payment Failure Intercepted
        ↓
Issuer Bank Outage Identified
        ↓
86% Recovery Probability
        ↓
94% Decision Confidence
        ↓
Delayed Retry Strategy Selected
        ↓
12-Minute Retry Window
        ↓
Recovery Link Generated
        ↓
Recovery Initiated
        ↓
PAYMENT RECOVERED
        ↓
₹1,25,000 Revenue Protected
        ↓
Complete Audit Trail
```

This provides judges with a single end-to-end demonstration of the system rather than isolated dashboard features.

---

# ✨ Key Features

### 🤖 Autonomous Recovery Intelligence
Failure classification, root-cause analysis, recovery scoring, strategy selection, and recovery orchestration.

### 📊 Recovery Analytics
Revenue at risk, recovered revenue, recovery probability, expected recoverable value, failure distribution, and recovery trends.

### 🧠 AI Recovery Copilot
Natural-language investigation of transactions, including failure cause, error signals, recovery strategy, confidence, and retry window.

### 🔗 Recovery Payment Links
Generate recovery links and trigger recovery actions directly from the transaction workflow.

### 💬 WhatsApp Recovery
Recovery links can be shared through WhatsApp from the dashboard.

### ⚡ Live Webhook Simulation
Server-Sent Events simulate real-time payment and recovery events.

### 🔍 Explainable Decisions
RevX exposes the reasoning and signals behind its recovery strategy.

### 📜 Complete Audit Trail
Failure detection, analysis, strategy selection, retry actions, and recovery outcomes are recorded.

### 🎥 Judge Demo Mode
A guided one-click demonstration visualizes the complete autonomous recovery lifecycle.

### ♻️ Judge Demo Reset
The environment can be restored to its initial state for reliable repeated demonstrations.

---

# 🏗️ Architecture

```text
                PAYMENT EVENT
                      │
                      ▼
             WEBHOOK INGESTION
                      │
                      ▼
           FAILURE CLASSIFICATION
                      │
                      ▼
            REVX DECISION ENGINE
                      │
             ┌────────┴────────┐
             ▼                 ▼
       ROOT-CAUSE         RECOVERY
        ANALYSIS          PROBABILITY
             │                 │
             └────────┬────────┘
                      ▼
               STRATEGY ENGINE
                      │
              ┌───────┴───────┐
              ▼               ▼
         SMART RETRY      RECOVERY LINK
              │               │
              └───────┬───────┘
                      ▼
               PAYMENT RECOVERY
                      │
              ┌───────┴───────┐
              ▼               ▼
           ANALYTICS       AUDIT TRAIL
```

---

# 🛠️ Technology Stack

### Frontend
- React
- Vite
- Responsive dashboard UI

### Backend
- FastAPI
- Python
- REST APIs

### Data
- SQLite persistence

### Real-Time Layer
- Server-Sent Events (SSE)
- Simulated payment webhooks

### Intelligence Layer
- Deterministic RevX decision engine
- Recovery probability scoring
- Strategy selection
- Explainable audit traces
- AI Copilot simulation

---

# ⚙️ Quick Start

## Prerequisites

Ensure the following are installed:

- Python 3
- Node.js
- npm

## 1. Clone the repository

```bash
git clone <YOUR-REPOSITORY-URL>
cd Razorpay
```

## 2. Install and build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

## 3. Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

## 4. Start RevX-Agent

```bash
python run.py
```

Open:

**http://127.0.0.1:8000**

API documentation:

**http://127.0.0.1:8000/docs**

---

# 🎥 Recommended Judge Demo Flow

For the fastest way to understand RevX-Agent:

1. Open the **Dashboard**
2. Observe the live webhook listener and recovery KPIs
3. Click **Watch Demo**
4. Follow TXN-8801 through failure detection and root-cause analysis
5. Observe recovery probability and AI confidence
6. Review the selected recovery strategy
7. Generate the recovery action
8. Click **Simulate Successful Recovery**
9. Observe **₹1,25,000 Revenue Protected**
10. Open the **Audit Trail**
11. Visit **Analytics** to view expected recoverable revenue
12. Ask the **AI Recovery Copilot** to explain TXN-8801

---

# 🔌 API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | System health |
| GET | `/api/dashboard` | Dashboard intelligence |
| GET | `/api/transactions` | Transaction list/search |
| GET | `/api/transactions/{txn_id}` | Transaction details |
| GET | `/api/transactions/{txn_id}/audit` | Decision audit trail |
| POST | `/api/transactions/{txn_id}/action` | Recovery action |
| POST | `/api/assistant` | AI Copilot |
| GET | `/api/events` | Live SSE events |
| POST | `/api/demo/reset` | Reset judge demo |

---

# 🏆 What Makes RevX Different?

The innovation is **not simply retrying a failed payment**.

It is making the **recovery decision intelligent**.

RevX combines:

**Failure Intelligence + Recovery Probability + Revenue Intelligence + Strategy Selection + Recovery Orchestration + Explainability**

Instead of asking:

> “Can we retry this transaction?”

RevX asks:

> **“Given why this transaction failed, what is the highest-value and most appropriate recovery action we should take next?”**

---

# 📈 Potential Real-World Impact

For **merchants**:
- Better prioritization of recoverable revenue
- Reduced manual recovery effort
- More informed recovery decisions

For **customers**:
- Fewer unnecessary retries
- More appropriate recovery options
- Reduced payment friction

For **payment platforms**:
- An intelligent post-failure recovery layer
- Actionable recovery insights
- Greater visibility into recoverable revenue

---

# 🔮 Production Roadmap

The hackathon prototype demonstrates the complete recovery workflow.

A production version could extend this through:

- Real payment webhook integration
- Payment API integration
- ML models trained on historical failure/recovery outcomes
- Dynamic recovery-probability prediction
- Merchant-specific recovery policies
- Customer communication orchestration
- Experimentation and strategy optimization
- Risk and compliance controls
- Production monitoring and observability

---

# ⚠️ Prototype & Data Disclaimer

RevX-Agent is a **hackathon prototype**.

All transactions, customer names, amounts, recovery probabilities, confidence scores, recovery links, system statistics, and recovery outcomes included in the demo are **synthetic/simulated data**.

The prototype does **not** process real customer funds and does not contain Razorpay production credentials or private APIs.

Recovery probability and confidence values shown in the demo represent prototype decision-engine outputs and should not be interpreted as production-validated ML predictions.

---

# ⚡ RevX-Agent

### Autonomous AI Revenue Recovery Engine

**A failed payment should not automatically become lost revenue.**

RevX-Agent transforms payment failures into intelligent recovery opportunities.

### Detect. Decide. Recover.
