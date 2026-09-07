# RevX-Agent D4 — ML Recovery Scoring

This module introduces a real scikit-learn inference pipeline for RevX-Agent.

## What it does

`train_recovery_model.py` creates a reproducible synthetic historical-payment
dataset and trains a `RandomForestClassifier` to estimate the probability that
a failed payment will eventually be recovered.

The model uses:

- failure type
- error-code family
- payment amount
- number of attempts
- issuer response latency
- customer's historical payment success rate
- time since failure
- retry-window duration

## Important limitation

The training dataset is synthetic and created for the RevX-Agent prototype.
The model is real ML, but its metrics must **not** be presented as performance
on real Razorpay or merchant production data.

## Train

From the project root:

```bash
python backend/ml/train_recovery_model.py
```

Generated files:

- `backend/ml/recovery_training_data.csv`
- `backend/ml/recovery_model.joblib`
- `backend/ml/model_metrics.json`

The next D4 step connects `predictor.py` to the FastAPI transaction endpoints.
