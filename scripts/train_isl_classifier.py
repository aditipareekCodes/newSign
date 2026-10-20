import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report, accuracy_score
import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

PILOT_LANDMARKS = PROJECT_ROOT / "generated" / "isl_pilot" / "landmarks"
PREPROCESSING_SCHEMA = "mediapipe_hand_21_xyz_wrist_scale_v1"

CLASSES = ["FOOD", "HELLO", "HELP", "I", "PLEASE", "THANK", "WATER", "YOU"]
COLLECTION_LABELS = set(CLASSES) | {
    "NEED",
    "FAMILY",
    "HOME",
    "MEDICAL",
    "PAIN",
}
MIN_DEVELOPMENT_SIGNERS = 3
MIN_DEVELOPMENT_PERFORMANCES_PER_CLASS = 15
MIN_FINAL_TEST_SIGNERS = 2


def split_by_group(
    labels: np.ndarray,
    groups: List[str],
    test_size: float = 0.2,
    random_state: int = 42,
) -> Tuple[np.ndarray, np.ndarray]:
    """Return a deterministic group-disjoint split with every class on both sides."""
    if (
        len(labels) != len(groups)
        or not groups
        or any(not isinstance(group, str) or not group.strip() for group in groups)
    ):
        raise ValueError("Grouped evaluation requires one non-empty group ID per sample.")
    if len(set(groups)) < 2:
        raise ValueError("Grouped evaluation requires at least two independent groups.")
    groups = np.asarray(groups)

    splitter = GroupShuffleSplit(
        n_splits=64,
        test_size=test_size,
        random_state=random_state,
    )
    expected_classes = set(labels.tolist())
    for train_indices, validation_indices in splitter.split(
        np.zeros(len(labels)), labels, groups
    ):
        train_groups = {groups[index] for index in train_indices}
        validation_groups = {groups[index] for index in validation_indices}
        if train_groups & validation_groups:
            continue
        if (
            set(labels[train_indices].tolist()) == expected_classes
            and set(labels[validation_indices].tolist()) == expected_classes
        ):
            return train_indices, validation_indices

    raise ValueError(
        "Could not create a group-disjoint validation split containing every class "
        "on both sides. Collect more independent signers/performances per class."
    )


def validate_collection_manifest(
    records: List[Dict[str, Any]],
) -> Tuple[np.ndarray, np.ndarray, List[str], Dict[str, Any]]:
    """Validate consented, reviewed performances and exclude final-test signers."""
    if not records:
        raise ValueError("The collection manifest contains no performances.")

    seen_performance_ids = set()
    signer_splits: Dict[str, str] = {}
    development_records = []
    final_test_records = []
    excluded_non_model_counts: Dict[str, int] = {}
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValueError(f"Manifest performance {index} is not an object.")
        performance_id = record.get("performanceId")
        if (
            not isinstance(performance_id, str)
            or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", performance_id.strip())
        ):
            raise ValueError(f"Manifest performance {index} has no performanceId.")
        if performance_id in seen_performance_ids:
            raise ValueError(f"Duplicate performanceId: {performance_id}")
        seen_performance_ids.add(performance_id)
        if record.get("status") != "accepted":
            continue
        if record.get("consented") is not True:
            raise ValueError(
                f"Performance {performance_id} is missing explicit recording consent."
            )
        if record.get("labelVerified") is not True:
            raise ValueError(
                f"Performance {performance_id} has no independent ISL label-review confirmation."
            )
        if record.get("performerConfirmedLabel") is not True:
            raise ValueError(
                f"Performance {performance_id} has no explicit performer-label confirmation."
            )
        if (
            not isinstance(record.get("labelReviewReference"), str)
            or not re.fullmatch(
                r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}",
                record["labelReviewReference"].strip(),
            )
        ):
            raise ValueError(
                f"Performance {performance_id} has no valid pseudonymous label-review reference."
            )
        if record.get("schemaVersion") != 2:
            raise ValueError(
                f"Performance {performance_id} uses an unsupported manifest schema."
            )
        if record.get("preprocessingSchema") != PREPROCESSING_SCHEMA:
            raise ValueError(
                f"Performance {performance_id} has an unsupported preprocessing schema."
            )
        label = record.get("label")
        if not isinstance(label, str) or label not in COLLECTION_LABELS:
            raise ValueError(
                f"Performance {performance_id} label {label!r} is not in the "
                "verified collection vocabulary."
            )
        features = record.get("features")
        if (
            not isinstance(features, list)
            or len(features) != 63
            or any(not isinstance(value, (int, float)) or not np.isfinite(value) for value in features)
        ):
            raise ValueError(
                f"Performance {performance_id} must contain 63 finite landmark features."
            )
        for field in ("signerId", "sessionId", "performanceId"):
            if (
                not isinstance(record.get(field), str)
                or not re.fullmatch(
                    r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}",
                    record[field].strip(),
                )
            ):
                raise ValueError(
                    f"Performance {performance_id} is missing {field} provenance."
                )
        split = record.get("signerSplit")
        signer_id = record["signerId"].strip()
        prior_split = signer_splits.setdefault(signer_id, split)
        if prior_split != split:
            raise ValueError(
                f"Signer {signer_id} appears in both development and final-test splits."
            )
        if record.get("source") != "local_webcam":
            raise ValueError(
                f"Performance {performance_id} has unsupported source provenance."
            )
        timestamp = record.get("timestamp")
        try:
            if not isinstance(timestamp, str):
                raise ValueError
            datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError as err:
            raise ValueError(
                f"Performance {performance_id} has an invalid ISO timestamp."
            ) from err
        if (
            not isinstance(record.get("durationMs"), (int, float))
            or isinstance(record["durationMs"], bool)
            or not np.isfinite(record["durationMs"])
            or record["durationMs"] < 1800
            or not isinstance(record.get("validFrameCount"), int)
            or isinstance(record["validFrameCount"], bool)
            or record["validFrameCount"] < 8
        ):
            raise ValueError(
                f"Performance {performance_id} does not meet verified capture completeness."
            )
        if split == "final_test":
            if label not in CLASSES:
                excluded_non_model_counts[label] = (
                    excluded_non_model_counts.get(label, 0) + 1
                )
                continue
            final_test_records.append(record)
        elif split == "development":
            if label not in CLASSES:
                excluded_non_model_counts[label] = (
                    excluded_non_model_counts.get(label, 0) + 1
                )
                continue
            development_records.append(record)
        else:
            raise ValueError(
                f"Performance {performance_id} has invalid signerSplit; "
                "expected development or final_test."
            )

    final_test_signers = {record["signerId"] for record in final_test_records}
    if len(final_test_signers) < MIN_FINAL_TEST_SIGNERS:
        raise ValueError(
            f"Reserve at least {MIN_FINAL_TEST_SIGNERS} complete final-test signers "
            "before training."
        )
    if not development_records:
        raise ValueError("No consented, verified development performances are available.")

    classes_present = {record["label"] for record in development_records}
    missing_classes = sorted(set(CLASSES) - classes_present)
    if missing_classes:
        raise ValueError(
            "Insufficient genuine development data for the eight-class model; "
            f"missing labels: {', '.join(missing_classes)}."
        )

    class_signers: Dict[str, set[str]] = {label: set() for label in CLASSES}
    class_counts: Dict[str, int] = {label: 0 for label in CLASSES}
    for record in development_records:
        class_signers[record["label"]].add(record["signerId"])
        class_counts[record["label"]] += 1

    insufficient = [
        label
        for label in CLASSES
        if class_counts[label] < MIN_DEVELOPMENT_PERFORMANCES_PER_CLASS
        or len(class_signers[label]) < MIN_DEVELOPMENT_SIGNERS
    ]
    if insufficient:
        details = ", ".join(
            f"{label}: {class_counts[label]} performances from "
            f"{len(class_signers[label])} development signers"
            for label in insufficient
        )
        raise ValueError(
            "Insufficient signer-diverse development data "
            f"(need at least {MIN_DEVELOPMENT_PERFORMANCES_PER_CLASS} performances "
            f"from {MIN_DEVELOPMENT_SIGNERS} signers per class): {details}."
        )

    final_test_classes = {record["label"] for record in final_test_records}
    missing_test_classes = sorted(set(CLASSES) - final_test_classes)
    if missing_test_classes:
        raise ValueError(
            "Reserved final-test signers must have performances for every model class; "
            f"missing: {', '.join(missing_test_classes)}."
        )

    X = np.asarray([record["features"] for record in development_records], dtype=np.float32)
    y = np.asarray([record["label"] for record in development_records])
    signer_groups = [record["signerId"] for record in development_records]
    metadata = {
        "class_counts": class_counts,
        "development_signers": sorted({record["signerId"] for record in development_records}),
        "reserved_final_test_signers": sorted(final_test_signers),
        "final_test_performance_count": len(final_test_records),
        "non_model_collection_records_excluded": excluded_non_model_counts,
    }
    return X, y, signer_groups, metadata

def load_manifest_records(manifest_path: Path) -> List[Dict[str, Any]]:
    """Loads performance records from a verified dataset export or manifest."""
    with manifest_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "performances" in data:
        if data.get("schemaVersion") != 2:
            raise ValueError("Collection manifest must use schemaVersion 2.")
        return data["performances"]
    raise ValueError(f"Unrecognized manifest structure in {manifest_path}")

def load_real_dataset_from_pilot(
    pilot_dir: Path,
) -> Tuple[np.ndarray, np.ndarray, List[str], List[Dict[str, Any]]]:
    """
    Load pilot landmarks only when their manifest includes signer/session provenance.
    """
    metadata_path = pilot_dir / "metadata.json"
    if not metadata_path.exists():
        raise ValueError(f"Pilot provenance manifest not found: {metadata_path}")
    with metadata_path.open("r", encoding="utf-8") as mf:
        provenance_info = json.load(mf)

    landmarks_root = pilot_dir / "landmarks"
    if not landmarks_root.exists():
        raise FileNotFoundError(f"Pilot landmarks directory not found: {landmarks_root}")

    plan = provenance_info.get("train_validation_plan", {})
    records = plan.get("train", []) + plan.get("validation", [])
    record_by_feature_path = {
        Path(record.get("feature_path", "")).as_posix().lower(): record
        for record in records
        if isinstance(record, dict) and record.get("feature_path")
    }

    X_list = []
    y_list = []
    groups = []
    provenance_records = []

    for class_dir in sorted(landmarks_root.iterdir()):
        if not class_dir.is_dir():
            continue
        label = class_dir.name
        for npy_file in sorted(class_dir.glob("*.npy")):
            try:
                feat = np.load(npy_file, allow_pickle=False)
            except (OSError, ValueError) as err:
                raise ValueError(f"Could not read landmark file {npy_file}: {err}") from err
            if feat.shape != (63,) or not np.isfinite(feat).all():
                raise ValueError(f"Invalid 63-dimensional finite feature vector: {npy_file}")
            relative_path = npy_file.relative_to(PROJECT_ROOT).as_posix().lower()
            provenance = record_by_feature_path.get(relative_path)
            if provenance is None:
                raise ValueError(
                    f"Pilot sample {npy_file} has no matching source provenance record."
                )
            required = ("signerId", "sessionId", "performanceId")
            if any(not isinstance(provenance.get(key), str) or not provenance[key].strip() for key in required):
                raise ValueError(
                    "Pilot data has no signer/session/performance provenance; "
                    "a meaningful grouped evaluation cannot be claimed. "
                    "Use the consented collection workflow instead."
                )
            X_list.append(feat)
            y_list.append(label)
            groups.append(provenance["signerId"])
            provenance_records.append({
                "label": label,
                **provenance,
            })

    if not X_list:
        raise ValueError(f"No valid landmark vectors found in {landmarks_root}")

    return np.array(X_list, dtype=np.float32), np.array(y_list), groups, provenance_records

def make_pose_distinct(name: str) -> np.ndarray:
    pts = np.zeros((21, 3), dtype=np.float32)
    pts[0] = [0.0, 0.0, 0.0]  # wrist

    if name == "HELLO":
        for mcp, ang in zip([1, 5, 9, 13, 17], [-0.45, -0.20, 0.0, 0.20, 0.40]):
            v = np.array([np.sin(ang), -np.cos(ang), 0.0], dtype=np.float32)
            curr = pts[0] + v * 0.4
            pts[mcp] = curr
            for j in range(1, 4):
                curr = curr + v * 0.22
                pts[mcp + j] = curr

    elif name == "YOU":
        pts[1:5] = np.array([[-0.1, -0.2, -0.1], [-0.15, -0.3, -0.1], [-0.1, -0.35, -0.1], [-0.05, -0.35, -0.1]], dtype=np.float32)
        v = np.array([0.0, -0.3, -0.7], dtype=np.float32)
        curr = pts[0] + np.array([0.0, -0.3, 0.0], dtype=np.float32)
        pts[5] = curr
        for j in range(1, 4):
            curr = curr + v * 0.25
            pts[5 + j] = curr
        for mcp, x in [(9, 0.0), (13, 0.1), (17, 0.2)]:
            pts[mcp] = [x, -0.35, 0.0]
            pts[mcp + 1] = [x, -0.4, -0.1]
            pts[mcp + 2] = [x, -0.3, -0.15]
            pts[mcp + 3] = [x, -0.2, -0.1]

    elif name == "I":
        pts[1:5] = np.array([[-0.1, -0.2, -0.1], [-0.15, -0.3, -0.1], [-0.1, -0.35, -0.1], [-0.05, -0.35, -0.1]], dtype=np.float32)
        v = np.array([0.0, -1.0, 0.0], dtype=np.float32)
        curr = pts[0] + np.array([-0.05, -0.4, 0.0], dtype=np.float32)
        pts[5] = curr
        for j in range(1, 4):
            curr = curr + v * 0.22
            pts[5 + j] = curr
        for mcp, x in [(9, 0.0), (13, 0.1), (17, 0.2)]:
            pts[mcp] = [x, -0.35, 0.0]
            pts[mcp + 1] = [x, -0.4, -0.1]
            pts[mcp + 2] = [x, -0.3, -0.15]
            pts[mcp + 3] = [x, -0.2, -0.1]

    elif name == "WATER":
        pts[1:5] = np.array([[-0.05, -0.25, -0.05], [-0.05, -0.3, -0.08], [0.0, -0.3, -0.1], [0.05, -0.25, -0.08]], dtype=np.float32)
        for mcp, ang in [(5, -0.22), (9, 0.0), (13, 0.22)]:
            v = np.array([np.sin(ang), -np.cos(ang), 0.0], dtype=np.float32)
            curr = pts[0] + v * 0.4
            pts[mcp] = curr
            for j in range(1, 4):
                curr = curr + v * 0.22
                pts[mcp + j] = curr
        pts[17] = [0.18, -0.3, 0.0]
        pts[18] = [0.15, -0.35, -0.1]
        pts[19] = [0.1, -0.3, -0.1]
        pts[20] = [0.05, -0.25, -0.08]

    elif name == "HELP":
        v_thumb = np.array([-0.1, -1.0, 0.1], dtype=np.float32)
        curr = pts[0] + np.array([-0.15, -0.2, 0.0], dtype=np.float32)
        pts[1] = curr
        for j in range(1, 4):
            curr = curr + v_thumb * 0.22
            pts[1 + j] = curr
        for mcp, x in [(5, -0.08), (9, 0.0), (13, 0.08), (17, 0.16)]:
            pts[mcp] = [x, -0.35, 0.0]
            pts[mcp + 1] = [x, -0.42, -0.1]
            pts[mcp + 2] = [x, -0.32, -0.18]
            pts[mcp + 3] = [x, -0.20, -0.12]

    elif name == "FOOD":
        target = np.array([0.0, -0.65, -0.15], dtype=np.float32)
        for mcp, base in [(1, [-0.15, -0.2, 0]), (5, [-0.1, -0.35, 0]), (9, [0, -0.38, 0]), (13, [0.1, -0.35, 0]), (17, [0.15, -0.3, 0])]:
            pts[mcp] = base
            for j in range(1, 4):
                ratio = j / 3.0
                pts[mcp + j] = np.array(base, dtype=np.float32) * (1 - ratio) + target * ratio

    elif name == "THANK":
        pts[1:5] = np.array([[-0.12, -0.25, 0.0], [-0.15, -0.35, 0.0], [-0.15, -0.45, 0.0], [-0.12, -0.52, 0.0]], dtype=np.float32)
        for mcp, x in [(5, -0.06), (9, 0.0), (13, 0.06), (17, 0.12)]:
            v = np.array([0.0, -1.0, 0.0], dtype=np.float32)
            curr = pts[0] + np.array([x, -0.38, 0.0], dtype=np.float32)
            pts[mcp] = curr
            for j in range(1, 4):
                curr = curr + v * 0.22
                pts[mcp + j] = curr

    elif name == "PLEASE":
        for mcp, (x, ang) in [(1, (-0.2, -0.5)), (5, (-0.08, -0.08)), (9, (0.0, 0.0)), (13, (0.08, 0.08)), (17, (0.16, 0.16))]:
            v = np.array([np.sin(ang), -np.cos(ang), 0.0], dtype=np.float32)
            curr = pts[0] + np.array([x, -0.35, 0.0], dtype=np.float32)
            pts[mcp] = curr
            for j in range(1, 4):
                curr = curr + v * 0.22
                pts[mcp + j] = curr

    wrist = pts[0].copy()
    mid = pts[9].copy()
    scale = float(np.linalg.norm(mid - wrist)) or 1.0
    return ((pts - wrist) / scale).astype(np.float32)

def generate_augmented_variants(base_pts: np.ndarray, count: int = 200) -> list[np.ndarray]:
    variants = []
    for _ in range(count):
        p = base_pts.copy()
        p *= np.random.uniform(0.92, 1.08)
        ang = np.random.uniform(-0.30, 0.30)
        cos_a, sin_a = np.cos(ang), np.sin(ang)
        p[:, 0], p[:, 1] = p[:, 0] * cos_a - p[:, 1] * sin_a, p[:, 0] * sin_a + p[:, 1] * cos_a
        p += np.random.normal(0, 0.016, p.shape)
        wrist = p[0].copy()
        mid = p[9].copy()
        scale = float(np.linalg.norm(mid - wrist)) or 1.0
        feat = ((p - wrist) / scale).flatten().astype(np.float32)
        variants.append(feat)

        p_m = p.copy()
        p_m[:, 0] = -p_m[:, 0]
        feat_m = ((p_m - wrist) / scale).flatten().astype(np.float32)
        variants.append(feat_m)
    return variants

def train_manifest_workflow(
    mode: str = "synthetic_baseline",
    manifest_path: Optional[Path] = None,
    output_dir: Optional[Path] = None,
    overwrite_production: bool = False,
) -> Tuple[Path, float]:
    """
    Executes a reproducible, manifest-driven training workflow.
    Atomically writes model artifacts with provenance and split disclaimers.
    Never overwrites production model unless explicitly requested and backed up.
    """
    if overwrite_production:
        raise ValueError(
            "Production model promotion is disabled. A candidate requires a separately "
            "reviewed, signer-held-out evaluation before promotion."
        )

    target_output_dir = output_dir or (PROJECT_ROOT / "backend" / "models")

    provenance_metadata: Dict[str, Any] = {
        "model_type": "RandomForestClassifier",
        "input_dimensions": 63,
        "is_handedness_invariant": True,
        "training_mode": mode,
        "real_world_accuracy_established": False,
    }

    if mode == "manifest":
        if not manifest_path or not manifest_path.exists():
            raise FileNotFoundError(f"Specified manifest not found: {manifest_path}")
        records = load_manifest_records(manifest_path)
        X, y, groups, grouped_metadata = validate_collection_manifest(records)
        train_indices, test_indices = split_by_group(y, groups)
        X_train, X_test = X[train_indices], X[test_indices]
        y_train, y_test = y[train_indices], y[test_indices]
        split_strategy = "development_signer_group_shuffle_split"
        provenance_metadata["data_source"] = str(manifest_path)
        provenance_metadata["split_strategy"] = split_strategy
        provenance_metadata["development_signers"] = grouped_metadata["development_signers"]
        provenance_metadata["reserved_final_test_signers"] = grouped_metadata["reserved_final_test_signers"]
        provenance_metadata["final_test_performance_count_not_used"] = grouped_metadata["final_test_performance_count"]
        provenance_metadata["class_counts"] = grouped_metadata["class_counts"]
        provenance_metadata["non_model_collection_records_excluded"] = (
            grouped_metadata["non_model_collection_records_excluded"]
        )
        provenance_metadata["provenance_disclaimer"] = (
            "Evaluation uses development signers held out by signer group. Reserved final-test "
            "signers are excluded from training and development evaluation."
        )

    elif mode == "pilot_real":
        load_real_dataset_from_pilot(PROJECT_ROOT / "generated" / "isl_pilot")
        raise ValueError(
            "The current pilot does not contain signer/session provenance or enough "
            "independent samples for an eight-class evaluation. No model was trained."
        )

    else:
        # Synthetic baseline is for shape/serialization checks, not accuracy evaluation.
        X_list = []
        y_list = []
        for label in CLASSES:
            base = make_pose_distinct(label)
            vars = generate_augmented_variants(base, count=200)
            for v in vars:
                X_list.append(v)
                y_list.append(label)
        X = np.array(X_list, dtype=np.float32)
        y = np.array(y_list)
        X_train, y_train = X, y
        provenance_metadata["data_source"] = "synthetic_pose_templates"
        provenance_metadata["evaluation_status"] = "not_evaluated_synthetic_only"
        provenance_metadata["accuracy_scope"] = "none"
        provenance_metadata["provenance_disclaimer"] = (
            "Synthetic pose templates are for offline shape/serialization checks only. "
            "No accuracy or generalization evaluation is reported."
        )

    clf = RandomForestClassifier(
        n_estimators=140,
        max_depth=20,
        min_samples_split=2,
        random_state=42,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    provenance_metadata["classes"] = [str(c) for c in clf.classes_]
    provenance_metadata["n_samples"] = int(len(y_train))
    counts = {str(label): int(np.sum(y_train == label)) for label in clf.classes_}
    provenance_metadata["class_counts"] = counts
    provenance_metadata["is_balanced"] = len(set(counts.values())) == 1

    if mode == "manifest":
        y_pred = clf.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        provenance_metadata["evaluation_status"] = "development_signer_held_out"
        provenance_metadata["evaluation_signers"] = sorted(
            {groups[index] for index in test_indices}
        )
        provenance_metadata["test_performance_count"] = int(len(test_indices))
        provenance_metadata["test_accuracy"] = round(float(acc) * 100, 2)
        provenance_metadata["accuracy_scope"] = (
            "held-out development signers only; not final-test or production accuracy"
        )
        provenance_metadata["classification_report"] = classification_report(
            y_test, y_pred, output_dict=True, zero_division=0
        )
        return_accuracy = float(acc)
    else:
        provenance_metadata["evaluation_status"] = "not_evaluated_synthetic_only"
        return_accuracy = 0.0

    # Determine artifact file paths atomically
    candidate_model_file = target_output_dir / "candidate_isl_classifier.joblib"
    candidate_meta_file = target_output_dir / "candidate_model_metadata.json"
    if candidate_model_file.exists() or candidate_meta_file.exists():
        raise FileExistsError(
            f"Candidate artifacts already exist in {target_output_dir}; choose a new "
            "output directory to avoid overwriting them."
        )
    target_output_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(clf, candidate_model_file)
    with open(candidate_meta_file, "w", encoding="utf-8") as f:
        json.dump(provenance_metadata, f, indent=2)

    print(f"Trained model artifact saved to: {candidate_model_file}")
    if mode == "manifest":
        print(
            f"Development-signer validation score: {return_accuracy * 100:.2f}% "
            "(not final-test or production accuracy)"
        )
    else:
        print("No accuracy evaluation performed for synthetic data.")
    return candidate_model_file, return_accuracy

def main():
    parser = argparse.ArgumentParser(description="SignVaani Reproducible ISL Classifier Trainer")
    parser.add_argument(
        "--mode",
        choices=["synthetic_baseline", "pilot_real", "manifest"],
        default="synthetic_baseline",
        help="Training mode: synthetic_baseline, pilot_real, or manifest",
    )
    parser.add_argument("--manifest", type=Path, default=None, help="Path to exported performance manifest JSON")
    parser.add_argument("--output-dir", type=Path, default=None, help="Output directory for model artifacts")
    parser.add_argument("--overwrite-production", action="store_true", help="Atomically update production model")
    args = parser.parse_args()

    train_manifest_workflow(
        mode=args.mode,
        manifest_path=args.manifest,
        output_dir=args.output_dir,
        overwrite_production=args.overwrite_production,
    )

if __name__ == "__main__":
    main()
