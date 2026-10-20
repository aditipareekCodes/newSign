import numpy as np
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.routers import recognition


class FakeClassifier:
    classes_ = np.array(["HELLO", "WATER"])
    n_features_in_ = 63

    def __init__(self, probabilities):
        self.probabilities = np.asarray(probabilities)

    def predict_proba(self, _features):
        return self.probabilities


def install_model(monkeypatch, probabilities):
    model = FakeClassifier(probabilities)
    monkeypatch.setattr(recognition, "_loaded_model", model)
    monkeypatch.setattr(recognition, "_model_path_found", "test-model")
    return model


def test_model_status_separates_loaded_labels_from_manual_vocabulary(monkeypatch):
    install_model(monkeypatch, [[0.9, 0.1]])

    status = recognition.get_model_status()

    assert status.supported_classes == ["HELLO", "WATER"]
    assert status.unvalidated_classes == ["HELLO", "WATER"]
    assert status.manual_vocabulary == recognition.MANUAL_ISL_VOCABULARY


def test_actual_loaded_production_model_and_status_share_the_same_classes(monkeypatch):
    monkeypatch.setattr(recognition, "_loaded_model", None)
    monkeypatch.setattr(recognition, "_model_path_found", None)
    monkeypatch.setattr(recognition, "_model_validation_info", None)

    model, model_path = recognition.get_loaded_model()
    status = recognition.get_model_status()

    assert model is not None
    assert model_path.endswith("isl_classifier.joblib")
    assert set(status.supported_classes) == set(model.classes_)
    assert set(status.unvalidated_classes) == set(model.classes_)
    assert "HELLO" in status.supported_classes


def test_geometry_is_diagnostic_and_cannot_override_model_prediction(monkeypatch):
    install_model(monkeypatch, [[0.9, 0.1]])
    monkeypatch.setattr(recognition, "analyze_hand_geometry", lambda _features: {"WATER": 0.99})
    monkeypatch.setattr(recognition, "RECOGNITION_DIAGNOSTICS_ENABLED", True)

    result = recognition.predict_gesture(
        recognition.LandmarkInferenceRequest(features=[0.0] * 63)
    )

    assert result.word == "HELLO"
    assert result.accepted is True
    assert result.diagnostics["geometric_candidate"] == "WATER"
    assert result.diagnostics["geometry_usage"] == "diagnostic_only_not_used_for_decision"
    assert result.diagnostics["class_validation"] == "unvalidated"


def test_low_confidence_prediction_abstains_and_diagnostics_are_opt_in(monkeypatch):
    install_model(monkeypatch, [[0.51, 0.49]])
    monkeypatch.setattr(recognition, "MIN_AUTOMATIC_CONFIDENCE", 60)
    monkeypatch.setattr(recognition, "RECOGNITION_DIAGNOSTICS_ENABLED", False)

    result = recognition.predict_gesture(
        recognition.LandmarkInferenceRequest(features=[0.0] * 63)
    )

    assert result.word == "Gesture unclear"
    assert result.accepted is False
    assert "below the provisional" in result.rejection_reason
    assert result.diagnostics is None


def test_non_finite_inputs_are_rejected(monkeypatch):
    install_model(monkeypatch, [[0.9, 0.1]])

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        recognition.predict_gesture(
            recognition.LandmarkInferenceRequest(
                features=[float("nan")] + [0.0] * 62
            )
        )
    assert "finite coordinates" in error.value.detail
