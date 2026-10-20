import unittest
from pathlib import Path

import numpy as np

from scripts.isl_preprocessing_pilot import (
    CANDIDATE_ALIAS_LABELS,
    TARGET_VOCAB,
    build_split_plan,
    preprocess_hand_landmarks,
    verify_target_vocabulary,
)


class TestISLPilot(unittest.TestCase):
    def test_preprocess_hand_landmarks_has_63_dimensions(self):
        wrist = [0.0, 0.0, 0.0]
        middle = [0.1, 0.0, 0.0]
        landmarks = []
        for i in range(21):
            if i == 0:
                item = wrist
            elif i == 9:
                item = middle
            else:
                item = [0.05 * i, 0.02 * i, -0.01 * i]
            landmarks.append(item)
        features = preprocess_hand_landmarks(landmarks)
        self.assertEqual(features.shape, (63,))
        self.assertTrue(np.isfinite(features).all())

    def test_preprocessing_scale_threshold_matches_frontend(self):
        landmarks = [[0.0, 0.0, 0.0] for _ in range(21)]
        landmarks[9] = [0.0005, 0.0, 0.0]
        landmarks[1] = [0.0005, 0.0, 0.0]

        features = preprocess_hand_landmarks(landmarks)

        self.assertAlmostEqual(float(features[3]), 0.0005)

    def test_label_verification_keeps_candidate_mapping_separate(self):
        labels = {
            "YOU": ["a"],
            "HELP": ["b"],
            "WATER": ["c"],
            "FOOD": ["d"],
            "I_ME_MINE_MY": ["e"],
        }
        info = verify_target_vocabulary(labels)
        self.assertIn("YOU", info["exact_matches"])
        self.assertIn("I_ME_MINE_MY", [item["source_label"] for item in info["candidate_aliases"]])
        self.assertNotIn("I", info["exact_matches"])
        self.assertIn("I", TARGET_VOCAB)

    def test_missing_hand_state_is_rejected(self):
        labels = {"YOU": ["y1.jpg"], "HELP": ["h1.jpg"], "FOOD": ["f1.jpg"]}
        info = verify_target_vocabulary(labels)
        self.assertEqual(info["missing_targets"], [
            "I",
            "NEED",
            "WATER",
            "FAMILY",
            "THANK",
            "HOME",
            "MEDICAL",
            "PLEASE",
            "PAIN",
        ])
        self.assertIn("I_ME_MINE_MY", CANDIDATE_ALIAS_LABELS)

    def test_blank_image_is_flagged_as_no_hand(self):
        from scripts.isl_preprocessing_pilot import MODEL_PATH, extract_landmark_feature, make_hand_landmarker
        from PIL import Image
        import io

        landmarker = make_hand_landmarker(MODEL_PATH)
        image = Image.new("RGB", (256, 256), color=(0, 0, 0))
        payload = io.BytesIO()
        image.save(payload, format="PNG")
        feature, reason = extract_landmark_feature(payload.getvalue(), landmarker)
        self.assertIsNone(feature)
        self.assertEqual(reason, "no_hand")

    def test_split_plan_prevents_duplicate_sources_in_validation(self):
        records = [
            {"source_path": "YOU/you_1.jpg", "label": "YOU"},
            {"source_path": "YOU/you_2.jpg", "label": "YOU"},
            {"source_path": "HELP/help_1.jpg", "label": "HELP"},
            {"source_path": "HELP/help_2.jpg", "label": "HELP"},
            {"source_path": "WATER/water_1.jpg", "label": "WATER"},
        ]
        plan = build_split_plan(records, split_ratio=0.4)
        train_sources = {item["source_path"] for item in plan["train"]}
        val_sources = {item["source_path"] for item in plan["validation"]}
        self.assertTrue(train_sources.isdisjoint(val_sources))
        self.assertGreater(len(plan["train"]), 0)


if __name__ == "__main__":
    unittest.main()
