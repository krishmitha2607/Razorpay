"""
Runtime helper for RevX-Agent D4 recovery-probability inference.
"""

from pathlib import Path
import joblib
import pandas as pd


HERE = Path(__file__).resolve().parent
MODEL_PATH = HERE / "recovery_model.joblib"

_model = None


def load_model():
    global _model

    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "Recovery model not found. Run "
                "`python backend/ml/train_recovery_model.py` first."
            )
        _model = joblib.load(MODEL_PATH)

    return _model


def predict_recovery_probability(features: dict) -> float:
    """
    Return recovery probability as a percentage from 0.0 to 100.0.
    """
    model = load_model()
    frame = pd.DataFrame([features])
    probability = model.predict_proba(frame)[0][1]
    return round(float(probability) * 100.0, 1)
