#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
import zipfile

import numpy as np
from PIL import Image

from mediapipe import Image as MpImage, ImageFormat
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

TARGET_VOCAB = [
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

SELECTED_CLASSES = ["YOU", "HELP", "WATER", "FOOD"]
CANDIDATE_ALIAS_LABELS = {
    "I_ME_MINE_MY": {
        "canonical_target": "I",
        "requires_semantic_verification": True,
        "notes": "Combined label likely includes I / ME / MINE / MY variants; do not silently map without sign-level verification.",
    }
}

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = PROJECT_ROOT / "public" / "models" / "hand_landmarker.task"
ARCHIVE_CANDIDATES = [
    PROJECT_ROOT / "datasets" / "archive.zip",
    PROJECT_ROOT.parent / "datasets" / "archive.zip",
    Path(r"C:\Users\Aditi Pareek\Downloads\signVaani-main new zip\datasets\archive.zip"),
]
ARCHIVE_PATH = next((candidate for candidate in ARCHIVE_CANDIDATES if candidate.exists()), ARCHIVE_CANDIDATES[0])
WORD_LEVEL_PREFIX = "ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/Frames_Word_Level/"


def list_word_level_labels(archive_path: Path) -> Dict[str, List[str]]:
    if not archive_path.exists():
        raise FileNotFoundError(f"Archive does not exist: {archive_path}")

    result: Dict[str, List[str]] = defaultdict(list)
    with zipfile.ZipFile(archive_path) as zf:
        for name in zf.namelist():
            if not name.startswith(WORD_LEVEL_PREFIX):
                continue
            rel = name[len(WORD_LEVEL_PREFIX):]
            parts = rel.split("/")
            if len(parts) < 2 or not parts[0] or parts[0] in {"Thumbs.db"}:
                continue
            result[parts[0]].append(name)
    return {label: sorted(paths) for label, paths in result.items()}


def verify_target_vocabulary(labels_by_class: Dict[str, List[str]]) -> Dict[str, Any]:
    exact_matches = {
        target: labels_by_class.get(target, [])
        for target in TARGET_VOCAB
        if target in labels_by_class
    }
    missing = [target for target in TARGET_VOCAB if target not in labels_by_class]

    candidate_aliases = []
    for source_label, info in CANDIDATE_ALIAS_LABELS.items():
        if source_label in labels_by_class:
            candidate_aliases.append(
                {
                    "source_label": source_label,
                    "canonical_target": info["canonical_target"],
                    "requires_semantic_verification": info["requires_semantic_verification"],
                    "notes": info["notes"],
                    "sample_paths": labels_by_class[source_label][:5],
                }
            )

    return {
        "exact_matches": exact_matches,
        "missing_targets": missing,
        "candidate_aliases": candidate_aliases,
        "target_vocabulary": TARGET_VOCAB,
    }


def _landmark_component(landmark: Any, axis: str) -> float:
    if hasattr(landmark, axis):
        return float(getattr(landmark, axis))
    data = list(landmark)
    if axis == "x":
        return float(data[0])
    if axis == "y":
        return float(data[1])
    if axis == "z":
        return float(data[2])
    raise ValueError(f"Unsupported axis: {axis}")


def preprocess_hand_landmarks(landmarks: Iterable[Any]) -> np.ndarray:
    landmark_list = list(landmarks)
    if len(landmark_list) != 21:
        raise ValueError(f"Expected 21 landmarks, got {len(landmark_list)}")

    wrist = landmark_list[0]
    middle_mcp = landmark_list[9]

    wrist_x = _landmark_component(wrist, "x")
    wrist_y = _landmark_component(wrist, "y")
    wrist_z = _landmark_component(wrist, "z")
    middle_x = _landmark_component(middle_mcp, "x")
    middle_y = _landmark_component(middle_mcp, "y")
    middle_z = _landmark_component(middle_mcp, "z")

    dx = middle_x - wrist_x
    dy = middle_y - wrist_y
    dz = middle_z - wrist_z
    scale = float(np.sqrt(dx * dx + dy * dy + dz * dz))
    if scale <= 0.001:
        scale = 1.0

    features = np.zeros(63, dtype=np.float32)
    for index, landmark in enumerate(landmark_list):
        x = _landmark_component(landmark, "x")
        y = _landmark_component(landmark, "y")
        z = _landmark_component(landmark, "z")
        features[index * 3 : index * 3 + 3] = np.array(
            [
                (x - wrist_x) * (1.0 / scale),
                (y - wrist_y) * (1.0 / scale),
                (z - wrist_z) * (1.0 / scale),
            ],
            dtype=np.float32,
        )
    return features


def make_hand_landmarker(model_path: Path):
    if not model_path.exists():
        raise FileNotFoundError(f"Hand landmarker model not found at: {model_path}")
    base_options = mp_python.BaseOptions(model_asset_path=str(model_path))
    options = mp_vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=mp_vision.RunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return mp_vision.HandLandmarker.create_from_options(options)


def extract_landmark_feature(image_bytes: bytes, hand_landmarker) -> Tuple[np.ndarray | None, str | None]:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
    except Exception:
        return None, "decode_error"

    mp_image = MpImage(image_format=ImageFormat.SRGB, data=image_np)
    try:
        result = hand_landmarker.detect(mp_image)
    except Exception:
        return None, "detection_error"

    hands = getattr(result, "hand_landmarks", None)
    if not hands:
        return None, "no_hand"
    if len(hands) > 1:
        return None, "multiple_hands"

    hand = hands[0]
    if len(hand) != 21:
        return None, "invalid_landmark_count"

    try:
        feature = preprocess_hand_landmarks(hand)
    except Exception:
        return None, "preprocessing_error"

    if not np.isfinite(feature).all():
        return None, "non_finite_feature"

    return feature, None


def choose_verified_classes(labels_by_class: Dict[str, List[str]], selected_classes: Iterable[str]) -> Dict[str, List[str]]:
    verified = {}
    for label in selected_classes:
        if label not in labels_by_class:
            continue
        verified[label] = labels_by_class[label]
    return verified


def build_split_plan(records: List[Dict[str, Any]], split_ratio: float = 0.2) -> Dict[str, List[Dict[str, Any]]]:
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for record in records:
        stem = Path(record["source_path"]).stem
        groups[stem].append(record)

    train: List[Dict[str, Any]] = []
    val: List[Dict[str, Any]] = []
    for stem, items in sorted(groups.items()):
        items = sorted(items, key=lambda item: item["source_path"])
        if len(items) <= 1:
            train.extend(items)
            continue
        n_val = max(1, int(round(len(items) * split_ratio)))
        n_val = min(n_val, len(items) - 1)
        val.extend(items[:n_val])
        train.extend(items[n_val:])

    return {"train": train, "validation": val}


def generate_dataset(
    archive_path: Path,
    output_dir: Path,
    selected_classes: Iterable[str] = SELECTED_CLASSES,
    max_per_class: int = 20,
) -> Dict[str, Any]:
    labels_by_class = list_word_level_labels(archive_path)
    verification = verify_target_vocabulary(labels_by_class)
    verified_classes = choose_verified_classes(labels_by_class, selected_classes)

    output_dir.mkdir(parents=True, exist_ok=True)
    feature_root = output_dir / "landmarks"
    feature_root.mkdir(parents=True, exist_ok=True)

    hand_landmarker = make_hand_landmarker(MODEL_PATH)
    records: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []

    for label, paths in verified_classes.items():
        label_dir = feature_root / label
        label_dir.mkdir(parents=True, exist_ok=True)

        relevant_paths = sorted(paths)[:max_per_class]
        for raw_path in relevant_paths:
            with zipfile.ZipFile(archive_path) as zf:
                payload = zf.read(raw_path)
            feature, error = extract_landmark_feature(payload, hand_landmarker)
            record = {
                "label": label,
                "source_path": raw_path,
                "status": "accepted" if feature is not None else "rejected",
                "error": error,
                "feature_path": str(label_dir / Path(raw_path).name.replace(".jpg", ".npy")),
            }

            if feature is not None:
                np.save(record["feature_path"], feature)
                records.append(record)
            else:
                rejected.append(record)

    label_counts = {label: len([r for r in records if r["label"] == label]) for label in verified_classes}
    summary = {
        "archive_path": str(archive_path),
        "dataset_type": "ISL word-level frame subset",
        "selected_classes": list(verified_classes.keys()),
        "verification": verification,
        "license_note": {
            "explicit_license_file_found": False,
            "source_summary": "The archive metadata text says the dataset is publicly available, but no explicit LICENSE file or legal usage grant was found during local inspection.",
            "requirement_before_training_or_redistribution": "Verify source rights and attribution terms with the dataset owner before training, publishing, or redistributing any derived data.",
        },
        "sample_counts": label_counts,
        "accepted_samples": len(records),
        "rejected_samples": len(rejected),
        "rejected_reasons": {
            reason: sum(1 for item in rejected if item["error"] == reason)
            for reason in sorted({item["error"] for item in rejected if item["error"]})
        },
        "train_validation_plan": build_split_plan(records),
        "preview_valid": [
            {
                "label": record["label"],
                "source_path": record["source_path"],
                "feature_path": record["feature_path"],
            }
            for record in records[:5]
        ],
        "preview_rejected": [
            {
                "label": record["label"],
                "source_path": record["source_path"],
                "error": record["error"],
            }
            for record in rejected[:5]
        ],
    }

    metadata_path = output_dir / "metadata.json"
    metadata_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False))

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a small ISL preprocessing pilot from the project archive.")
    parser.add_argument("--archive", type=Path, default=ARCHIVE_PATH, help="Path to the zip archive to inspect.")
    parser.add_argument("--output-dir", type=Path, default=Path("generated/isl_pilot"), help="Directory for generated landmark output.")
    parser.add_argument("--max-per-class", type=int, default=20, help="Maximum images per selected class to process.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    summary = generate_dataset(args.archive, args.output_dir, SELECTED_CLASSES, args.max_per_class)
    print(json.dumps({
        "selected_classes": summary["selected_classes"],
        "sample_counts": summary["sample_counts"],
        "accepted_samples": summary["accepted_samples"],
        "rejected_samples": summary["rejected_samples"],
        "rejected_reasons": summary["rejected_reasons"],
        "exact_matches": list(summary["verification"]["exact_matches"].keys()),
        "candidate_aliases": [item["source_label"] for item in summary["verification"]["candidate_aliases"]],
    }, indent=2))
