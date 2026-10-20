# SignVaani REST API Documentation

---

## Base URL
- Local Development: `http://127.0.0.1:8000/api`
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- Interactive ReDoc: `http://127.0.0.1:8000/redoc`

---

## 1. Health

### `GET /api/health`
Checks the service and database connectivity.

#### Response `200 OK`
```json
{
  "status": "ok",
  "service": "SignVaani Backend",
  "version": "1.0.0",
  "database": "connected"
}
```

---

## 2. Authentication

### `POST /api/auth/register`
Registers a new user account with hashed password storage.

#### Request Body
```json
{
  "name": "Anushka Sharma",
  "email": "anushka@example.com",
  "phone": "+91 98765 43210",
  "password": "SecurePassword@123"
}
```

#### Response `201 Created`
```json
{
  "id": "usr_1791500000000",
  "name": "Anushka Sharma",
  "email": "anushka@example.com",
  "phone": "+91 98765 43210",
  "gender": "",
  "preferredLanguage": "English",
  "speechBehaviour": "confirm",
  "speechRate": 1.0,
  "showConfidence": true,
  "voiceGender": "female",
  "preferredVoices": { "English": "", "Hindi": "", "Marathi": "" },
  "voiceSelections": {
    "English": { "female": "", "male": "" },
    "Hindi": { "female": "", "male": "" },
    "Marathi": { "female": "", "male": "" }
  },
  "theme": "system"
}
```

### `POST /api/auth/login`
Authenticates user credentials against the hashed password.

#### Request Body
```json
{
  "email": "demo@signvaani.com",
  "password": "SignVaani@123"
}
```

#### Response `200 OK`
Returns user profile object (matches structure above).

#### Error `401 Unauthorized`
```json
{
  "detail": "Invalid email or password. Please try again."
}
```

---

## 3. Users & Preferences

### `GET /api/users/profile?email={email}`
Returns user profile by email.

### `PUT /api/users/profile`
Updates user name, phone, or gender.

#### Request Body
```json
{
  "email": "demo@signvaani.com",
  "name": "Arjun Verma",
  "phone": "+91 98765 43210",
  "gender": "Male"
}
```

### `PUT /api/users/preferences`
Updates speech settings, voice selection, output language, and theme.

#### Request Body
```json
{
  "email": "demo@signvaani.com",
  "preferredLanguage": "Hindi",
  "speechRate": 1.1,
  "speechBehaviour": "auto",
  "showConfidence": true,
  "voiceGender": "female"
}
```

### `PUT /api/users/password`
Changes account password.

#### Request Body
```json
{
  "email": "demo@signvaani.com",
  "currentPassword": "OldPassword@123",
  "newPassword": "NewPassword@123"
}
```

---

## 4. Saved Phrases

### `GET /api/phrases?user_email={email}`
Returns the list of saved phrases for the specified user (or public defaults).

#### Response `200 OK`
```json
[
  {
    "id": "p1_demo",
    "userEmail": "demo@signvaani.com",
    "originalText": "I need water.",
    "originalLanguage": "English",
    "translations": {
      "English": "I need water.",
      "Hindi": "मुझे पानी चाहिए।",
      "Marathi": "मला पाणी हवे आहे."
    },
    "selectedLanguage": "English",
    "createdAt": "2026-10-10T10:00:00"
  }
]
```

### `POST /api/phrases`
Creates a new saved phrase.

#### Request Body
```json
{
  "userEmail": "demo@signvaani.com",
  "originalText": "Please help me",
  "originalLanguage": "English",
  "translations": {
    "English": "Please help me",
    "Hindi": "कृपया मेरी मदद करें",
    "Marathi": "कृपया मला मदत करा"
  },
  "selectedLanguage": "English"
}
```

### `PUT /api/phrases/{id}?user_email={email}`
Updates an existing phrase.

### `DELETE /api/phrases/{id}?user_email={email}`
Deletes a phrase.

---

## 5. Recognition History

### `GET /api/history?user_email={email}`
Retrieves communication history log items for a user.

### `POST /api/history`
Records a new communication event in history.

#### Request Body
```json
{
  "userEmail": "demo@signvaani.com",
  "text": "WATER",
  "translation": "पानी",
  "language": "Hindi",
  "confidence": 94.0,
  "source": "recognition"
}
```

### `DELETE /api/history/{id}?user_email={email}`
Deletes an individual history item.

### `DELETE /api/history?user_email={email}`
Clears the user's entire history log.
