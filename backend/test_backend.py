"""
Automated Backend & Persistence Verification Suite
Tests SQLite initialization, password hashing, token generation, user authentication,
cross-user data isolation, OTP & password reset, translation, and recognition endpoints.
"""

import sys
import os
import sqlite3
import unittest
from unittest.mock import patch
from datetime import datetime, timezone

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import init_db, get_db
from app.config import settings
from app.services.auth_service import (
    AuthService,
    RegistrationOtpRateLimitError,
    RegistrationOtpUnavailableError,
    hash_password,
    verify_password,
)
from app.services.email_service import send_otp_email
from app.services.phrase_service import PhraseService
from app.services.history_service import HistoryService
from app.services.token_service import create_access_token, verify_access_token
from app.routers.translation import translate_text, TranslateRequest
from app.routers.recognition import get_model_status

class TestSignVaaniBackend(unittest.TestCase):
    TEST_EMAIL = "test_user_phase2@signvaani.com"
    SECOND_USER = "second_user@signvaani.com"
    REGISTRATION_EMAIL = "new_registration@signvaani.com"
    ATTEMPT_EMAIL = "attempt_registration@signvaani.com"

    @classmethod
    def _cleanup_test_users(cls):
        """Remove test users and all their data from DB (idempotent)."""
        with get_db() as conn:
            cur = conn.cursor()
            for email in [
                cls.TEST_EMAIL,
                cls.SECOND_USER,
                cls.REGISTRATION_EMAIL,
                cls.ATTEMPT_EMAIL,
                "token_expiry_registration@signvaani.com",
                "expired_registration@signvaani.com",
                "delivery_failure@signvaani.com",
                "rate_limited_registration@signvaani.com",
                "ip_limited_one@signvaani.com",
                "ip_limited_two@signvaani.com",
                "other_registration@signvaani.com",
            ]:
                cur.execute(
                    "DELETE FROM registration_verifications WHERE email = ?;",
                    (email,),
                )
                cur.execute("DELETE FROM password_resets WHERE user_email = ?;", (email,))
                cur.execute("DELETE FROM history_items WHERE user_email = ?;", (email,))
                cur.execute("DELETE FROM saved_phrases WHERE user_email = ?;", (email,))
                cur.execute("DELETE FROM users WHERE email = ?;", (email,))

    @classmethod
    def setUpClass(cls):
        init_db()
        AuthService.ensure_demo_user()
        cls._cleanup_test_users()

    @classmethod
    def tearDownClass(cls):
        cls._cleanup_test_users()

    def test_01_password_hashing(self):
        pwd = "TestSecretPassword@123"
        hashed = hash_password(pwd)
        self.assertIn("$", hashed)
        self.assertTrue(verify_password(pwd, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_02_demo_user_exists(self):
        demo = AuthService.get_by_email("demo@signvaani.com")
        self.assertIsNotNone(demo)
        self.assertEqual(demo["email"], "demo@signvaani.com")
        self.assertEqual(demo["name"], "Arjun Verma")

    def test_03_authenticate_user(self):
        auth_success = AuthService.authenticate("demo@signvaani.com", "SignVaani@123")
        self.assertIsNotNone(auth_success)
        self.assertEqual(auth_success["email"], "demo@signvaani.com")

        auth_fail = AuthService.authenticate("demo@signvaani.com", "InvalidPassword")
        self.assertIsNone(auth_fail)

    def test_04_user_registration(self):
        created = AuthService.register("Test User", self.TEST_EMAIL, "+91 99999 88888", "Phase2Secret@123")
        self.assertIsNotNone(created)
        self.assertEqual(created["email"], self.TEST_EMAIL)

        fetched = AuthService.get_by_email(self.TEST_EMAIL)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["name"], "Test User")

    def test_05_update_preferences(self):
        updated = AuthService.update_preferences(self.TEST_EMAIL, {
            "preferredLanguage": "Hindi",
            "speechRate": 1.25,
            "theme": "dark"
        })
        self.assertIsNotNone(updated)
        self.assertEqual(updated["preferredLanguage"], "Hindi")
        self.assertEqual(updated["speechRate"], 1.25)
        self.assertEqual(updated["theme"], "dark")

    def test_06_phrase_crud(self):
        created = PhraseService.create_phrase(
            user_email=self.TEST_EMAIL,
            original_text="Emergency assistance required",
            translations={"English": "Emergency assistance required", "Hindi": "आपातकालीन सहायता की आवश्यकता है", "Marathi": "तातडीच्या मदतीची गरज आहे"},
            original_language="English",
            selected_language="English"
        )
        self.assertIsNotNone(created["id"])
        phrase_id = created["id"]

        phrases = PhraseService.list_phrases(self.TEST_EMAIL)
        self.assertTrue(any(p["id"] == phrase_id for p in phrases))

        updated = PhraseService.update_phrase(phrase_id, self.TEST_EMAIL, {
            "originalText": "Emergency assistance required now"
        })
        self.assertIsNotNone(updated)
        self.assertEqual(updated["originalText"], "Emergency assistance required now")

        deleted = PhraseService.delete_phrase(phrase_id, self.TEST_EMAIL)
        self.assertTrue(deleted)

    def test_07_history_crud(self):
        item = HistoryService.create_history_item(
            user_email=self.TEST_EMAIL,
            text="WATER",
            translation="पानी",
            language="Hindi",
            confidence=95.0,
            source="recognition"
        )
        self.assertIsNotNone(item["id"])
        item_id = item["id"]

        history = HistoryService.list_history(self.TEST_EMAIL)
        self.assertTrue(any(h["id"] == item_id for h in history))

        deleted = HistoryService.delete_history_item(item_id, self.TEST_EMAIL)
        self.assertTrue(deleted)

        HistoryService.create_history_item(self.TEST_EMAIL, "HELP", "मदद", "Hindi")
        self.assertTrue(HistoryService.clear_history(self.TEST_EMAIL))
        empty_history = HistoryService.list_history(self.TEST_EMAIL)
        self.assertEqual(len(empty_history), 0)

    def test_08_token_service(self):
        token = create_access_token(self.TEST_EMAIL, expires_in_seconds=3600)
        self.assertIsInstance(token, str)
        self.assertIn(".", token)

        verified_email = verify_access_token(token)
        self.assertEqual(verified_email, self.TEST_EMAIL.lower())

        invalid_token = token + "corrupted"
        self.assertIsNone(verify_access_token(invalid_token))

    def test_09_otp_and_password_reset(self):
        with patch(
            "app.services.auth_service.send_otp_email",
            return_value=False,
        ):
            ok, status_code, message, dev_code = AuthService.create_otp(self.TEST_EMAIL)
        self.assertTrue(ok)
        self.assertIn(status_code, ["delivered", "unconfigured"])

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT otp_code FROM password_resets WHERE user_email = ? ORDER BY created_at DESC LIMIT 1;", (self.TEST_EMAIL,))
            row = cur.fetchone()
            self.assertIsNotNone(row)
            actual_code = row["otp_code"]

        verify_ok, reset_token, verify_msg = AuthService.verify_otp(self.TEST_EMAIL, actual_code)
        self.assertTrue(verify_ok)
        self.assertIsNotNone(reset_token)

        reset_ok, reset_msg = AuthService.reset_password_with_token(reset_token, "BrandNewSecret@123")
        self.assertTrue(reset_ok)

        # Authenticate with new password
        auth_new = AuthService.authenticate(self.TEST_EMAIL, "BrandNewSecret@123")
        self.assertIsNotNone(auth_new)

    def test_09a_registration_otp_hashing_attempts_and_one_time_registration(self):
        captured_codes = []
        with (
            patch.object(settings, "SECRET_KEY", "registration-test-secret-key-with-32-bytes"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "test-user"),
            patch(
                "app.services.auth_service.send_otp_email",
                side_effect=lambda _email, code, _purpose: captured_codes.append(code) or True,
            ),
        ):
            AuthService.request_registration_otp(self.REGISTRATION_EMAIL, "127.0.0.1")

            with get_db() as conn:
                challenge = conn.execute(
                    "SELECT * FROM registration_verifications WHERE email = ?;",
                    (self.REGISTRATION_EMAIL,),
                ).fetchone()
            self.assertIsNotNone(challenge)
            self.assertEqual(challenge["status"], "sent")
            self.assertNotEqual(challenge["otp_hash"], captured_codes[0])
            self.assertNotIn("otp_code", challenge.keys())

            token, _ = AuthService.verify_registration_otp(
                self.REGISTRATION_EMAIL,
                "000000",
            )
            self.assertIsNone(token)
            with get_db() as conn:
                attempts = conn.execute(
                    "SELECT attempts FROM registration_verifications WHERE id = ?;",
                    (challenge["id"],),
                ).fetchone()["attempts"]
            self.assertEqual(attempts, 1)

            token, _ = AuthService.verify_registration_otp(
                self.REGISTRATION_EMAIL,
                captured_codes[0],
            )
            self.assertIsNotNone(token)
            self.assertGreaterEqual(len(token), 32)

            self.assertIsNone(
                AuthService.register_verified(
                    "Wrong Email",
                    "other_registration@signvaani.com",
                    "",
                    "RegistrationSecret@123",
                    token,
                )
            )
            duplicate = AuthService.register(
                "Duplicate Registration",
                self.REGISTRATION_EMAIL,
                "",
                "RegistrationSecret@123",
            )
            self.assertIsNotNone(duplicate)
            with self.assertRaises(sqlite3.IntegrityError):
                AuthService.register_verified(
                    "New Registration",
                    self.REGISTRATION_EMAIL,
                    "+91 98765 43210",
                    "RegistrationSecret@123",
                    token,
                )
            with get_db() as conn:
                status = conn.execute(
                    """
                    SELECT status FROM registration_verifications
                    WHERE email = ?;
                    """,
                    (self.REGISTRATION_EMAIL,),
                ).fetchone()["status"]
                conn.execute("DELETE FROM users WHERE email = ?;", (self.REGISTRATION_EMAIL,))
            self.assertEqual(status, "verified")
            created = AuthService.register_verified(
                "New Registration",
                self.REGISTRATION_EMAIL,
                "+91 98765 43210",
                "RegistrationSecret@123",
                token,
            )
            self.assertIsNotNone(created)
            self.assertEqual(created["email"], self.REGISTRATION_EMAIL)
            self.assertIsNone(
                AuthService.register_verified(
                    "New Registration",
                    self.REGISTRATION_EMAIL,
                    "+91 98765 43210",
                    "RegistrationSecret@123",
                    token,
                )
            )

    def test_09b_registration_otp_attempt_limit_expiry_and_delivery_failure(self):
        captured_codes = []
        smtp_mock = patch(
            "app.services.auth_service.send_otp_email",
            side_effect=lambda _email, code, _purpose: captured_codes.append(code) or True,
        )
        with (
            patch.object(settings, "SECRET_KEY", "registration-test-secret-key-with-32-bytes"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "test-user"),
            smtp_mock,
        ):
            AuthService.request_registration_otp(self.ATTEMPT_EMAIL, "127.0.0.2")
            for _ in range(5):
                token, _ = AuthService.verify_registration_otp(
                    self.ATTEMPT_EMAIL,
                    "000000",
                )
                self.assertIsNone(token)
            token, _ = AuthService.verify_registration_otp(
                self.ATTEMPT_EMAIL,
                captured_codes[0],
            )
            self.assertIsNone(token)

            expired_email = "expired_registration@signvaani.com"
            AuthService.request_registration_otp(expired_email, "127.0.0.3")
            with get_db() as conn:
                conn.execute(
                    """
                    UPDATE registration_verifications SET expires_at = 0
                    WHERE email = ?;
                    """,
                    (expired_email,),
                )
            token, _ = AuthService.verify_registration_otp(
                expired_email,
                captured_codes[-1],
            )
            self.assertIsNone(token)

        with (
            patch.object(settings, "SECRET_KEY", "registration-test-secret-key-with-32-bytes"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "test-user"),
            patch("app.services.auth_service.send_otp_email", return_value=False),
        ):
            with self.assertRaises(RegistrationOtpUnavailableError):
                AuthService.request_registration_otp(
                    "delivery_failure@signvaani.com",
                    "127.0.0.4",
                )
            with get_db() as conn:
                failed = conn.execute(
                    """
                    SELECT status FROM registration_verifications
                    WHERE email = ?;
                    """,
                    ("delivery_failure@signvaani.com",),
                ).fetchone()
            self.assertEqual(failed["status"], "delivery_failed")

    def test_09c_registration_token_expiry_and_request_rate_limit(self):
        code = []
        with (
            patch.object(settings, "SECRET_KEY", "registration-test-secret-key-with-32-bytes"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "test-user"),
            patch(
                "app.services.auth_service.send_otp_email",
                side_effect=lambda _email, value, _purpose: code.append(value) or True,
            ),
        ):
            email = "token_expiry_registration@signvaani.com"
            AuthService.request_registration_otp(email, "127.0.0.5")
            token, _ = AuthService.verify_registration_otp(email, code[-1])
            self.assertIsNotNone(token)
            with get_db() as conn:
                conn.execute(
                    """
                    UPDATE registration_verifications SET token_expires_at = 0
                    WHERE email = ?;
                    """,
                    (email,),
                )
            self.assertIsNone(
                AuthService.register_verified(
                    "Expired Token User",
                    email,
                    "",
                    "RegistrationSecret@123",
                    token,
                )
            )

        with (
            patch.object(settings, "SECRET_KEY", "registration-test-secret-key-with-32-bytes"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "test-user"),
            patch("app.services.auth_service.send_otp_email", return_value=True),
            patch(
                "app.services.auth_service.REGISTRATION_OTP_EMAIL_LIMIT_PER_HOUR",
                1,
            ),
        ):
            limited_email = "rate_limited_registration@signvaani.com"
            AuthService.request_registration_otp(limited_email, "127.0.0.6")
            with self.assertRaises(RegistrationOtpRateLimitError):
                AuthService.request_registration_otp(limited_email, "127.0.0.6")

        with (
            patch.object(settings, "SECRET_KEY", "registration-test-secret-key-with-32-bytes"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "test-user"),
            patch("app.services.auth_service.send_otp_email", return_value=True),
            patch(
                "app.services.auth_service.REGISTRATION_OTP_IP_LIMIT_PER_HOUR",
                1,
            ),
        ):
            AuthService.request_registration_otp(
                "ip_limited_one@signvaani.com",
                "198.51.100.15",
            )
            with self.assertRaises(RegistrationOtpRateLimitError):
                AuthService.request_registration_otp(
                    "ip_limited_two@signvaani.com",
                    "198.51.100.15",
                )

        with (
            patch.object(settings, "SECRET_KEY", "signvaani-dev-secret-key-change-in-production"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "test-user"),
        ):
            with self.assertRaises(RegistrationOtpUnavailableError):
                AuthService.request_registration_otp(
                    "weak_key_registration@signvaani.com",
                    "127.0.0.7",
                )

    def test_09d_registration_email_uses_configured_smtp_transport(self):
        from unittest.mock import MagicMock

        smtp_context = MagicMock()
        smtp_server = smtp_context.__enter__.return_value
        with (
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_PORT", 587),
            patch.object(settings, "SMTP_USER", "smtp-user"),
            patch.object(settings, "SMTP_PASSWORD", "smtp-password"),
            patch.object(settings, "SMTP_FROM_EMAIL", "noreply@example.test"),
            patch("app.services.email_service.smtplib.SMTP", return_value=smtp_context) as smtp,
        ):
            self.assertTrue(
                send_otp_email(
                    "new@example.test",
                    "123456",
                    "registration",
                )
            )

        smtp.assert_called_once_with("smtp.example.test", 587, timeout=5)
        smtp_server.starttls.assert_called_once()
        smtp_server.login.assert_called_once_with("smtp-user", "smtp-password")
        message = smtp_server.send_message.call_args.args[0]
        self.assertEqual(message["To"], "new@example.test")
        self.assertEqual(message["Subject"], "SignVaani Registration Verification")

    def test_registration_email_supports_implicit_tls_smtp(self):
        from unittest.mock import MagicMock

        smtp_context = MagicMock()
        with (
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_PORT", 465),
            patch.object(settings, "SMTP_USER", "smtp-user"),
            patch("app.services.email_service.smtplib.SMTP_SSL", return_value=smtp_context) as smtp_ssl,
            patch("app.services.email_service.smtplib.SMTP") as smtp_plain,
        ):
            self.assertTrue(send_otp_email("new@example.test", "123456", "registration"))

        smtp_ssl.assert_called_once()
        smtp_plain.assert_not_called()

    def test_10_translation_service_provenance(self):
        # 1. Verified Dictionary Match
        dict_resp = translate_text(TranslateRequest(text="i need water.", source_language="English"))
        self.assertEqual(dict_resp.source, "dictionary")
        self.assertIn("पानी", dict_resp.translations["Hindi"])
        self.assertIn("पाणी", dict_resp.translations["Marathi"])

        # 2. Arbitrary text fallback preserves original text without fabricating translations
        custom_resp = translate_text(TranslateRequest(text="A custom test sentence for validation", source_language="English"))
        self.assertIn(custom_resp.source, ["api", "fallback"])
        self.assertEqual(custom_resp.translations["English"], "A custom test sentence for validation")

    def test_11_recognition_status_endpoint(self):
        status = get_model_status()
        self.assertIn("I", status.supported_classes)
        self.assertIn("WATER", status.supported_classes)
        # Verify honesty: If no model weights on disk, model_loaded must be False and explanation provided
        if not status.model_loaded:
            self.assertIsNotNone(status.missing_artifact_explanation)
            self.assertIn("backend/models/", status.missing_artifact_explanation)

    def test_12_cross_user_isolation(self):
        # Register second user
        AuthService.register("Second User", self.SECOND_USER, "+91 88888 77777", "SecondSecret@123")

        # Create phrase for second user
        p2 = PhraseService.create_phrase(
            user_email=self.SECOND_USER,
            original_text="Second user private phrase",
            translations={"English": "Second user private phrase", "Hindi": "", "Marathi": ""}
        )

        # User 1 lists phrases; must not see second user's phrase
        u1_phrases = PhraseService.list_phrases(self.TEST_EMAIL)
        self.assertFalse(any(p["id"] == p2["id"] for p in u1_phrases))

        # User 1 tries to delete second user's phrase; must return False
        delete_attempt = PhraseService.delete_phrase(p2["id"], self.TEST_EMAIL)
        self.assertFalse(delete_attempt)

    def test_13_token_isolation_between_registration_and_password_reset(self):
        # 1. Obtain a valid password reset token
        with patch("app.services.auth_service.send_otp_email", return_value=False):
            AuthService.create_otp(self.TEST_EMAIL)

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT otp_code FROM password_resets WHERE user_email = ? ORDER BY created_at DESC LIMIT 1;",
                (self.TEST_EMAIL,),
            )
            pwd_otp = cur.fetchone()["otp_code"]

        pwd_ok, pwd_reset_token, _ = AuthService.verify_otp(self.TEST_EMAIL, pwd_otp)
        self.assertTrue(pwd_ok)
        self.assertIsNotNone(pwd_reset_token)

        # 2. Attempt to register a user using the password-reset token -> must fail
        with patch.object(settings, "SECRET_KEY", "registration-test-secret-key-with-32-bytes"):
            user_res = AuthService.register_verified(
                name="Imposter User",
                email="imposter@signvaani.com",
                phone="+91 99999 88888",
                password="SecurePassword@123",
                registration_token=pwd_reset_token,
            )
            self.assertIsNone(user_res)

        # 3. Attempt to reset password using an arbitrary fake or registration token -> must fail
        fake_reset_ok, _ = AuthService.reset_password_with_token(
            "fake_registration_token_12345678901234567890",
            "AttackerPassword@123",
        )
        self.assertFalse(fake_reset_ok)

    def test_14_database_path_anchored_consistently(self):
        # Must resolve to an absolute path pointing to signvaani.db in backend
        db_path = settings.database_path
        self.assertTrue(os.path.isabs(db_path))
        self.assertTrue(db_path.endswith("signvaani.db"))

    def test_15_forgot_password_does_not_leak_plaintext_otp(self):
        with patch("app.services.auth_service.send_otp_email", return_value=True):
            ok, delivery_status, message, dev_code = AuthService.create_otp(self.TEST_EMAIL)
        self.assertTrue(ok)
        self.assertEqual(delivery_status, "delivered")
        self.assertIsNone(dev_code, "Plaintext OTP must never be returned in create_otp result")

    def test_16_genuine_model_inference(self):
        from app.routers.recognition import predict_gesture, LandmarkInferenceRequest
        from fastapi import HTTPException
        import numpy as np

        status = get_model_status()
        self.assertTrue(status.model_loaded)
        self.assertIsNotNone(status.model_artifact_path)
        self.assertTrue(os.path.exists(status.model_artifact_path))
        self.assertIn("WATER", status.supported_classes)
        self.assertIn("FOOD", status.supported_classes)

        # 1. Valid 63-D features
        dummy_feat = [0.0] * 63
        dummy_feat[3] = 0.5  # slight displacement
        res = predict_gesture(LandmarkInferenceRequest(features=dummy_feat))
        self.assertTrue(res.is_genuine_inference)
        self.assertIn(
            res.word,
            [*status.supported_classes, "Gesture unclear"],
        )
        self.assertGreaterEqual(res.confidence, 0.0)
        self.assertLessEqual(res.confidence, 100.0)

        # 2. Reject malformed vectors
        with self.assertRaises(HTTPException) as ctx:
            predict_gesture(LandmarkInferenceRequest(features=[0.0] * 42))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_17_conflicting_classifier_and_geometry_results_are_rejected(self):
        from unittest.mock import Mock
        from app.routers.recognition import (
            LandmarkInferenceRequest,
            predict_gesture,
        )
        import numpy as np

        model = Mock()
        model.classes_ = np.array(["HELLO", "WATER"])
        model.predict_proba.return_value = np.array([[0.8, 0.2]])
        with patch(
            "app.routers.recognition.get_loaded_model",
            return_value=(model, "test-model.joblib"),
        ), patch(
            "app.routers.recognition.analyze_hand_geometry",
            return_value={"WATER": 0.95},
        ):
            result = predict_gesture(
                LandmarkInferenceRequest(features=[0.0] * 63)
            )

        self.assertFalse(result.accepted)
        self.assertEqual(result.word, "Gesture unclear")
        self.assertEqual(result.confidence, 0.0)
        self.assertEqual(result.diagnostics["raw_model_prediction"], "HELLO")
        self.assertEqual(result.diagnostics["geometric_candidate"], "WATER")
        self.assertEqual(result.diagnostics["final_prediction"], "Gesture unclear")
        self.assertIn("disagree", result.rejection_reason)

    def test_18_classifier_labels_outside_supported_vocabulary_are_rejected(self):
        from unittest.mock import Mock
        from app.routers.recognition import (
            LandmarkInferenceRequest,
            predict_gesture,
        )
        import numpy as np

        model = Mock()
        model.classes_ = np.array(["OUTSIDE_CLASS", "WATER"])
        model.predict_proba.return_value = np.array([[0.9, 0.1]])
        with patch(
            "app.routers.recognition.get_loaded_model",
            return_value=(model, "test-model.joblib"),
        ), patch(
            "app.routers.recognition.analyze_hand_geometry",
            return_value={},
        ):
            result = predict_gesture(
                LandmarkInferenceRequest(features=[0.0] * 63)
            )

        self.assertFalse(result.accepted)
        self.assertEqual(result.word, "Gesture unclear")
        self.assertIn("not in the supported", result.rejection_reason)

    def test_19_model_status_inspection_and_validation(self):
        from app.routers.recognition import get_model_status

        status = get_model_status()
        self.assertTrue(status.model_loaded)
        self.assertIsNotNone(status.model_type)
        self.assertEqual(status.expected_features, 63)
        self.assertTrue(status.is_valid_estimator)
        self.assertTrue(len(status.supported_classes) > 0)

    def test_20_missing_model_returns_clear_status(self):
        from app.routers.recognition import get_model_status
        with patch("app.routers.recognition.get_loaded_model", return_value=(None, None)):
            status = get_model_status()
        self.assertFalse(status.model_loaded)
        self.assertIsNone(status.model_artifact_path)
        self.assertIsNotNone(status.missing_artifact_explanation)
        self.assertIn("No trained ISL classification model", status.missing_artifact_explanation)

    def test_21_history_and_phrase_unregistered_email_handling(self):
        # Verify creating history and phrases with unregistered or empty email does not crash with foreign key integrity error
        h1 = HistoryService.create_history_item(
            user_email="unregistered_guest@example.com",
            text="Hello",
            translation="नमस्ते",
            language="Hindi",
            confidence=95.0,
        )
        self.assertIsNotNone(h1.get("id"))
        self.assertEqual(h1["text"], "Hello")

        h2 = HistoryService.create_history_item(
            user_email="",
            text="Water",
            translation="पानी",
            language="Hindi",
            confidence=90.0,
        )
        self.assertIsNotNone(h2.get("id"))
        self.assertEqual(h2["text"], "Water")

        # Verify listing does not fail
        hist_list = HistoryService.list_history("")
        self.assertTrue(len(hist_list) >= 2)

        # Cleanup created items
        HistoryService.delete_history_item(h1["id"], "")
        HistoryService.delete_history_item(h2["id"], "")

if __name__ == "__main__":
    unittest.main()

