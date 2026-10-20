#!/usr/bin/env python3
"""
train_user_experimental.py
==========================
Experimental ISL classifier trained exclusively on one user's locally
collected samples (signvaani-isl-performances.json).

WARNING: SINGLE-SIGNER DATA -- all samples come from one person.
   Cross-validation accuracy measures self-consistency, NOT generalisation
   to other signers. Do not use this model in production or claim it is
   a reliable ISL recogniser.

Outputs (all under generated/user_experimental_model/):
  isl_user_experimental.joblib   -- trained pipeline (StandardScaler + RBF-SVM)
  metadata.json                  -- classes, preprocessing schema, CV metrics
  evaluation_report.txt          -- human-readable per-class report + confusion matrix

Usage:
  python scripts/train_user_experimental.py
  python scripts/train_user_experimental.py --dataset generated/user_dataset/signvaani-isl-performances.json
  python scripts/train_user_experimental.py --cv-folds 10 --no-baseline
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import textwrap
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

# ── Paths ──────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = (
    PROJECT_ROOT / "generated" / "user_dataset" / "signvaani-isl-performances.json"
)
OUTPUT_DIR = PROJECT_ROOT / "generated" / "user_experimental_model"

# These paths are NEVER written to.
_PROTECTED_PATHS = [
    PROJECT_ROOT / "backend" / "models" / "isl_classifier.joblib",
    PROJECT_ROOT / "backend" / "models" / "isl_classifier.joblib.bak",
]

PREPROCESSING_SCHEMA = "mediapipe_hand_21_xyz_wrist_scale_v1"
FEATURE_DIM = 63
ACCEPTED_STATUS = "accepted"


# ── Safeguard ──────────────────────────────────────────────────────────────────
def _assert_protected_paths_intact() -> None:
    for p in _PROTECTED_PATHS:
        if not p.exists():
            warnings.warn(
                f"Protected production model not found at {p}. "
                "This script does NOT create or modify it.",
                stacklevel=2,
            )


# ── Dataset loading & validation ───────────────────────────────────────────────
def load_and_validate(
    dataset_path: Path,
) -> tuple[np.ndarray, np.ndarray, list[dict[str, Any]]]:
    """
    Load accepted performances from a SignVaani schemaVersion-2 JSON export.
    Returns (X, y, records) where X is float32 (N, 63) and y is string labels.
    Raises ValueError for any structural or quality problem.
    """
    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Dataset not found at: {dataset_path}\n"
            "Copy your exported JSON to that path and retry."
        )

    raw = json.loads(dataset_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or raw.get("schemaVersion") != 2:
        raise ValueError("Expected a SignVaani export with schemaVersion=2.")

    all_records: list[dict] = raw.get("performances", [])
    if not isinstance(all_records, list):
        raise ValueError("'performances' must be a list.")

    accepted = [r for r in all_records if r.get("status") == ACCEPTED_STATUS]
    if not accepted:
        raise ValueError("No accepted performances found in the dataset.")

    errors: list[str] = []
    seen_ids: set[str] = set()
    valid_records: list[dict] = []

    for i, rec in enumerate(accepted):
        pid = rec.get("performanceId", f"<index {i}>")

        if pid in seen_ids:
            errors.append(f"{pid}: duplicate performanceId")
            continue
        seen_ids.add(pid)

        schema = rec.get("preprocessingSchema")
        if schema != PREPROCESSING_SCHEMA:
            errors.append(f"{pid}: wrong preprocessingSchema '{schema}'")

        features = rec.get("features")
        if not isinstance(features, list):
            errors.append(f"{pid}: features is not a list")
            continue
        if len(features) != FEATURE_DIM:
            errors.append(
                f"{pid}: expected {FEATURE_DIM} features, got {len(features)}"
            )
            continue
        if any(
            not isinstance(v, (int, float)) or not math.isfinite(v)
            for v in features
        ):
            errors.append(
                f"{pid}: features contain non-finite or non-numeric values"
            )
            continue

        # featureSequence is optional -- validate if present, but never flatten
        seq = rec.get("featureSequence")
        if seq is not None:
            if not isinstance(seq, list):
                errors.append(f"{pid}: featureSequence is not a list")
            else:
                for fi, frame in enumerate(seq):
                    if not isinstance(frame, list) or len(frame) != FEATURE_DIM:
                        errors.append(
                            f"{pid}: featureSequence frame {fi} has wrong length"
                        )
                        break

        valid_records.append(rec)

    if errors:
        msg = "\n  ".join(errors[:20])
        raise ValueError(
            f"{len(errors)} validation error(s) found in dataset:\n  {msg}"
        )

    X = np.array([r["features"] for r in valid_records], dtype=np.float32)
    y = np.array([r["label"] for r in valid_records], dtype=object)
    return X, y, valid_records


# ── Dataset summary ────────────────────────────────────────────────────────────
def dataset_summary(
    y: np.ndarray, records: list[dict], verbose: bool = True
) -> str:
    from collections import Counter

    label_counts = dict(sorted(Counter(y.tolist()).items()))
    signers = {r.get("signerId", "unknown") for r in records}
    sessions = {
        f"{r.get('signerId')}/{r.get('sessionId')}" for r in records
    }
    has_seq = sum(1 for r in records if r.get("featureSequence"))
    seq_lens = [
        len(r["featureSequence"]) for r in records if r.get("featureSequence")
    ]

    lines = [
        "── Dataset summary ────────────────────────────────────────────",
        f"  Total accepted samples : {len(records)}",
        f"  Classes ({len(label_counts)})           : {', '.join(label_counts.keys())}",
        f"  Samples per class      : {list(label_counts.values())}",
    ]
    if records:
        lines += [
            f"  Unique signers         : {len(signers)} -- {signers}",
            f"  Unique sessions        : {len(sessions)}",
        ]
    lines += [
        f"  Preprocessing schema   : {PREPROCESSING_SCHEMA}",
        f"  Feature dimensions     : {FEATURE_DIM}",
        f"  Records with sequence  : {has_seq} / {len(y)}",
    ]
    if seq_lens:
        lines.append(
            f"  Sequence length range  : {min(seq_lens)}-{max(seq_lens)} frames"
        )
    lines.append(
        "\n  WARNING: SINGLE-SIGNER DATASET -- all samples are from one person.\n"
        "  CV accuracy reflects self-consistency, NOT cross-user generalisation."
    )
    return "\n".join(lines)


# ── Model building ─────────────────────────────────────────────────────────────
def build_svm_pipeline() -> Pipeline:
    """RBF-SVM inside a StandardScaler pipeline."""
    return Pipeline([
        ("scaler", StandardScaler()),
        ("clf", SVC(
            kernel="rbf",
            C=10.0,
            gamma="scale",
            probability=True,
            random_state=42,
            class_weight="balanced",
        )),
    ])


def build_baseline() -> Pipeline:
    """Most-frequent class baseline."""
    return Pipeline([
        ("clf", DummyClassifier(strategy="most_frequent", random_state=42)),
    ])


# ── Cross-validation ───────────────────────────────────────────────────────────
def run_cv(
    model: Pipeline,
    X: np.ndarray,
    y: np.ndarray,
    n_splits: int,
    label: str,
) -> dict[str, Any]:
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    scoring = {
        "accuracy": "accuracy",
        "f1_macro": "f1_macro",
        "f1_weighted": "f1_weighted",
    }
    results = cross_validate(
        model, X, y, cv=cv, scoring=scoring, return_train_score=True
    )
    mean = lambda k: float(np.mean(results[k]))
    std  = lambda k: float(np.std(results[k]))
    return {
        "model": label,
        "cv_folds": n_splits,
        "test_accuracy_mean":    round(mean("test_accuracy")    * 100, 2),
        "test_accuracy_std":     round(std("test_accuracy")     * 100, 2),
        "test_f1_macro_mean":    round(mean("test_f1_macro")    * 100, 2),
        "test_f1_macro_std":     round(std("test_f1_macro")     * 100, 2),
        "test_f1_weighted_mean": round(mean("test_f1_weighted") * 100, 2),
        "test_f1_weighted_std":  round(std("test_f1_weighted")  * 100, 2),
        "train_accuracy_mean":   round(mean("train_accuracy")   * 100, 2),
    }


# ── Evaluation report text ─────────────────────────────────────────────────────
def build_report(
    model: Pipeline,
    X: np.ndarray,
    y: np.ndarray,
    records: list[dict],
    cv_results: dict[str, Any],
    baseline_cv: dict[str, Any] | None,
    dataset_path: Path,
    output_dir: Path,
    n_splits: int,
) -> str:
    classes = sorted(set(y.tolist()))
    y_pred = model.predict(X)
    clf_report = classification_report(y, y_pred, target_names=classes, digits=3)
    cm = confusion_matrix(y, y_pred, labels=classes)

    cm_lines = ["Confusion matrix (rows=true, cols=predicted):"]
    header = "           " + "  ".join(f"{c:>8}" for c in classes)
    cm_lines.append(header)
    for i, row_vals in enumerate(cm):
        cm_lines.append(
            f"  {classes[i]:>9}" + "  ".join(f"{v:>8}" for v in row_vals)
        )

    warning_block = (
        "=" * 72 + "\n"
        "  IMPORTANT LIMITATIONS\n"
        "=" * 72 + "\n"
        "  1. ALL SAMPLES COME FROM ONE SIGNER. Accuracy = how well the\n"
        "     model memorises one person's style, not ISL generalisation.\n"
        "  2. 10 samples per class is far too few for reliable statistics.\n"
        "  3. This model is NOT integrated into the application.\n"
        "  4. Do not report these metrics as ISL recognition performance.\n"
        "=" * 72
    )

    lines = [
        warning_block,
        "",
        f"Generated   : {datetime.now(timezone.utc).isoformat()}",
        f"Dataset     : {dataset_path}",
        f"Output dir  : {output_dir}",
        "",
        dataset_summary(y, records, verbose=True),
        "",
        "── Cross-validation results ───────────────────────────────────────────",
        f"  Folds           : {n_splits}-fold stratified",
        f"  CV accuracy     : {cv_results['test_accuracy_mean']:.1f}% +/- {cv_results['test_accuracy_std']:.1f}%",
        f"  CV F1-macro     : {cv_results['test_f1_macro_mean']:.1f}% +/- {cv_results['test_f1_macro_std']:.1f}%",
        f"  CV F1-weighted  : {cv_results['test_f1_weighted_mean']:.1f}% +/- {cv_results['test_f1_weighted_std']:.1f}%",
    ]

    if baseline_cv:
        lines += [
            "",
            "── Baseline (most-frequent) ───────────────────────────────────────────",
            f"  CV accuracy     : {baseline_cv['test_accuracy_mean']:.1f}% +/- {baseline_cv['test_accuracy_std']:.1f}%",
        ]

    lines += [
        "",
        "── In-sample report (whole dataset -- do NOT treat as test accuracy) ───",
        "",
        clf_report,
        "",
    ] + cm_lines + [
        "",
        "── Model details ──────────────────────────────────────────────────────",
        "  Pipeline   : StandardScaler -> SVC(kernel=rbf, C=10, gamma=scale, balanced)",
        f"  Classes    : {classes}",
        f"  Input      : {FEATURE_DIM} floats (wrist-centred, palm-scaled xyz x 21 landmarks)",
        f"  Schema     : {PREPROCESSING_SCHEMA}",
        "",
        "── Retrain command ────────────────────────────────────────────────────",
        "  python scripts/train_user_experimental.py",
        "     --dataset generated/user_dataset/signvaani-isl-performances.json",
        "",
    ]
    return "\n".join(lines)


# ── Main ───────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train an experimental ISL classifier on user-collected data."
    )
    parser.add_argument(
        "--dataset", type=Path, default=DEFAULT_DATASET,
        help="Path to signvaani-isl-performances.json (default: %(default)s)",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=OUTPUT_DIR,
        help="Directory for all experimental outputs (default: %(default)s)",
    )
    parser.add_argument(
        "--cv-folds", type=int, default=5,
        help="Stratified CV folds (default: 5; hard cap = samples-per-class)",
    )
    parser.add_argument(
        "--no-baseline", action="store_true",
        help="Skip the most-frequent baseline comparison",
    )
    args = parser.parse_args()

    # Safeguards
    _assert_protected_paths_intact()
    for protected in _PROTECTED_PATHS:
        if args.output_dir.resolve() == protected.parent.resolve():
            print(
                f"ERROR: --output-dir cannot be the production models directory.",
                file=sys.stderr,
            )
            sys.exit(1)

    # 1. Load
    print(f"\n[1/6] Loading dataset: {args.dataset}")
    X, y, records = load_and_validate(args.dataset)
    print(dataset_summary(y, records))

    n_classes = len(set(y.tolist()))
    max_folds = int(len(y) / n_classes)
    if args.cv_folds > max_folds:
        print(
            f"\n  Capping --cv-folds from {args.cv_folds} to {max_folds}."
        )
        args.cv_folds = max_folds

    # 2. CV on SVM
    print(f"\n[2/6] Running {args.cv_folds}-fold stratified CV on RBF-SVM ...")
    svm_cv = run_cv(build_svm_pipeline(), X, y, args.cv_folds, "RBF-SVM")
    print(
        f"       CV accuracy : {svm_cv['test_accuracy_mean']:.1f}% "
        f"+/- {svm_cv['test_accuracy_std']:.1f}%"
    )
    print(
        f"       CV F1-macro : {svm_cv['test_f1_macro_mean']:.1f}% "
        f"+/- {svm_cv['test_f1_macro_std']:.1f}%"
    )

    # 3. Baseline
    baseline_cv: dict | None = None
    if not args.no_baseline:
        print(f"\n[3/6] Running {args.cv_folds}-fold CV on most-frequent baseline ...")
        baseline_cv = run_cv(
            build_baseline(), X, y, args.cv_folds, "Baseline"
        )
        print(
            f"       Baseline CV accuracy : {baseline_cv['test_accuracy_mean']:.1f}% "
            f"+/- {baseline_cv['test_accuracy_std']:.1f}%"
        )

    # 4. Final fit
    print("\n[4/6] Fitting final model on all samples ...")
    final_model = build_svm_pipeline()
    final_model.fit(X, y)
    # Sanity-check: model must accept 63-D input
    test_vec = np.zeros((1, FEATURE_DIM), dtype=np.float32)
    assert final_model.predict(test_vec).shape == (1,), "predict shape mismatch"
    assert final_model.predict_proba(test_vec).shape == (1, n_classes), "proba shape mismatch"
    print("       Sanity-check: OK (accepts 63-feature vector, outputs probabilities)")

    # 5. Save
    print(f"\n[5/6] Saving outputs to: {args.output_dir}")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    model_path = args.output_dir / "isl_user_experimental.joblib"
    joblib.dump(final_model, model_path)
    print(f"       Model    : {model_path}")

    classes_sorted = sorted(set(y.tolist()))
    metadata = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "script": "scripts/train_user_experimental.py",
        "dataset": str(args.dataset),
        "model_type": "Pipeline(StandardScaler, SVC(rbf))",
        "preprocessing_schema": PREPROCESSING_SCHEMA,
        "feature_dimensions": FEATURE_DIM,
        "feature_description": (
            "63 floats: wrist-centred, palm-length-scaled xyz for 21 MediaPipe "
            "hand landmarks. Order: [x0,y0,z0, x1,y1,z1, ..., x20,y20,z20]. "
            "Landmark 0 = wrist (always 0,0,0 after centering)."
        ),
        "classes": classes_sorted,
        "n_classes": len(classes_sorted),
        "n_samples": int(len(y)),
        "n_samples_per_class": {c: int((y == c).sum()) for c in classes_sorted},
        "cv_folds": args.cv_folds,
        "cv_accuracy_pct": svm_cv["test_accuracy_mean"],
        "cv_accuracy_std_pct": svm_cv["test_accuracy_std"],
        "cv_f1_macro_pct": svm_cv["test_f1_macro_mean"],
        "cv_f1_macro_std_pct": svm_cv["test_f1_macro_std"],
        "baseline_cv_accuracy_pct": (
            baseline_cv["test_accuracy_mean"] if baseline_cv else None
        ),
        "svm_hyperparameters": {
            "C": 10.0,
            "kernel": "rbf",
            "gamma": "scale",
            "class_weight": "balanced",
        },
        "IMPORTANT_LIMITATIONS": [
            "All samples come from ONE signer -- not a cross-user evaluation.",
            "10 samples per class is far below what is needed for reliable stats.",
            "CV accuracy measures memorisation of one signer's style.",
            "This model is NOT integrated into the SignVaani application.",
            "Do not use these metrics to claim reliable ISL recognition accuracy.",
        ],
        "production_model_untouched": True,
        "production_model_path": "backend/models/isl_classifier.joblib",
    }
    meta_path = args.output_dir / "metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"       Metadata : {meta_path}")

    report_text = build_report(
        final_model, X, y, records, svm_cv, baseline_cv,
        args.dataset, args.output_dir, args.cv_folds,
    )
    report_path = args.output_dir / "evaluation_report.txt"
    report_path.write_text(report_text, encoding="utf-8")
    print(f"       Report   : {report_path}")

    # 6. Summary
    print("\n[6/6] Done.\n")
    print("=" * 64)
    print("  RESULTS SUMMARY")
    print("=" * 64)
    print(f"  Classes         : {classes_sorted}")
    print(f"  Samples         : {len(y)}  ({len(y)//len(classes_sorted)} per class)")
    print(f"  CV folds        : {args.cv_folds}")
    print(f"  SVM CV accuracy : {svm_cv['test_accuracy_mean']:.1f}% +/- {svm_cv['test_accuracy_std']:.1f}%")
    print(f"  SVM CV F1-macro : {svm_cv['test_f1_macro_mean']:.1f}% +/- {svm_cv['test_f1_macro_std']:.1f}%")
    if baseline_cv:
        print(f"  Baseline acc    : {baseline_cv['test_accuracy_mean']:.1f}% +/- {baseline_cv['test_accuracy_std']:.1f}%")
    print(f"\n  Outputs:")
    print(f"    {args.output_dir}/")
    print(f"    ├── isl_user_experimental.joblib")
    print(f"    ├── metadata.json")
    print(f"    └── evaluation_report.txt")
    print("\n  WARNING: Single-signer data. Metrics do NOT imply cross-user reliability.")
    print("=" * 64 + "\n")


if __name__ == "__main__":
    main()
