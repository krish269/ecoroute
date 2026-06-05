"""
Vision model service.

In MVP mode uses a mock classifier that randomly assigns a category with a
realistic confidence score so the rest of the pipeline works end-to-end.

To use a real model: set VISION_MODEL_PATH to a Keras .h5 file trained on
waste categories: plastics, electronics, organics, non-segregated.
"""

import random
from typing import Tuple

CATEGORIES = ["plastics", "electronics", "organics", "non-segregated"]

# Token reward rates matching smart contract
TOKEN_RATES = {
    "plastics": 10,
    "electronics": 25,
    "organics": 5,
    "non-segregated": 0,
}


def classify_image(image_bytes: bytes) -> Tuple[str, float]:
    """
    Returns (category, confidence_score).
    Uses real Keras model if VISION_MODEL_PATH is set, otherwise mocks.
    """
    try:
        from app.config import get_settings
        settings = get_settings()
        if settings.vision_model_path:
            return _classify_with_model(image_bytes, settings.vision_model_path)
    except Exception:
        pass
    return _mock_classify()


def _mock_classify() -> Tuple[str, float]:
    """Deterministic-looking mock: mostly valid high-confidence results."""
    weights = [0.35, 0.20, 0.30, 0.15]
    category = random.choices(CATEGORIES, weights=weights, k=1)[0]
    if category == "non-segregated":
        confidence = round(random.uniform(0.72, 0.95), 3)
    else:
        confidence = round(random.uniform(0.65, 0.98), 3)
    return category, confidence


def _classify_with_model(image_bytes: bytes, model_path: str) -> Tuple[str, float]:
    import numpy as np
    from PIL import Image
    import io

    try:
        import tensorflow as tf  # type: ignore
        model = tf.keras.models.load_model(model_path)
        img = Image.open(io.BytesIO(image_bytes)).resize((224, 224)).convert("RGB")
        arr = np.array(img) / 255.0
        arr = np.expand_dims(arr, axis=0)
        preds = model.predict(arr)[0]
        idx = int(np.argmax(preds))
        return CATEGORIES[idx], float(preds[idx])
    except Exception as e:
        raise RuntimeError(f"Model inference failed: {e}") from e
