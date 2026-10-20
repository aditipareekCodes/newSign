import sys
import os
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.config import settings
from app.database import get_db
from app.main import app


class TestRegistrationOtpApi(unittest.TestCase):
    EMAIL = "registration_api_test@signvaani.com"
    SECRET = "registration-api-test-secret-key-over-32-characters"

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        cls._cleanup()

    @classmethod
    def _cleanup(cls):
        with get_db() as conn:
            conn.execute(
                "DELETE FROM registration_verifications WHERE email = ?;",
                (cls.EMAIL,),
            )
            conn.execute("DELETE FROM users WHERE email = ?;", (cls.EMAIL,))

    def setUp(self):
        self._cleanup()

    def test_registration_requires_delivered_code_and_one_use_token(self):
        codes = []
        with (
            patch.object(settings, "SECRET_KEY", self.SECRET),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "smtp-user"),
            patch(
                "app.services.auth_service.send_otp_email",
                side_effect=lambda _email, code, _purpose: codes.append(code) or True,
            ) as send_email,
        ):
            requested = self.client.post(
                "/api/auth/register/request-otp",
                json={"email": f" {self.EMAIL.upper()} "},
            )
            self.assertEqual(requested.status_code, 202)
            self.assertNotIn("dev_code", requested.json())
            send_email.assert_called_once()

            resent = self.client.post(
                "/api/auth/register/request-otp",
                json={"email": self.EMAIL},
            )
            self.assertEqual(resent.status_code, 202)
            self.assertEqual(send_email.call_count, 2)

            unverified = self.client.post(
                "/api/auth/register",
                json={
                    "name": "Registration API User",
                    "email": self.EMAIL,
                    "phone": "",
                    "password": "RegistrationPassword@123",
                },
            )
            self.assertEqual(unverified.status_code, 422)

            invalid_code = self.client.post(
                "/api/auth/register/verify-otp",
                json={
                    "email": self.EMAIL,
                    "code": "000000" if codes[-1] != "000000" else "000001",
                },
            )
            self.assertEqual(invalid_code.status_code, 400)
            superseded_code = self.client.post(
                "/api/auth/register/verify-otp",
                json={"email": self.EMAIL, "code": codes[0]},
            )
            self.assertEqual(superseded_code.status_code, 400)

            verified = self.client.post(
                "/api/auth/register/verify-otp",
                json={"email": self.EMAIL, "code": codes[-1]},
            )
            self.assertEqual(verified.status_code, 200)
            registration_token = verified.json()["registration_token"]
            self.assertGreaterEqual(len(registration_token), 32)

            wrong_email = self.client.post(
                "/api/auth/register",
                json={
                    "name": "Registration API User",
                    "email": "different_registration@signvaani.com",
                    "phone": "",
                    "password": "RegistrationPassword@123",
                    "registration_token": registration_token,
                },
            )
            self.assertEqual(wrong_email.status_code, 403)

            registered = self.client.post(
                "/api/auth/register",
                json={
                    "name": "Registration API User",
                    "email": self.EMAIL,
                    "phone": "+91 98765 43210",
                    "password": "RegistrationPassword@123",
                    "registration_token": registration_token,
                },
            )
            self.assertEqual(registered.status_code, 201)
            self.assertEqual(registered.json()["user"]["email"], self.EMAIL)

            replay = self.client.post(
                "/api/auth/register",
                json={
                    "name": "Registration API User",
                    "email": self.EMAIL,
                    "phone": "+91 98765 43210",
                    "password": "RegistrationPassword@123",
                    "registration_token": registration_token,
                },
            )
            self.assertEqual(replay.status_code, 403)

    def test_registration_request_fails_closed_without_smtp(self):
        with (
            patch.object(settings, "SECRET_KEY", self.SECRET),
            patch.object(settings, "SMTP_HOST", ""),
            patch.object(settings, "SMTP_USER", ""),
            patch("app.services.auth_service.send_otp_email") as send_email,
        ):
            response = self.client.post(
                "/api/auth/register/request-otp",
                json={"email": self.EMAIL},
            )
            self.assertEqual(response.status_code, 503)
            send_email.assert_not_called()

    def test_existing_account_request_is_generic_and_does_not_send_code(self):
        with (
            patch.object(settings, "SECRET_KEY", self.SECRET),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_USER", "smtp-user"),
            patch("app.services.auth_service.send_otp_email") as send_email,
        ):
            response = self.client.post(
                "/api/auth/register/request-otp",
                json={"email": "demo@signvaani.com"},
            )
            self.assertEqual(response.status_code, 202)
            self.assertEqual(
                response.json()["message"],
                "If this email can be registered, a verification code will be sent shortly.",
            )
            send_email.assert_not_called()


if __name__ == "__main__":
    unittest.main()
