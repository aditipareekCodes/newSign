# SignVaani Backend API

FastAPI + SQLite backend service providing persistence for users, preferences, saved phrases, and recognition history for the SignVaani assistive communication system.

---

## Architecture Overview

- **Framework**: FastAPI (Python 3.10+) with Uvicorn ASGI server
- **Database**: SQLite with thread-safe connection pooling, WAL journal mode, and foreign keys
- **Security**: PBKDF2-HMAC-SHA256 password hashing with unique 16-byte random salt (100,000 iterations)
- **Validation**: Pydantic v2 schemas for all request/response models
- **CORS**: Configured for local development (`http://localhost:5173`, `http://127.0.0.1:5173`, etc.)

---

## Directory Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── config.py           # Environment and app configuration
│   ├── database.py         # SQLite connection manager and non-destructive schema initialization
│   ├── main.py             # FastAPI entrypoint, CORS, lifespan startup
│   ├── models/             # Schema/model exports
│   │   └── __init__.py
│   ├── routers/            # API endpoints grouped by domain
│   │   ├── __init__.py
│   │   ├── health.py       # GET /api/health
│   │   ├── auth.py         # POST /api/auth/register, POST /api/auth/login
│   │   ├── users.py        # GET/PUT /api/users/profile, /preferences, /password
│   │   ├── phrases.py      # CRUD for saved phrases
│   │   └── history.py      # CRUD for recognition history
│   ├── schemas/            # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── common.py
│   │   ├── user.py
│   │   ├── phrase.py
│   │   └── history.py
│   └── services/           # Business logic and database operations
│       ├── __init__.py
│       ├── auth_service.py
│       ├── phrase_service.py
│       └── history_service.py
├── requirements.txt
└── README.md
```

---

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start Backend Server
From the project root:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
```

Or from the `backend/` directory:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend settings are loaded from `backend/.env` regardless of the directory used to start Uvicorn. Startup logs only report whether registration mail settings and the signing key are ready; secret values are never logged.

The Vite development server uses a same-origin `/api` proxy to `127.0.0.1:8000`. This keeps API requests working whether the browser opens the development UI through `localhost`, `127.0.0.1`, or the host machine's LAN address; FastAPI CORS settings remain restrictive and unchanged.

### 3. Verify Health
Open in browser or run:
```bash
curl http://127.0.0.1:8000/api/health
```
Expected response:
```json
{
  "status": "ok",
  "service": "SignVaani Backend",
  "version": "1.0.0",
  "database": "connected"
}
```

Interactive OpenAPI documentation is available at: `http://127.0.0.1:8000/docs`

---

## API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service and database health check |
| `POST` | `/api/auth/register/request-otp` | Request a registration-specific email code |
| `POST` | `/api/auth/register/verify-otp` | Verify the registration code and receive a short-lived registration token |
| `POST` | `/api/auth/register` | Create a user with a verified, single-use registration token |
| `POST` | `/api/auth/login` | Authenticate user credentials |
| `POST` | `/api/auth/forgot-password` | Request a password-reset code (existing-account flow) |
| `POST` | `/api/auth/verify-otp` | Verify a password-reset code and receive a reset token |
| `POST` | `/api/auth/reset-password` | Change a password with a verified reset token |
| `GET` | `/api/users/profile?email=...` | Retrieve user profile |
| `PUT` | `/api/users/profile` | Update user name, phone, gender |
| `PUT` | `/api/users/preferences` | Update language, speech rate, voices, theme |
| `PUT` | `/api/users/password` | Change user password |
| `GET` | `/api/phrases?user_email=...` | List saved phrases |
| `POST` | `/api/phrases` | Create new saved phrase |
| `PUT` | `/api/phrases/{id}?user_email=...` | Update saved phrase |
| `DELETE` | `/api/phrases/{id}?user_email=...` | Delete saved phrase |
| `GET` | `/api/history?user_email=...` | List communication history |
| `POST` | `/api/history` | Record new communication history entry |
| `DELETE` | `/api/history/{id}?user_email=...` | Delete single history entry |
| `DELETE` | `/api/history?user_email=...` | Clear entire history log |

### Registration email verification

Registration uses a separate OTP challenge from password recovery:

1. `POST /api/auth/register/request-otp` with `{"email":"person@example.com"}`. The response is generic to avoid disclosing whether the email already has an account. A code is sent only for a new email and only when SMTP delivery succeeds.
2. `POST /api/auth/register/verify-otp` with `{"email":"person@example.com","code":"123456"}`. A successful response contains `registration_token` and `expires_in` (600 seconds).
3. `POST /api/auth/register` with the normal name/email/phone/password fields plus that `registration_token`. The token is bound to the verified email and is consumed in the same SQLite transaction as user creation.

Registration codes expire after five minutes and allow at most five guesses. Requests are limited to five per email and twenty per source IP in a rolling hour. Registration codes and authorization tokens are stored as keyed/hash digests, not plaintext. Registration OTP delivery never returns a development code; an SMTP failure returns an error and cannot create an account. Registration email uses TLS (STARTTLS for other ports or implicit TLS on port 465). A non-default `SECRET_KEY` of at least 32 characters and the existing `SMTP_HOST` and `SMTP_USER` settings are required.

The existing password-reset endpoints and their separate `password_resets` storage remain unchanged in purpose and response contract. In local development without SMTP, password-reset OTPs retain their existing development-code response; registration OTPs do not.
