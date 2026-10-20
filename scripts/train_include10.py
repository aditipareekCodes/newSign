#!/usr/bin/env python3
"""
train_include10.py  -  Standalone 4-class ISL hand-pose classifier trainer.

Trains on the 52 existing pilot landmark vectors in:
  generated/isl_pilot/landmarks/{FOOD,HELP,WATER,YOU}/*.npy

Saves artifacts to:
  generated/include10_model/include10_classifier.joblib
  generated/include10_model/include10_metadata.json

NEVER touches:
  backend/models/isl_classifier.joblib
  backend/models/isl_classifier.joblib.bak
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import StratifiedShuffleSplit
import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PILOT_LANDMARKS = PROJECT_ROOT / "generated" / "isl_pilot" / "landmarks"
OUTPUT_DIR = PROJECT_ROOT / "generated" / "include10_model"
OUTPUT_MODEL = OUTPUT_DIR / "include10_classifier.joblib"
OUTPUT_META = OUTPUT_DIR / "include10_metadata.json"

PROTECTED_PATHS = [
    PROJECT_ROOT / "backend" / "models" / "isl_classifier.joblib",
    PROJECT_ROOT / "backend" / "models" / "isl_classifier.joblib.bak",
]

MIN_SAMPLES_PER_CLASS = 5
TEST_FRACTION = 0.25
RANDOM_STATE = 42


def guard_production_paths():
    for protected in PROTECTED_PATHS:
        if OUTPUT_MODEL.resolve() == protected.resolve():
            raise RuntimeError(f"Output path would overwrite protected model: {protected}")


def load_landmarks(landmarks_root):
    if not landmarks_root.exists():
        raise FileNotFoundError(f"Landmarks directory not found: {landmarks_root}")
    X_list, y_list, counts, skipped = [], [], {}, {}
    for class_dir in sorted(landmarks_root.iterdir()):
        if not class_dir.is_dir():
            continue
        label = class_dir.name
        npy_files = sorted(class_dir.glob("*.npy"))
        accepted = 0
        for npy_file in npy_files:
            try:
                feat = np.load(npy_file, allow_pickle=False)
            except Exception as err:
                skipped[str(npy_file)] = str(err)
                continue
            if feat.shape != (63,) or not np.isfinite(feat).all():
                skipped[str(npy_file)] = f"bad shape {feat.shape} or non-finite"
                continue
            X_list.append(feat)
            y_list.append(label)
            accepted += 1
        counts[label] = accepted
    if not X_list:
        raise ValueError(f"No valid 63-dim landmark vectors found under {landmarks_root}.")
    return np.array(X_list, dtype=np.float32), np.array(y_list), counts, skipped


def main():
    print("=" * 60)
    print("SignVaani - Standalone 4-class ISL Pilot Trainer")
    print("=" * 60)

    guard_production_paths()
    print("\n[OK] Production model paths confirmed protected.")

    print(f"\nLoading landmarks from: {PILOT_LANDMARKS}")
    X, y, counts, skipped = load_landmarks(PILOT_LANDMARKS)
    print(f"Loaded {len(X)} samples across {len(counts)} classes:")
    for label, n in sorted(counts.items()):
        print(f"  {label:10s}: {n:3d} samples")
    if skipped:
        print(f"\nSkipped {len(skipped)} files (shown up to 5):")
        for path, reason in list(skipped.items())[:5]:
            print(f"  {Path(path).name}: {reason}")

    insufficient = [l for l, n in counts.items() if n < MIN_SAMPLES_PER_CLASS]
    if insufficient:
        print(f"\n[BLOCKER] Classes with < {MIN_SAMPLES_PER_CLASS} samples: {insufficient}. Halting.")
        sys.exit(1)

    print(f"\nStratified split: {int((1-TEST_FRACTION)*100)}% train / {int(TEST_FRACTION*100)}% test")
    splitter = StratifiedShuffleSplit(n_splits=1, test_size=TEST_FRACTION, random_state=RANDOM_STATE)
    train_idx, test_idx = next(splitter.split(X, y))
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    print(f"  Train: {len(X_train)} samples,  Test: {len(X_test)} samples")
    train_cc = {l: int(np.sum(y_train == l)) for l in sorted(counts)}
    test_cc  = {l: int(np.sum(y_test  == l)) for l in sorted(counts)}
    print(f"  Train per class: {train_cc}")
    print(f"  Test  per class: {test_cc}")

    print("\nTraining RandomForestClassifier (n_estimators=140, max_depth=20)...")
    clf = RandomForestClassifier(n_estimators=140, max_depth=20, min_samples_split=2,
                                  random_state=RANDOM_STATE, class_weight="balanced")
    clf.fit(X_train, y_train)
    print("  Training complete.")

    y_pred = clf.predict(X_test)
    acc = float(accuracy_score(y_test, y_pred))
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

    print(f"\n{'='*60}")
    print(f"Test accuracy: {acc*100:.1f}%  ({len(y_test)} held-out samples)")
    print(f"{'='*60}")
    print(f"\n{'Class':<12} {'Precision':>10} {'Recall':>8} {'F1':>8} {'Support':>9}")
    print("-" * 52)
    for label in sorted(counts):
        if label in report:
            r = report[label]
            print(f"{label:<12} {r['precision']:>10.3f} {r['recall']:>8.3f} {r['f1-score']:>8.3f} {int(r['support']):>9}")

    metadata = {
        "model_type": "RandomForestClassifier",
        "training_script": "scripts/train_include10.py",
        "input_dimensions": 63,
        "preprocessing_schema": "mediapipe_hand_21_xyz_wrist_scale_v1",
        "is_handedness_invariant": True,
        "training_mode": "pilot_real_4class",
        "data_source": "generated/isl_pilot/landmarks",
        "dataset_origin": "ISL_CSLRT_Corpus (via archive.zip pilot extraction)",
        "classes": sorted(counts.keys()),
        "n_total_samples": int(len(X)),
        "n_train_samples": int(len(X_train)),
        "n_test_samples": int(len(X_test)),
        "class_counts_total": {k: int(v) for k, v in counts.items()},
        "class_counts_train": train_cc,
        "class_counts_test": test_cc,
        "test_accuracy_pct": round(acc * 100, 2),
        "classification_report": report,
        "split_strategy": "stratified_shuffle_split_25pct_test",
        "random_state": RANDOM_STATE,
        "signer_independent_evaluation": False,
        "real_world_accuracy_established": False,
        "evaluation_status": "within_signer_stratified_split",
        "accuracy_scope": (
            "Within-signer stratified split only. ISL_CSLRT_Corpus provides no "
            "signer metadata. Accuracy is an optimistic upper bound."
        ),
        "provenance_disclaimer": (
            "Extracted from ISL_CSLRT_Corpus still frames. License terms must be "
            "confirmed with dataset owners before redistribution or publication."
        ),
        "protected_paths_not_modified": [str(p) for p in PROTECTED_PATHS],
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "skipped_files_count": len(skipped),
        "limitations": [
            "52 total samples across 4 classes - statistically very small.",
            "~13 test samples total - each sample shifts accuracy ~8 percentage points.",
            "Within-signer split; generalization to unseen signers is unknown.",
            "Static frame classifier, not a temporal sequence model.",
            "Dataset license (ISL_CSLRT_Corpus) not explicitly verified.",
        ],
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUTPUT_MODEL.exists(): OUTPUT_MODEL.unlink()
    if OUTPUT_META.exists(): OUTPUT_META.unlink()
    joblib.dump(clf, OUTPUT_MODEL)
    with OUTPUT_META.open("w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n[SAVED] Model:    {OUTPUT_MODEL}")
    print(f"[SAVED] Metadata: {OUTPUT_META}")
    print("\nLimitations:")
    for lim in metadata["limitations"]:
        print(f"  - {lim}")
    print(f"\n[CONFIRMED] backend/models/isl_classifier.joblib -- NOT modified.")
    print(f"[CONFIRMED] backend/models/isl_classifier.joblib.bak -- NOT modified.")


if __name__ == "__main__":
    main()
