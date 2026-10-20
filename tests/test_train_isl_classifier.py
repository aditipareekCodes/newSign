import numpy as np
import pytest

from scripts.train_isl_classifier import (
    CLASSES,
    PROJECT_ROOT,
    split_by_group,
    validate_collection_manifest,
)


def test_grouped_split_keeps_signers_disjoint():
    labels = np.array([label for label in CLASSES for _ in range(4)])
    groups = [f"signer-{signer}" for _ in CLASSES for signer in range(4)]

    train, validation = split_by_group(labels, groups, test_size=0.25)

    assert set(np.asarray(groups)[train]).isdisjoint(set(np.asarray(groups)[validation]))
    assert set(labels[train]) == set(CLASSES)
    assert set(labels[validation]) == set(CLASSES)


def test_grouped_split_refuses_missing_group_ids():
    with pytest.raises(ValueError, match="one non-empty group ID"):
        split_by_group(np.array(["YOU"]), [])


def test_training_refuses_current_provenance_insufficient_pilot():
    with pytest.raises(ValueError, match="no signer/session/performance provenance"):
        from scripts.train_isl_classifier import load_real_dataset_from_pilot

        load_real_dataset_from_pilot(PROJECT_ROOT / "generated" / "isl_pilot")


def test_manifest_requires_consent_schema_and_independent_signers():
    with pytest.raises(ValueError, match="no performances"):
        validate_collection_manifest([])


def test_manifest_refuses_too_few_real_performances_per_class():
    records = []
    for split, signers in (
        ("development", ["dev-1", "dev-2", "dev-3"]),
        ("final_test", ["test-1", "test-2"]),
    ):
        for signer in signers:
            for label in CLASSES:
                records.append(
                    {
                        "schemaVersion": 2,
                        "preprocessingSchema": "mediapipe_hand_21_xyz_wrist_scale_v1",
                        "consented": True,
                        "performerConfirmedLabel": True,
                        "labelVerified": True,
                        "labelReviewReference": "review-source-01",
                        "status": "accepted",
                        "source": "local_webcam",
                        "timestamp": "2026-01-01T00:00:00Z",
                        "durationMs": 2000,
                        "validFrameCount": 8,
                        "label": label,
                        "features": [0.0] * 63,
                        "signerId": signer,
                        "sessionId": "session-1",
                        "performanceId": f"{split}-{signer}-{label}",
                        "signerSplit": split,
                    }
                )

    with pytest.raises(ValueError, match="Insufficient signer-diverse development data"):
        validate_collection_manifest(records)


def test_manifest_excludes_manual_only_words_without_mapping_them():
    records = []
    for split, signers, repetitions in (
        ("development", ["dev-1", "dev-2", "dev-3"], 5),
        ("final_test", ["test-1", "test-2"], 1),
    ):
        for signer in signers:
            for label in CLASSES:
                for repetition in range(repetitions):
                    records.append(
                        {
                            "schemaVersion": 2,
                            "preprocessingSchema": "mediapipe_hand_21_xyz_wrist_scale_v1",
                            "consented": True,
                            "performerConfirmedLabel": True,
                            "labelVerified": True,
                            "labelReviewReference": "review-source-01",
                            "status": "accepted",
                            "source": "local_webcam",
                            "timestamp": "2026-01-01T00:00:00Z",
                            "durationMs": 2000,
                            "validFrameCount": 8,
                            "label": label,
                            "features": [0.0] * 63,
                            "signerId": signer,
                            "sessionId": "session-1",
                            "performanceId": f"{split}-{signer}-{label}-{repetition}",
                            "signerSplit": split,
                        }
                    )
    records.append(
        {
            "schemaVersion": 2,
            "preprocessingSchema": "mediapipe_hand_21_xyz_wrist_scale_v1",
            "consented": True,
            "performerConfirmedLabel": True,
            "labelVerified": True,
            "labelReviewReference": "review-source-01",
            "status": "accepted",
            "source": "local_webcam",
            "timestamp": "2026-01-01T00:00:00Z",
            "durationMs": 2000,
            "validFrameCount": 8,
            "label": "NEED",
            "features": [0.0] * 63,
            "signerId": "dev-1",
            "sessionId": "session-1",
            "performanceId": "development-dev-1-NEED-1",
            "signerSplit": "development",
        }
    )

    _features, labels, _groups, metadata = validate_collection_manifest(records)

    assert set(labels) == set(CLASSES)
    assert len(labels) == 120
    assert metadata["non_model_collection_records_excluded"] == {"NEED": 1}
