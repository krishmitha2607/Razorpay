from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timezone
import asyncio
import json
import random
import sqlite3
import os


ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "revx.db"
DIST = ROOT / "frontend" / "dist"


app = FastAPI(
    title="Razorpay RevX-Agent API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


# =========================================================
# DEMO DATA
# =========================================================

SEED = [
    (
        "TXN-8801",
        "Issuer Bank Outage",
        125000,
        "Delayed Retry Link",
        94,
        "High Priority",
        "Aarav Enterprises",
        "https://rzp.io/rzp/TXN-8801-recovery",
        "BANK_TIMEOUT (RZP_1006)",
        "Issuer response latency exceeded 8.5s across 3 attempts. "
        "Marked for delayed retry.",
        "12 min"
    ),
    (
        "TXN-8802",
        "Card Decline",
        75500,
        "Alternate Payment Route",
        91,
        "Recovery Ready",
        "Nova Retail",
        "https://rzp.io/rzp/TXN-8802-recovery",
        "CARD_SOFT_DECLINE (RZP_2003)",
        "Soft decline detected; UPI or alternate card has higher "
        "expected recovery probability.",
        "Immediate"
    ),
    (
        "TXN-8803",
        "Network Timeout",
        310000,
        "Smart Retry + Link",
        97,
        "Critical",
        "Vertex Systems",
        "https://rzp.io/rzp/TXN-8803-recovery",
        "NETWORK_TIMEOUT (RZP_3008)",
        "Gateway authorization timed out. "
        "No successful capture webhook exists.",
        "6 min"
    ),
    (
        "TXN-8804",
        "Issuer Bank Outage",
        48250,
        "Deferred Recovery",
        88,
        "Monitoring",
        "Kite Technologies",
        "https://rzp.io/rzp/TXN-8804-recovery",
        "BANK_UNAVAILABLE (RZP_1012)",
        "Regional issuer availability dropped below 92%; "
        "automatic retry deferred.",
        "20 min"
    ),
    (
        "TXN-8805",
        "Card Decline",
        22800,
        "UPI Payment Link",
        90,
        "Recovery Ready",
        "Retail Co",
        "https://rzp.io/rzp/TXN-8805-recovery",
        "CARD_DECLINED (RZP_2010)",
        "Card retry likelihood is low; "
        "UPI recovery path selected.",
        "Immediate"
    ),
]


CHART = [
    {
        "day": "Aug 5",
        "transactions": 150,
        "recovered": 91
    },
    {
        "day": "Aug 6",
        "transactions": 180,
        "recovered": 118
    },
    {
        "day": "Aug 7",
        "transactions": 165,
        "recovered": 104
    },
    {
        "day": "Aug 8",
        "transactions": 210,
        "recovered": 146
    },
    {
        "day": "Aug 9",
        "transactions": 195,
        "recovered": 138
    },
    {
        "day": "Aug 10",
        "transactions": 230,
        "recovered": 170
    },
    {
        "day": "Aug 11",
        "transactions": 240,
        "recovered": 182
    },
    {
        "day": "Aug 12",
        "transactions": 255,
        "recovered": 192
    },
]


FAILURES = [
    {
        "name": "Bank Downtime",
        "value": 42,
        "color": "#1677ff"
    },
    {
        "name": "User Decline",
        "value": 28,
        "color": "#7c4dff"
    },
    {
        "name": "Network Timeout",
        "value": 20,
        "color": "#ff9518"
    },
    {
        "name": "Other",
        "value": 10,
        "color": "#64748b"
    },
]


METRICS = [
    {
        "label": "Intercepted Drops",
        "value": "1,248",
        "change": "+24%",
        "sub": "Failed payments captured in real-time",
        "tone": "blue"
    },
    {
        "label": "Auto-Recovered",
        "value": "892",
        "change": "+31%",
        "sub": "Successfully recovered via retry/link",
        "tone": "green"
    },
    {
        "label": "Pending Recovery Links",
        "value": "356",
        "change": "",
        "sub": "Awaiting customer action",
        "tone": "amber"
    },
    {
        "label": "Recovered Revenue",
        "value": "₹ 24.8M",
        "change": "+67%",
        "sub": "Estimated value recovered",
        "tone": "indigo"
    },
]


# =========================================================
# REQUEST MODELS
# =========================================================

class ChatIn(BaseModel):
    message: str


class ActionIn(BaseModel):
    action: str


# =========================================================
# DATABASE
# =========================================================

def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    c = conn()

    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS transactions(
            id TEXT PRIMARY KEY,
            failure TEXT,
            amount INTEGER,
            strategy TEXT,
            confidence INTEGER,
            status TEXT,
            customer TEXT,
            payment_link TEXT,
            error_code TEXT,
            analysis TEXT,
            retry_window TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS audit(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            txn_id TEXT,
            ts TEXT,
            actor TEXT,
            event TEXT,
            detail TEXT
        );
        """
    )

    count = c.execute(
        "SELECT COUNT(*) FROM transactions"
    ).fetchone()[0]

    if count == 0:
        now = datetime.now(timezone.utc).isoformat()

        c.executemany(
            "INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            [
                row + (now,)
                for row in SEED
            ]
        )

        for row in SEED:

            c.execute(
                """
                INSERT INTO audit(
                    txn_id,
                    ts,
                    actor,
                    event,
                    detail
                )
                VALUES(?,?,?,?,?)
                """,
                (
                    row[0],
                    now,
                    "RevX Decision Engine",
                    "Failure classified",
                    f"{row[1]} · {row[8]}"
                )
            )

            c.execute(
                """
                INSERT INTO audit(
                    txn_id,
                    ts,
                    actor,
                    event,
                    detail
                )
                VALUES(?,?,?,?,?)
                """,
                (
                    row[0],
                    now,
                    "Recovery Agent",
                    "Strategy generated",
                    f"{row[3]} · Confidence {row[4]}%"
                )
            )

    c.commit()
    c.close()


init_db()


# =========================================================
# HEALTH
# =========================================================

@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": "RevX-Agent",
        "webhook": "active",
        "latency_ms": random.randint(78, 196)
    }


# =========================================================
# DASHBOARD
# =========================================================

@app.get("/api/dashboard")
def dashboard():

    c = conn()

    tx = [
        dict(r)
        for r in c.execute(
            "SELECT * FROM transactions ORDER BY amount DESC"
        ).fetchall()
    ]

    c.close()

    return {
        "metrics": METRICS,
        "chart": CHART,
        "failures": FAILURES,
        "transactions": tx,
        "system": {
            "uptime": "99.9%",
            "latency": "< 200ms",
            "processed": "1.2M+",
            "events_per_min": 2847,
            "strategy_accuracy": "94%",
            "recovery_rate": "72%"
        }
    }


# =========================================================
# TRANSACTIONS
# =========================================================

@app.get("/api/transactions")
def transactions(q: str = ""):

    c = conn()

    if q:

        like = f"%{q}%"

        rows = c.execute(
            """
            SELECT *
            FROM transactions
            WHERE id LIKE ?
               OR failure LIKE ?
               OR customer LIKE ?
            ORDER BY amount DESC
            """,
            (
                like,
                like,
                like
            )
        ).fetchall()

    else:

        rows = c.execute(
            """
            SELECT *
            FROM transactions
            ORDER BY amount DESC
            """
        ).fetchall()

    out = [
        dict(r)
        for r in rows
    ]

    c.close()

    return out


# =========================================================
# SINGLE TRANSACTION
# =========================================================

@app.get("/api/transactions/{txn_id}")
def transaction(txn_id: str):

    c = conn()

    row = c.execute(
        """
        SELECT *
        FROM transactions
        WHERE id=?
        """,
        (txn_id,)
    ).fetchone()

    c.close()

    if not row:
        raise HTTPException(
            404,
            "Transaction not found"
        )

    return dict(row)


# =========================================================
# AUDIT TRAIL
# =========================================================

@app.get("/api/transactions/{txn_id}/audit")
def audit(txn_id: str):

    c = conn()

    tx = c.execute(
        """
        SELECT *
        FROM transactions
        WHERE id=?
        """,
        (txn_id,)
    ).fetchone()

    if not tx:

        c.close()

        raise HTTPException(
            404,
            "Transaction not found"
        )

    logs = [
        dict(r)
        for r in c.execute(
            """
            SELECT *
            FROM audit
            WHERE txn_id=?
            ORDER BY id DESC
            """,
            (txn_id,)
        ).fetchall()
    ]

    c.close()

    return {
        "transaction": dict(tx),
        "logs": logs
    }


# =========================================================
# RECOVERY ACTION
# B2 SUPPORTS:
# COPY
# WHATSAPP
# RETRY
# RECOVER
# =========================================================

@app.post("/api/transactions/{txn_id}/action")
def action(txn_id: str, body: ActionIn):

    c = conn()

    tx = c.execute(
        """
        SELECT *
        FROM transactions
        WHERE id=?
        """,
        (txn_id,)
    ).fetchone()

    if not tx:

        c.close()

        raise HTTPException(
            404,
            "Transaction not found"
        )

    action_name = body.action.lower()

    status = {
        "copy": "Recovery Ready",
        "whatsapp": "Link Sent",
        "retry": "Retry Scheduled",
        "recover": "Recovered"
    }.get(
        action_name,
        tx["status"]
    )

    now = datetime.now(
        timezone.utc
    ).isoformat()

    # Update transaction status

    c.execute(
        """
        UPDATE transactions
        SET status=?,
            updated_at=?
        WHERE id=?
        """,
        (
            status,
            now,
            txn_id
        )
    )

    # -----------------------------------------------------
    # SUCCESSFUL RECOVERY AUDIT
    # -----------------------------------------------------

    if action_name == "recover":

        actor = "RevX Recovery Engine"

        event = "Payment recovered"

        detail = (
            "Recovery successful after intelligent retry · "
            "revenue protected"
        )

    else:

        actor = "Admin"

        event = (
            f"Recovery action: {action_name}"
        )

        detail = (
            f"Status updated to {status}"
        )

    # Store audit event

    c.execute(
        """
        INSERT INTO audit(
            txn_id,
            ts,
            actor,
            event,
            detail
        )
        VALUES(?,?,?,?,?)
        """,
        (
            txn_id,
            now,
            actor,
            event,
            detail
        )
    )

    c.commit()
    c.close()

    return {
        "ok": True,
        "status": status,
        "payment_link": tx["payment_link"]
    }


# =========================================================
# AI ASSISTANT
# =========================================================

@app.post("/api/assistant")
def assistant(body: ChatIn):

    msg = body.message.strip()

    upper = msg.upper()

    import re

    m = re.search(
        r"TXN-\d+",
        upper
    )

    # -----------------------------------------------------
    # TRANSACTION EXPLANATION
    # -----------------------------------------------------

    if m:

        txn_id = m.group(0)

        c = conn()

        tx = c.execute(
            """
            SELECT *
            FROM transactions
            WHERE id=?
            """,
            (txn_id,)
        ).fetchone()

        logs = c.execute(
            """
            SELECT *
            FROM audit
            WHERE txn_id=?
            ORDER BY id DESC
            """,
            (txn_id,)
        ).fetchall()

        c.close()

        if not tx:

            return {
                "type": "text",
                "message": (
                    f"I could not find {txn_id}."
                )
            }

        return {
            "type": "audit",
            "message": (
                f"Here’s the decision trace for {txn_id}."
            ),
            "transaction": dict(tx),
            "logs": [
                dict(r)
                for r in logs
            ]
        }

    low = msg.lower()

    # -----------------------------------------------------
    # BANK OUTAGE QUERY
    # -----------------------------------------------------

    if (
        "bank" in low
        or "outage" in low
    ):

        return {
            "type": "text",
            "message": (
                "2 high-value issuer outage cases are active: "
                "TXN-8801 (₹1,25,000) and "
                "TXN-8804 (₹48,250). "
                "RevX recommends delayed retries to avoid "
                "repeated issuer failures."
            )
        }

    # -----------------------------------------------------
    # SUMMARY QUERY
    # -----------------------------------------------------

    if (
        "summary" in low
        or "report" in low
    ):

        return {
            "type": "text",
            "message": (
                "Today RevX-Agent intercepted 1,248 payment drops, "
                "auto-recovered 892, and protected an estimated "
                "₹24.8M. Bank downtime remains the leading "
                "failure category at 42%."
            )
        }

    # -----------------------------------------------------
    # HIGH VALUE QUERY
    # -----------------------------------------------------

    if (
        "high" in low
        or "opportun" in low
    ):

        return {
            "type": "text",
            "message": (
                "Top opportunity: TXN-8803 for ₹3,10,000. "
                "Network timeout was detected with 97% confidence; "
                "smart retry + recovery link is recommended."
            )
        }

    # -----------------------------------------------------
    # DEFAULT ASSISTANT RESPONSE
    # -----------------------------------------------------

    return {
        "type": "text",
        "message": (
            "I can explain any TXN failure, surface bank outages, "
            "generate a recovery summary, or identify high-value "
            "recovery opportunities."
        )
    }


# =========================================================
# LIVE WEBHOOK EVENTS
# =========================================================


@app.post("/api/demo/reset")
def reset_demo():
    c = conn()
    try:
        c.execute("DELETE FROM audit")
        c.execute("DELETE FROM transactions")
        c.execute("DELETE FROM sqlite_sequence WHERE name='audit'")

        now = datetime.now(timezone.utc).isoformat()

        c.executemany(
            "INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            [row + (now,) for row in SEED]
        )

        for row in SEED:
            c.execute(
                """
                INSERT INTO audit(txn_id,ts,actor,event,detail)
                VALUES(?,?,?,?,?)
                """,
                (
                    row[0],
                    now,
                    "RevX Decision Engine",
                    "Failure classified",
                    f"{row[1]} · {row[8]}"
                )
            )

            c.execute(
                """
                INSERT INTO audit(txn_id,ts,actor,event,detail)
                VALUES(?,?,?,?,?)
                """,
                (
                    row[0],
                    now,
                    "Recovery Agent",
                    "Strategy generated",
                    f"{row[3]} · Confidence {row[4]}%"
                )
            )

        c.commit()

        return {
            "ok": True,
            "message": "Demo reset successfully",
            "transactions_restored": len(SEED)
        }
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()

@app.get("/api/events")
async def events(request: Request):

    async def stream():

        kinds = [
            "payment.failed",
            "payment.recovery_link.created",
            "payment.retried",
            "payment.recovered"
        ]

        ids = [
            "TXN-8801",
            "TXN-8802",
            "TXN-8803",
            "TXN-8804",
            "TXN-8805"
        ]

        while True:

            if await request.is_disconnected():
                break

            payload = {
                "type": random.choice(kinds),
                "txn": random.choice(ids),
                "ts": datetime.now(
                    timezone.utc
                ).isoformat()
            }

            yield (
                f"data: {json.dumps(payload)}\n\n"
            )

            await asyncio.sleep(8)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


# =========================================================
# SERVE BUILT REACT FRONTEND
# =========================================================

if DIST.exists():

    assets = DIST / "assets"

    if assets.exists():

        app.mount(
            "/assets",
            StaticFiles(
                directory=assets
            ),
            name="assets"
        )

    @app.get("/{full_path:path}")
    def spa(full_path: str):

        p = DIST / full_path

        if (
            full_path
            and p.exists()
            and p.is_file()
        ):
            return FileResponse(p)

        return FileResponse(
            DIST / "index.html"
        )
