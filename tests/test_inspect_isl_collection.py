import json
import tempfile
import unittest
from pathlib import Path

from scripts.inspect_isl_collection import load_export, summarize


class TestISLCollectionInspection(unittest.TestCase):
    def write_export(self, directory: str, records: list[dict]) -> Path:
        path = Path(directory) / "export.json"
        path.write_text(json.dumps({"schemaVersion": 2, "performances": records}), encoding="utf-8")
        return path

    def record(self, **overrides) -> dict:
        value = {
            "schemaVersion": 2,
            "preprocessingSchema": "mediapipe_hand_21_xyz_wrist_scale_v1",
            "consented": True,
            "performerConfirmedLabel": True,
            "labelVerified": True,
            "labelReviewReference": "review-source-01",
            "label": "YOU",
            "signerId": "signer-03",
            "sessionId": "session-01",
            "performanceId": "perf-001",
            "timestamp": "2026-10-11T00:00:00.000Z",
            "source": "local_webcam",
            "signerSplit": "development",
            "status": "accepted",
            "rejectionReason": None,
            "decisionReason": "explicit_label_confirmed_and_capture_complete",
            "durationMs": 2200,
            "frameCount": 12,
            "validFrameCount": 10,
            "features": [0.0] * 63,
        }
        value.update(overrides)
        return value

    def test_counts_are_grouped_by_class_signer_session_and_performance(self):
        records = [
            self.record(),
            self.record(performanceId="perf-002", label="HELP", sessionId="session-02"),
            self.record(performanceId="perf-003", status="rejected", rejectionReason="unclear", features=None),
        ]
        report = summarize(records)
        self.assertEqual(report["accepted_by_class"], {"HELP": 1, "YOU": 1})
        self.assertEqual(report["accepted_by_signer"], {"signer-03": 2})
        self.assertEqual(report["accepted_by_signer_session"], {
            "signer-03/session-01": 1,
            "signer-03/session-02": 1,
        })
        self.assertEqual(len(report["performances"]), 3)

    def test_rejects_duplicate_ids_and_invalid_feature_files_without_extracting(self):
        with tempfile.TemporaryDirectory() as directory:
            duplicate = self.record()
            path = self.write_export(directory, [duplicate, dict(duplicate)])
            with self.assertRaisesRegex(ValueError, "Duplicate performanceId"):
                load_export(path)

            invalid = self.record(features=[0.0])
            path = self.write_export(directory, [invalid])
            with self.assertRaisesRegex(ValueError, "63 features"):
                load_export(path)

            self.assertEqual(sorted(item.name for item in Path(directory).iterdir()), ["export.json"])


if __name__ == "__main__":
    unittest.main()
