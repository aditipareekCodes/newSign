# SignVaani Development Status & Feature Audit

This document tracks the verified implementation status of each system component. Categories used:
- **IMPLEMENTED**: Real working implementation with code and tests.
- **PARTIAL**: Substantial working code with specific limitations or incomplete sub-features.
- **SIMULATED**: Demonstration or mock logic (timers, static dictionaries, hardcoded arrays) with no real AI/ML.
- **MISSING**: Feature not yet built or integrated.

---

## Component Status Table

| Component | Status | Implementation Details | Remaining / Next Steps |
| :--- | :--- | :--- | :--- |
| **FastAPI Backend Service** | **IMPLEMENTED** | FastAPI server running under `/backend`, modular routers, CORS support, and Pydantic v2 schemas. | None. |
| **SQLite Database Persistence** | **IMPLEMENTED** | SQLite with WAL mode, foreign keys, and non-destructive initialization for `users`, `saved_phrases`, `history_items`, and `password_resets`. | Schema migrations if multi-tenant partitioning needed. |
| **Backend Health Check** | **IMPLEMENTED** | `GET /api/health` reports status, version, and database connectivity. | Automated monitoring alert hooks. |
| **Secure Password Hashing** | **IMPLEMENTED** | PBKDF2-HMAC-SHA256 with 100,000 iterations and unique 16-byte random salt. | None. Plaintext passwords never stored. |
| **JWT Authentication & Authorization** | **IMPLEMENTED** | Cryptographic HMAC-SHA256 Bearer tokens, token expiration, OTP generation & verification, password reset, and per-user row-level authorization in FastAPI. | None. Cross-user modification prevented. |
| **Centralized Frontend API Client** | **IMPLEMENTED** | `src/services/apiClient.ts` handles `VITE_API_BASE_URL`, Bearer tokens, timeouts, error isolation, and online/offline detection. | None. |
| **LocalStorage Security Audit** | **IMPLEMENTED** | Legacy plaintext password dictionary removed (`signvaani.accounts`). Tokens and user profiles stored securely. | None. |
| **Saved Phrases CRUD** | **IMPLEMENTED** | Full CRUD on backend (`/api/phrases`) and frontend (`PhraseLibraryScreen`), protected by Bearer token auth, with search and translation switching. | Cloud backup export. |
| **Recognition History Log** | **IMPLEMENTED** | Full logging, retrieval, deletion, and clear operations on backend (`/api/history`) and frontend (`HistoryScreen`), protected by user auth. | Export history to CSV/PDF. |
| **User Preferences & Profile** | **IMPLEMENTED** | Name, phone, gender, language, speech rate, and voice selections persisted to both SQLite and localStorage. | Avatar image upload. |
| **Text-to-Speech (TTS)** | **IMPLEMENTED** | Browser-native Web Speech API (`speechSynthesis`) with gender classification, rate control, and Marathi Devanagari fallback. | Cloud TTS (e.g. Google Cloud Text-to-Speech) for devices lacking native voices. |
| **Live Camera Video Preview** | **IMPLEMENTED** | Real camera stream rendered in `<video>` element using `navigator.mediaDevices.getUserMedia()`. | None. |
| **Hand Landmark Detection** | **IMPLEMENTED** | Real-time 21 3D hand keypoints extracted via MediaPipe Tasks Vision (`hand_landmarker.task`), with live canvas skeleton visualization. | Multi-hand tracking expansion if 2-hand signs required. |
| **Preprocessing Pipeline** | **IMPLEMENTED** | Real frame extraction -> 21 3D landmarks -> wrist translation (0,0,0) -> bounding scale normalization -> 63-dim feature vector. | None. |
| **Stabilization & Duplicate Suppression** | **IMPLEMENTED** | 5-frame rolling majority voting window and duplicate sign debouncing to prevent repetitive appending while hand is held in camera frame. | Dynamic gesture temporal modeling (e.g. LSTM/GRU). |
| **Sentence Builder** | **IMPLEMENTED** | Interactive chip assembly, sentence editing, translation preview, manual vocabulary fallback, and speech triggering. | Grammatical restructuring for complex ISL sentence syntax. |
| **Multilingual Translation** | **IMPLEMENTED** | Full pipeline: backend `/api/translate` querying external translation provider (MyMemory/configured endpoint) with 3.5s timeout, verified dictionary fallback (~20 phrases, ~10 words), and live provenance badges (Live API / Verified Dictionary / Fallback). | Integration with specialized domain NMT engine (Bhashini). |
| **Trained ISL Classifier Weights** | **DOCUMENTED REQUIREMENT** | Recognition interface is fully operational; genuinely reports missing model artifact (`isl_classifier.onnx` / `.joblib`) without fabricating fake confidence or sequences. Manual vocabulary picker provided as honest fallback. | Place trained weight file at `backend/models/isl_classifier.onnx` to activate neural classification. |

---

## Verified Deliverables & Audit

1. **Computer Vision & Hand Landmark Extraction**:
   - Installed `@mediapipe/tasks-vision` and bundled local model asset in `public/models/hand_landmarker.task`.
   - Created `handLandmarkService.ts` extracting 21 3D hand keypoints and rendering canvas skeleton overlay on live camera video.
   - Scale-invariant and wrist-centered normalization yielding 63-dimensional coordinate vectors.
   - Eradicated simulated timer cycles and random confidence jitter from `recognitionService.ts`.
   - Stabilization window (5 frames) and duplicate sign suppression implemented.

2. **Multilingual Translation Pipeline**:
   - Built backend router `backend/app/routers/translation.py` with external translation API integration, timeout, and dictionary fallback.
   - Updated `translationService.ts` and `SentenceBuilderScreen.tsx` with explicit translation provenance indicators.
   - English, Hindi, and Marathi verified translations for standard emergency and daily ISL expressions.

3. **Authentication, Authorization & Security**:
   - PBKDF2-HMAC-SHA256 password hashing and JWT/Bearer token issuance.
   - Eradicated legacy plaintext password caching in browser `localStorage`.
   - Server-side token verification on `/api/phrases`, `/api/history`, `/api/users/profile`, preventing cross-user data tampering.
   - Real cryptographic OTP generation and verification on backend with password reset flow.

4. **Testing & Build Verification**:
   - Frontend tests: 11/11 passing in Vitest (`services.test.ts`).
   - Backend tests: 12/12 passing in Python unittest (`test_backend.py`).
   - Production build: `npm run build` succeeds cleanly in ~3s.
   - Live HTTP verification: `/api/health`, `/api/recognize/status`, and `/api/translate` confirmed working over uvicorn.
