"""
SignVaani ISL Recognition Model Endpoint
Provides real frame and landmark inference integration.
Inspects backend/models/ for trained model weights.
"""

import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/recognize", tags=["ISL Recognition"])

MANUAL_ISL_VOCABULARY = [
    "I",
    "NEED",
    "WATER",
    "HELP",
    "FAMILY",
    "THANK",
    "YOU",
    "HOME",
    "MEDICAL",
    "PLEASE",
    "FOOD",
    "PAIN",
]

SUPPORTED_ISL_CLASSES = [
    "FAMILY",
    "FOOD",
    "HELLO",
    "HELP",
    "I",
    "NEED",
    "PLEASE",
    "THANK",
    "WATER",
    "YOU",
]

MIN_AUTOMATIC_CONFIDENCE = 35.0  # Lowered from 50 — small single-signer dataset produces lower probability scores
RECOGNITION_DIAGNOSTICS_ENABLED = (
    os.getenv("SIGNVAANI_RECOGNITION_DIAGNOSTICS", "").strip().lower() == "true"
)

class LandmarkInferenceRequest(BaseModel):
    features: List[float] = Field(..., description="63-dimensional normalized landmark vector (21 3D points)")
    handedness: Optional[str] = "Right"

class InferenceResult(BaseModel):
    word: str
    confidence: float
    model_name: str
    is_genuine_inference: bool
    accepted: bool = True
    rejection_reason: Optional[str] = None
    diagnostics: Optional[dict] = None

class ModelStatusResponse(BaseModel):
    model_loaded: bool
    model_artifact_path: Optional[str]
    supported_classes: List[str]
    missing_artifact_explanation: Optional[str]
    model_type: Optional[str] = None
    expected_features: Optional[int] = None
    is_valid_estimator: Optional[bool] = None
    unvalidated_classes: List[str] = Field(default_factory=list)
    manual_vocabulary: List[str] = Field(
        default_factory=lambda: MANUAL_ISL_VOCABULARY.copy()
    )

# Check for trained model weights in backend/models
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
CANDIDATE_MODEL_PATHS = [
    # User-recorded model (10 classes from JSON dataset) — tried first
    os.path.join(MODELS_DIR, "isl_user_experimental.joblib"),
    # Production / corpus-trained fallbacks
    os.path.join(MODELS_DIR, "isl_classifier.onnx"),
    os.path.join(MODELS_DIR, "isl_classifier.joblib"),
    os.path.join(MODELS_DIR, "isl_classifier.tflite"),
    os.path.join(MODELS_DIR, "isl_classifier.keras"),
]

_loaded_model = None
_model_path_found = None
_model_validation_info = None

def get_loaded_model():
    global _loaded_model, _model_path_found, _model_validation_info
    if _loaded_model is not None:
        return _loaded_model, _model_path_found
    for path in CANDIDATE_MODEL_PATHS:
        if os.path.exists(path):
            try:
                if path.endswith(".joblib"):
                    import joblib
                    model_candidate = joblib.load(path)
                    # Validate candidate model properties
                    classes = getattr(model_candidate, "classes_", None)
                    n_features = getattr(model_candidate, "n_features_in_", 63)
                    if classes is None or not hasattr(model_candidate, "predict"):
                        print(f"Warning: Model candidate at {path} lacks classes_ or predict method.")
                        continue
                    _loaded_model = model_candidate
                    _model_path_found = path
                    _model_validation_info = {
                        "model_type": type(model_candidate).__name__,
                        "expected_features": int(n_features) if n_features else 63,
                        "classes": [str(c) for c in classes],
                        "is_valid": True,
                    }
                    return _loaded_model, _model_path_found
                elif path.endswith(".onnx"):
                    import onnxruntime as ort
                    session = ort.InferenceSession(path)
                    _loaded_model = session
                    _model_path_found = path
                    _model_validation_info = {
                        "model_type": "ONNXInferenceSession",
                        "expected_features": 63,
                        "classes": SUPPORTED_ISL_CLASSES,
                        "is_valid": True,
                    }
                    return _loaded_model, _model_path_found
            except Exception as err:
                print(f"Warning: Failed to load candidate model {path}: {err}")
    return None, None

@router.get("/status", response_model=ModelStatusResponse)
def get_model_status():
    """
    Reports the status of the trained ISL recognition model.
    Never fabricates availability. Honestly reports missing model artifact.
    """
    model, path_found = get_loaded_model()
    has_model = model is not None
    classes = [str(c) for c in getattr(model, "classes_", [])] if has_model else []
    explanation = None if has_model else (
        "No trained ISL classification model weights artifact (.onnx, .joblib, .tflite, .keras) "
        "found in backend/models/. Real frame extraction and 21-point hand landmarking pipeline "
        "is operational on the client. To enable neural sign classification, place trained weights "
        "at backend/models/isl_classifier.onnx or isl_classifier.joblib."
    )
    model_type = _model_validation_info.get("model_type") if _model_validation_info else None
    expected_features = _model_validation_info.get("expected_features") if _model_validation_info else None
    is_valid = _model_validation_info.get("is_valid") if _model_validation_info else False

    return ModelStatusResponse(
        model_loaded=has_model,
        model_artifact_path=path_found,
        supported_classes=classes,
        missing_artifact_explanation=explanation,
        model_type=model_type,
        expected_features=expected_features,
        is_valid_estimator=is_valid,
        unvalidated_classes=classes,
        manual_vocabulary=MANUAL_ISL_VOCABULARY,
    )

def analyze_hand_geometry(features: list[float]) -> dict:
    """
    Computes rotation-invariant, scale-invariant hand anatomical metrics
    from 21 3D landmarks (63 values).
    Landmarks:
      0: Wrist
      1-4: Thumb (CMC, MCP, IP, TIP)
      5-8: Index (MCP, PIP, DIP, TIP)
      9-12: Middle (MCP, PIP, DIP, TIP)
      13-16: Ring (MCP, PIP, DIP, TIP)
      17-20: Pinky (MCP, PIP, DIP, TIP)
    """
    import numpy as np
    pts = np.array(features, dtype=np.float32).reshape(21, 3)
    wrist = pts[0]
    
    tips = [4, 8, 12, 16, 20]
    pips = [2, 6, 10, 14, 18]
    
    d_tips = [float(np.linalg.norm(pts[t] - wrist)) for t in tips]
    d_pips = [float(np.linalg.norm(pts[p] - wrist)) for p in pips]
    
    thumb_ext = d_tips[0] > (d_pips[0] * 1.15)
    index_ext = d_tips[1] > (d_pips[1] * 1.08)
    middle_ext = d_tips[2] > (d_pips[2] * 1.08)
    ring_ext = d_tips[3] > (d_pips[3] * 1.08)
    pinky_ext = d_tips[4] > (d_pips[4] * 1.08)
    
    num_ext = sum([index_ext, middle_ext, ring_ext, pinky_ext])
    
    # Measure pinch tightness (distance from thumb tip to all 4 fingertips)
    thumb_tip = pts[4]
    d_thumb_to_tips = [float(np.linalg.norm(thumb_tip - pts[t])) for t in [8, 12, 16, 20]]
    pinch_max = max(d_thumb_to_tips)
    pinch_mean = float(np.mean(d_thumb_to_tips))
    
    finger_coords = pts[[8, 12, 16, 20]]
    finger_spread = max([float(np.linalg.norm(finger_coords[i] - finger_coords[j])) for i in range(4) for j in range(i+1, 4)])
    
    tip_coords = pts[tips]
    tip_spread = max([float(np.linalg.norm(tip_coords[i] - tip_coords[j])) for i in range(5) for j in range(i+1, 5)])
    
    index_vec = pts[8] - pts[5]
    index_len = np.linalg.norm(index_vec)
    index_dir = index_vec / (index_len + 1e-6)
    
    candidates: dict[str, float] = {}
    
    # 1. HELP (Thumbs-Up): ONLY thumb extended, all other 4 fingers curled in fist
    if num_ext == 0 and thumb_ext:
        candidates["HELP"] = 0.95
    # 2. Index finger pointing gestures: YOU or I
    elif num_ext == 1 and index_ext and not middle_ext and not ring_ext and not pinky_ext:
        # If index points forward toward camera (negative Z), it's YOU
        # If pointing upward, it's I
        if index_dir[2] < -0.35:
            candidates["YOU"] = 0.92
            candidates["I"] = 0.60
        else:
            candidates["I"] = 0.92
            candidates["YOU"] = 0.60
    # 3. WATER ('W' sign):
    # Index, Middle, Ring extended.
    # In genuine WATER, thumb tucked holding pinky, pinky curled down into palm
    thumb_tip = pts[4]
    pinky_tip = pts[20]
    thumb_to_pinky = float(np.linalg.norm(thumb_tip - pinky_tip))
    pinky_to_wrist = d_tips[4]

    if index_ext and middle_ext and ring_ext and not pinky_ext and thumb_to_pinky < 0.55 and pinky_to_wrist < 0.75:
        candidates["WATER"] = 0.95
    # 4. Open hand / multi-finger poses:
    elif num_ext >= 3 or (index_ext and middle_ext and ring_ext and pinky_to_wrist > 0.75):
        # FOOD: MUST be an intentional tight pinch (all fingertips touching thumb tip)
        if pinch_max < 0.45 and pinch_mean < 0.35:
            candidates["FOOD"] = 0.95
        # HELLO (Open Wave): Spread fingers or thumb extended outwards (thumb-to-pinky > 0.55)
        # and pinky standing tall/upright (pinky_to_wrist > 0.75)
        elif thumb_to_pinky > 0.55 and pinky_to_wrist > 0.75:
            candidates["HELLO"] = 0.92
            candidates["PLEASE"] = 0.75
        # THANK: Flat hand, 4 fingers held tightly together pointing forward, thumb tucked
        elif finger_spread < 0.50 and thumb_to_pinky <= 0.55:
            candidates["THANK"] = 0.90
            candidates["PLEASE"] = 0.70
        elif tip_spread > 1.2:
            candidates["PLEASE"] = 0.85
            candidates["HELLO"] = 0.75
            
    return candidates

@router.post("/predict", response_model=InferenceResult)
def predict_gesture(payload: LandmarkInferenceRequest):
    """
    Executes genuine model inference on normalized 63-dimensional landmark features.
    Uses classifier probabilities for decisions; geometry is diagnostic only.
    """
    if len(payload.features) != 63:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected 63-dimensional landmark feature vector, received {len(payload.features)} features."
        )

    model, path_found = get_loaded_model()
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trained ISL classification model artifact is not loaded on this server."
        )

    try:
        import numpy as np
        vec = np.array(payload.features, dtype=np.float32).reshape(1, -1)
        if not np.isfinite(vec).all():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Landmark features must contain only finite coordinates.",
            )
        classes = [str(c) for c in getattr(model, "classes_", SUPPORTED_ISL_CLASSES)]
        if len(classes) == 0 or len(set(classes)) != len(classes):
            raise ValueError("Loaded model has an invalid or duplicate class list.")
        
        # 1. Base Model Probabilities
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(vec)[0].copy()
        else:
            pred = model.predict(vec)[0]
            probs = np.zeros(len(classes), dtype=np.float32)
            pred_str = str(pred)
            if pred_str in classes:
                probs[classes.index(pred_str)] = 1.0

        if len(probs) != len(classes) or not np.isfinite(probs).all():
            raise ValueError("Model returned invalid class probabilities.")
        raw_class_probabilities = {
            class_name: round(float(probability) * 100.0, 2)
            for class_name, probability in zip(classes, probs)
        }
        raw_best_idx = int(np.argmax(probs))
        raw_model_class = str(classes[raw_best_idx]) if raw_best_idx < len(classes) else "UNKNOWN"
        raw_model_conf = float(probs[raw_best_idx]) * 100.0

        # Geometry is DIAGNOSTIC ONLY — it is surfaced in the diagnostics dict
        # for the browser DevTools console but never used to veto predictions.
        # The trained classifier is the sole decision-maker.
        geom_priors = analyze_hand_geometry(payload.features)
        geometric_candidate = (
            max(geom_priors, key=geom_priors.get) if geom_priors else None
        )
        geometric_confidence = (
            float(geom_priors[geometric_candidate]) * 100.0
            if geometric_candidate
            else None
        )
        predicted_class = raw_model_class
        display_conf = min(100.0, max(0.0, raw_model_conf))

        # Only two rejection reasons remain: low confidence and unsupported class.
        # Geometry disagreement is intentionally removed as a rejection criterion
        # because it was silently suppressing valid model predictions (THANK,
        # PLEASE, HELLO, WATER) even when the classifier was correct.
        rejection_reason = None
        # Fix C: accept whatever classes the loaded model knows, not a static list
        model_supported_classes = [str(c) for c in classes]
        if predicted_class not in model_supported_classes:
            rejection_reason = f"{predicted_class} is not in the loaded model's vocabulary."
        elif display_conf < MIN_AUTOMATIC_CONFIDENCE:
            rejection_reason = (
                f"Model score {display_conf:.1f}% is below the "
                f"{MIN_AUTOMATIC_CONFIDENCE:.0f}% display threshold."
            )

        accepted = rejection_reason is None
        final_result = predicted_class if accepted else "Gesture unclear"
        final_confidence = display_conf if accepted else 0.0

        diag = {
            "raw_model_prediction": raw_model_class,
            "raw_model_conf": round(raw_model_conf, 1),
            "raw_model_confidence": round(raw_model_conf, 1),
            "raw_class_probabilities": raw_class_probabilities,
            "geometric_candidate": geometric_candidate,
            "geometric_confidence": (
                round(geometric_confidence, 1) if geometric_confidence is not None else None
            ),
            "geom_candidates": geom_priors,
            "geometry_usage": "diagnostic_only_not_used_for_decision",
            "final_prediction": final_result,
            "final_conf": round(final_confidence, 1),
            "final_confidence": round(final_confidence, 1),
            "rejection_reason": rejection_reason,
            "class_validation": "unvalidated",
        }

        return InferenceResult(
            word=final_result,
            confidence=round(final_confidence, 1),
            model_name=os.path.basename(path_found or "model"),
            is_genuine_inference=True,
            accepted=accepted,
            rejection_reason=rejection_reason,
            diagnostics=diag,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
