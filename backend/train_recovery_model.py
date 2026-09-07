"""
RevX-Agent D4 — Recovery Probability Model Training
----------------------------------------------------
Creates a reproducible synthetic historical-payment dataset and trains
a machine-learning classifier that predicts whether a failed payment
will be successfully recovered.

IMPORTANT:
This is prototype ML trained on synthetic data. It is not production-
validated on real Razorpay merchant transactions.
"""

from pathlib import Path
import json
import math
import random

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


RANDOM_SEED = 42
N_ROWS = 6000

HERE = Path(__file__).resolve().parent
DATA_PATH = HERE / "recovery_training_data.csv"
MODEL_PATH = HERE / "recovery_model.joblib"
METRICS_PATH = HERE / "model_metrics.json"


FAILURE_TYPES = [
    "Issuer Bank Outage",
    "Network Timeout",
    "Card Decline",
    "UPI Failure",
    "Authentication Failure",
]

ERROR_FAMILIES = {
    "Issuer Bank Outage": ["BANK_TIMEOUT", "BANK_UNAVAILABLE"],
    "Network Timeout": ["NETWORK_TIMEOUT", "GATEWAY_TIMEOUT"],
    "Card Decline": ["CARD_SOFT_DECLINE", "CARD_DECLINED"],
    "UPI Failure": ["UPI_TIMEOUT", "UPI_TEMPORARY_FAILURE"],
    "Authentication Failure": ["AUTH_FAILED", "OTP_TIMEOUT"],
}


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def make_dataset(n_rows: int = N_ROWS) -> pd.DataFrame:
    """
    Generate synthetic failed-payment history with noisy, domain-inspired
    relationships between payment telemetry and eventual recovery.
    """
    rng = random.Random(RANDOM_SEED)
    rows = []

    for _ in range(n_rows):
        failure_type = rng.choices(
            FAILURE_TYPES,
            weights=[24, 25, 28, 15, 8],
            k=1,
        )[0]

        error_family = rng.choice(ERROR_FAMILIES[failure_type])

        # ₹500 to ₹5,00,000 with more observations in lower ranges.
        amount = int(min(500000, max(500, rng.lognormvariate(10.4, 1.0))))

        attempts = rng.randint(1, 5)
        issuer_latency_ms = int(max(120, rng.gauss(2500, 1800)))
        customer_success_rate = round(
            min(0.99, max(0.05, rng.betavariate(7, 2))),
            4,
        )
        hours_since_failure = round(rng.uniform(0.05, 48.0), 2)
        retry_window_minutes = rng.choice([0, 2, 5, 6, 10, 12, 15, 20, 30, 60])

        # Create a noisy probability-generating process.
        score = -0.25

        if failure_type == "Network Timeout":
            score += 1.10
        elif failure_type == "Issuer Bank Outage":
            score += 0.72
        elif failure_type == "UPI Failure":
            score += 0.38
        elif failure_type == "Card Decline":
            score -= 0.30
        elif failure_type == "Authentication Failure":
            score -= 0.48

        if error_family == "CARD_SOFT_DECLINE":
            score += 0.70
        elif error_family == "CARD_DECLINED":
            score -= 0.55
        elif error_family in {"NETWORK_TIMEOUT", "UPI_TIMEOUT"}:
            score += 0.35
        elif error_family == "AUTH_FAILED":
            score -= 0.40

        # Strong prior customer payment history increases recovery likelihood.
        score += 2.2 * (customer_success_rate - 0.65)

        # Too many repeated attempts usually reduce near-term recovery odds.
        score -= 0.20 * max(0, attempts - 2)

        # Extremely slow issuer response is harmful unless we wait.
        score -= min(1.0, max(0, issuer_latency_ms - 3500) / 7000)

        # Sensible delayed retry can help temporary infrastructure failures.
        if failure_type in {"Issuer Bank Outage", "Network Timeout", "UPI Failure"}:
            if 5 <= retry_window_minutes <= 30:
                score += 0.45

        # Immediate retry is less useful during a bank outage.
        if failure_type == "Issuer Bank Outage" and retry_window_minutes == 0:
            score -= 0.65

        # Very stale failures become harder to recover.
        score -= 0.018 * hours_since_failure

        # Amount has a small nonlinear effect, intentionally weak.
        if amount >= 100000:
            score -= 0.10

        # Add noise so the model cannot simply memorize a fixed rule.
        score += rng.gauss(0, 0.65)

        probability = sigmoid(score)
        recovered = 1 if rng.random() < probability else 0

        rows.append(
            {
                "failure_type": failure_type,
                "error_family": error_family,
                "amount": amount,
                "attempts": attempts,
                "issuer_latency_ms": issuer_latency_ms,
                "customer_success_rate": customer_success_rate,
                "hours_since_failure": hours_since_failure,
                "retry_window_minutes": retry_window_minutes,
                "recovered": recovered,
            }
        )

    return pd.DataFrame(rows)


def train():
    np.random.seed(RANDOM_SEED)

    df = make_dataset()
    df.to_csv(DATA_PATH, index=False)

    target = "recovered"
    features = [
        "failure_type",
        "error_family",
        "amount",
        "attempts",
        "issuer_latency_ms",
        "customer_success_rate",
        "hours_since_failure",
        "retry_window_minutes",
    ]

    X = df[features]
    y = df[target]

    categorical = ["failure_type", "error_family"]
    numeric = [
        "amount",
        "attempts",
        "issuer_latency_ms",
        "customer_success_rate",
        "hours_since_failure",
        "retry_window_minutes",
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                categorical,
            ),
            ("numeric", "passthrough", numeric),
        ]
    )

    classifier = RandomForestClassifier(
        n_estimators=350,
        max_depth=12,
        min_samples_leaf=8,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=RANDOM_SEED,
        stratify=y,
    )

    pipeline.fit(X_train, y_train)

    pred = pipeline.predict(X_test)
    prob = pipeline.predict_proba(X_test)[:, 1]

    accuracy = float(accuracy_score(y_test, pred))
    roc_auc = float(roc_auc_score(y_test, prob))
    matrix = confusion_matrix(y_test, pred).tolist()

    report = classification_report(
        y_test,
        pred,
        output_dict=True,
        zero_division=0,
    )

    metrics = {
        "dataset": "synthetic prototype payment-failure history",
        "rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "accuracy": round(accuracy, 4),
        "roc_auc": round(roc_auc, 4),
        "positive_recovery_rate": round(float(y.mean()), 4),
        "confusion_matrix": matrix,
        "classification_report": report,
        "features": features,
        "model": "RandomForestClassifier",
        "random_seed": RANDOM_SEED,
        "disclaimer": (
            "Prototype model trained on synthetic data. Metrics do not represent "
            "production performance on real Razorpay or merchant transactions."
        ),
    }

    joblib.dump(pipeline, MODEL_PATH)
    METRICS_PATH.write_text(
        json.dumps(metrics, indent=2),
        encoding="utf-8",
    )

    print("=" * 64)
    print("RevX-Agent D4 recovery model trained successfully")
    print("=" * 64)
    print(f"Dataset rows : {len(df)}")
    print(f"Test rows    : {len(X_test)}")
    print(f"Accuracy     : {accuracy:.3f}")
    print(f"ROC-AUC      : {roc_auc:.3f}")
    print(f"Model saved  : {MODEL_PATH}")
    print(f"Metrics saved: {METRICS_PATH}")
    print("")
    print("NOTE: These metrics are from synthetic prototype data only.")


if __name__ == "__main__":
    train()
