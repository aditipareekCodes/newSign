#!/usr/bin/env python3
"""Validate and summarize a JSON export made by the local browser collector."""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

TARGET_LABELS = {
    "I", "NEED", "WATER", "HELP", "FAMILY", "THANK",
    "HELLO", "YOU", "HOME", "MEDICAL", "PLEASE", "FOOD", "PAIN",
}


def load_export(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 2:
        raise ValueError("Expected a SignVaani collection export with schemaVersion 2.")
    records = payload.get("performances")
    if not isinstance(records, list):
        raise ValueError("Export field 'performances' must be a list.")

    seen_ids: set[str] = set()
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValueError(f"Performance at index {index} is not an object.")
        performance_id = record.get("performanceId")
        if not isinstance(performance_id, str) or not performance_id.strip():
            raise ValueError(f"Performance at index {index} has no valid performanceId.")
        if performance_id in seen_ids:
            raise ValueError(f"Duplicate performanceId: {performance_id}")
        seen_ids.add(performance_id)
        if record.get("label") not in TARGET_LABELS:
            raise ValueError(f"Performance {performance_id} has a non-canonical label.")
        for required in ("signerId", "sessionId", "timestamp", "source", "signerSplit", "status", "decisionReason"):
            if not isinstance(record.get(required), str) or not record[required].strip():
                raise ValueError(f"Performance {performance_id} is missing valid {required}.")
        if record["status"] not in {"accepted", "rejected"}:
            raise ValueError(f"Performance {performance_id} has invalid status.")
        if record["signerSplit"] not in {"final_test", "development"}:
            raise ValueError(f"Performance {performance_id} has invalid signerSplit.")
        if record["status"] == "accepted":
            if (
                record.get("schemaVersion") != 2
                or record.get("preprocessingSchema")
                != "mediapipe_hand_21_xyz_wrist_scale_v1"
                or record.get("consented") is not True
                or record.get("performerConfirmedLabel") is not True
                or record.get("labelVerified") is not True
                or not isinstance(record.get("labelReviewReference"), str)
                or not re.fullmatch(
                    r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}",
                    record["labelReviewReference"].strip(),
                )
            ):
                raise ValueError(
                    f"Accepted performance {performance_id} lacks consent, performer confirmation, "
                    "independent label-review, or preprocessing metadata."
                )
            features = record.get("features")
            if not isinstance(features, list) or len(features) != 63:
                raise ValueError(f"Accepted performance {performance_id} must have 63 features.")
            if any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in features):
                raise ValueError(f"Accepted performance {performance_id} contains non-finite or non-numeric features.")
            if record.get("durationMs", 0) < 1800 or record.get("validFrameCount", 0) < 8:
                raise ValueError(f"Accepted performance {performance_id} does not meet capture completeness requirements.")
        elif not isinstance(record.get("rejectionReason"), str) or not record["rejectionReason"].strip():
            raise ValueError(f"Rejected performance {performance_id} needs a rejection reason.")
    return records


def summarize(records: list[dict[str, Any]]) -> dict[str, Any]:
    accepted = [record for record in records if record["status"] == "accepted"]
    def count_by(key: str, source: list[dict[str, Any]]) -> dict[str, int]:
        return dict(sorted(Counter(str(record[key]) for record in source).items()))

    return {
        "total_performances": len(records),
        "accepted_performances": len(accepted),
        "rejected_performances": len(records) - len(accepted),
        "accepted_by_class": dict(sorted(Counter(record["label"] for record in accepted).items())),
        "all_by_class": count_by("label", records),
        "accepted_by_signer": dict(sorted(Counter(record["signerId"] for record in accepted).items())),
        "all_by_signer": count_by("signerId", records),
        "accepted_by_signer_session": dict(sorted(Counter(
            f"{record['signerId']}/{record['sessionId']}" for record in accepted
        ).items())),
        "all_by_signer_session": dict(sorted(Counter(
            f"{record['signerId']}/{record['sessionId']}" for record in records
        ).items())),
        "performances": [
            {
                "performanceId": record["performanceId"],
                "label": record["label"],
                "signerId": record["signerId"],
                "sessionId": record["sessionId"],
                "signerSplit": record["signerSplit"],
                "status": record["status"],
                "timestamp": record["timestamp"],
            }
            for record in records
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export_json", type=Path, help="Path to the locally exported JSON file.")
    args = parser.parse_args()
    records = load_export(args.export_json)
    print(json.dumps(summarize(records), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
