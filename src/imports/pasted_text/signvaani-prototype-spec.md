Design a complete, polished and interactive mobile application prototype for:

# SignVaani

## Product Description

SignVaani is an AI-based assistive communication application that recognizes a supported vocabulary of Indian Sign Language gestures using a mobile camera and converts them into editable text, multilingual translations and speech.

The core user journey is:

**Perform Sign → Detect Hand → Recognize Sign → Display Confidence → Verify Prediction → Build Sentence → Translate → Confirm → Speak**

This must be designed as a formal, presentation-ready college AI/ML project. The interface should feel accessible, calm and modern—not childish, excessively playful or like a generic AI dashboard.

Create a complete mobile application prototype in Figma. Do not create only a landing page or a few sample screens. Include all screens, states, overlays, modals, bottom sheets and interactions specified below.

---

# 1. Visual Direction: Sea Glass Theme

Use a fresh, sophisticated **Sea Glass** visual identity inspired by frosted sea glass, shallow coastal water, soft aqua tones, smooth stones and clean ocean air.

The theme should feel:

* Calm and soothing
* Fresh but not overly bright
* Modern and accessible
* Soft but not feminine or childish
* Professional enough for a college project
* Friendly without using a cartoon mascot
* Visually attractive without looking artificially AI-generated
* Clean, structured and easy to understand

Do not use:

* Neon colours
* Bright royal blue
* Excessive gradients
* Dark glassmorphism
* Glowing cyberpunk effects
* Overlapping transparent cards
* Cartoon animals or mascots
* Gamification, streaks, badges or leaderboards
* Excessive decorative waves
* Low-contrast text
* Tiny buttons
* Dense corporate dashboard layouts
* A separate Learn Signs or Practice module

Use solid, readable surfaces for the main content. Frosted or translucent effects may be used only as subtle decorative accents, not behind important text.

---

# 2. Sea Glass Colour System

Use the following consistent colour palette throughout the entire application:

* App background: `#F6FAF8`
* Main white surface: `#FFFFFF`
* Pale seafoam surface: `#E8F4F0`
* Soft aqua surface: `#DCEFEB`
* Mist blue surface: `#E4F0F3`
* Sea-glass green: `#8FC9BE`
* Primary deep teal: `#287A74`
* Primary button dark teal: `#236B67`
* Deep ocean heading: `#173E46`
* Main body text: `#263D42`
* Secondary text: `#667C80`
* Muted text: `#829397`
* Border colour: `#D5E4E1`
* Soft divider: `#E7EFED`
* Success: `#3A8F76`
* Success background: `#E4F3EC`
* Warning amber: `#C58A38`
* Warning background: `#FFF3DD`
* Error: `#C85B62`
* Error background: `#FCEAEC`
* Emergency red: `#B94750`
* Emergency surface: `#FBECEE`
* Focus outline: `#246E85`

Use deep teal for primary actions and seafoam for supporting surfaces. Use coral/red only for errors, deletion and emergency actions.

Maintain strong accessibility contrast. Never place pale text over a pale background.

---

# 3. Typography

Use one consistent font family:

**Manrope** or **Plus Jakarta Sans**

Recommended hierarchy:

* App title: 30–34px, bold
* Screen title: 24–28px, bold
* Section heading: 18–20px, semibold
* Card title: 16–18px, semibold
* Body text: 15–16px, regular
* Supporting text: 13–14px
* Button label: 15–16px, semibold
* Input text: minimum 16px
* Small status label: minimum 12px

Use sentence case for labels. Avoid full uppercase except for recognized sign words such as “WATER”.

---

# 4. Mobile Layout

Design primarily for a modern Android mobile frame:

* Frame size: approximately `390 × 844 px`
* Use an 8-point spacing system
* Minimum horizontal page padding: 20px
* Minimum button height: 48px
* Important buttons: 52–56px height
* Minimum touch target: 44 × 44px
* Card radius: 18–22px
* Input radius: 14–16px
* Button radius: 14–16px
* Pill and status radius: fully rounded
* Use safe areas for status bar and bottom navigation
* Avoid content being hidden behind the bottom navigation

Create scrollable frames wherever the content exceeds the screen height.

---

# 5. Brand Identity

Create a clean SignVaani wordmark with a minimal symbol combining:

* A simplified hand gesture
* A speech bubble
* A small sound wave

The logo should be flat, professional and easy to recognize at small sizes.

Do not create a mascot.

Use simple hand and communication illustrations only where needed. Illustrations should have clean outlines, soft sea-glass colours and transparent backgrounds.

---

# 6. Reusable Component System

Build reusable Figma components and variants for:

* Primary button
* Secondary button
* Outlined button
* Text button
* Destructive button
* Emergency button
* Icon button
* Floating emergency button
* Input field
* Password input
* Search field
* Dropdown selector
* Language selector
* Voice selector
* Toggle switch
* Slider
* Checkbox
* Radio button
* Word chip
* Status pill
* Confidence indicator
* Progress ring
* Phrase card
* History card
* Notification card
* Settings row
* Profile information row
* Empty state
* Loading state
* Error state
* Toast notification
* Confirmation dialog
* Bottom sheet
* Modal
* Mobile bottom navigation

Each interactive component must include relevant states:

* Default
* Pressed
* Focused
* Selected
* Disabled
* Loading
* Success
* Error

Do not leave buttons as plain text labels. Every action must be visually rendered as a proper button, icon button, menu item, switch or interactive card.

---

# 7. Navigation Structure

Use a consistent mobile bottom navigation bar for authenticated screens:

1. Home
2. Recognize
3. Phrases
4. History
5. More

Inside the More screen include:

* Profile
* Settings
* Help and Support
* Privacy and Data
* Sign Out

Keep Emergency Communication accessible through a clearly visible floating emergency button or a dashboard shortcut. Prevent accidental activation by opening an emergency-mode confirmation screen first.

Do not show bottom navigation on:

* Splash screen
* Welcome screens
* Login
* Registration
* Forgot Password
* OTP verification
* Profile onboarding
* Camera permission setup
* Full Emergency Mode

---

# 8. Splash Screen

Create a clean splash screen containing:

* SignVaani logo
* Product name
* Subtitle: “Indian Sign Language to Text and Speech”
* Soft sea-glass background
* Minimal hand-to-speech illustration
* Subtle loading indicator

Prototype interaction:

* Automatically navigate from Splash to Welcome.

---

# 9. Welcome Screen

Create a formal and welcoming introduction screen.

Include:

* SignVaani logo
* Clean hand-gesture illustration
* Heading: “Make every sign understood.”
* Supporting text explaining that SignVaani converts supported ISL gestures into text, translation and speech
* Primary button: “Create Account”
* Secondary outlined button: “Log In”
* Small link: “Continue as Guest”, only if guest mode is represented
* Accessibility icon in the top-right corner

Prototype interactions:

* Create Account → Registration
* Log In → Login
* Accessibility icon → Quick Accessibility bottom sheet
* Continue as Guest → Limited Dashboard with a clear guest label

---

# 10. Registration Screen

Create a proper registration form with:

* Full name
* Email address
* Mobile number
* Password
* Confirm password
* Show/hide password controls
* Password requirement checklist
* Terms and Privacy Policy checkbox
* Primary button: “Create Account”
* Outlined button: “Continue with Google”
* Link: “Already have an account? Log In”

Password requirements:

* At least 8 characters
* One uppercase letter
* One lowercase letter
* One number
* One special character

Create additional prototype states:

* Empty form
* Active input
* Invalid email
* Weak password
* Password mismatch
* Terms not accepted
* Loading
* Registration successful

Prototype interactions:

* Create Account with incomplete information → validation errors
* Successful Create Account → OTP Verification
* Continue with Google → simulated Google account selection bottom sheet
* Log In → Login screen
* Terms → Terms modal
* Privacy Policy → Privacy modal

---

# 11. Login Screen

Include:

* Email address
* Password
* Show/hide password
* Remember Me checkbox
* Forgot Password link
* Primary button: “Log In”
* Outlined button: “Continue with Google”
* Link: “New to SignVaani? Create Account”
* Back button

Create states for:

* Empty fields
* Invalid email
* Incorrect password
* Loading
* Login successful

Prototype interactions:

* Log In → Dashboard
* Forgot Password → Forgot Password screen
* Create Account → Registration
* Continue with Google → Google account selection
* Back → Welcome

---

# 12. Forgot Password and OTP Flow

Create separate screens for:

### Forgot Password

* Registered email input
* “Send OTP” button
* Return to Login link

### OTP Verification

* Six separate OTP boxes
* Countdown timer
* Resend OTP
* Verify OTP button
* Change email link

### Reset Password

* New password
* Confirm password
* Password requirement checklist
* Reset Password button

### Reset Successful

* Success icon
* Message: “Your password has been updated.”
* “Return to Login” button

Connect every screen in the correct order.

---

# 13. First-Time Profile Setup

Create a multi-step onboarding flow with a progress indicator.

## Step 1: Personal Details

Include:

* Upload profile picture
* Full name
* Date of birth
* Automatically calculated age
* Gender: Female, Male, Non-binary, Prefer not to say
* Pronouns, optional
* Mobile number
* City/State, optional
* Continue button
* Skip optional fields

Gender, pronouns and location must be clearly marked as optional.

## Step 2: Communication Preferences

Include:

* Interface language
* Default output language
* English
* Hindi
* Marathi
* Preferred voice
* Voice Preview button
* Speech speed
* Confirm before speaking toggle
* Show confidence score toggle
* Back and Continue buttons

## Step 3: Accessibility Preferences

Include:

* Text size
* High contrast mode
* Reduced motion
* Larger touch targets
* Captions
* Visual feedback
* Haptic feedback
* Screen-reader optimization
* Back and Continue buttons

## Step 4: Emergency Information

Clearly label this step as optional.

Include:

* Emergency contact name
* Relationship
* Emergency contact number
* Important medical note
* Privacy explanation
* Skip button
* Back and Continue buttons

## Step 5: Camera Setup

Include:

* Camera permission card
* Camera preview placeholder
* Hand-position outline
* Lighting indicator
* “Allow Camera Access” button
* “Test Camera” button
* Camera ready success state
* Permission denied state
* Open Settings button
* Back and Complete Setup buttons

Prototype interactions:

* Continue → next onboarding step
* Back → previous step
* Complete Setup → Dashboard
* Allow Camera Access → camera permission state
* Test Camera → camera ready state
* Open Settings → simulated device-settings information modal

---

# 14. Dashboard

Create a calm, useful mobile dashboard.

## Header

Include:

* Greeting: “Good morning, Aditi”
* Small profile picture
* Notification icon with unread indicator
* Current output language pill: “Hindi”
* Sea-glass background accents

## Primary Action Card

Include:

* Heading: “Start a new conversation”
* Short supporting text
* Minimal camera-and-hand illustration
* Primary button: “Start Signing”
* Secondary button: “Use Quick Phrase”

## Quick Actions

Create four clearly interactive cards:

* Live Recognition
* My Phrases
* Emergency
* History

Each card must include:

* Distinct line icon
* Short label
* Supporting description
* Visible pressed state

## Recent Communication

Display 2–3 recent records:

* “I need water.”
* “Please call my family.”
* “Thank you.”

Each record should show:

* Sentence
* Language
* Time
* Play button
* Save button
* More menu

## Usage Summary

Use small, simple information cards:

* Signs recognized today
* Sentences created
* Average confidence
* Saved phrases

Do not make this section competitive or gamified.

## Privacy Status

Add a compact card:

* Camera frames: Not saved
* Recognition history: Enabled
* Manage Privacy button

Prototype interactions:

* Start Signing → Live Recognition
* Quick Phrase → Phrase Library
* Live Recognition card → Live Recognition
* Emergency → Emergency entry confirmation
* History → History
* Notification icon → Notifications
* Profile picture → Profile
* Play recent sentence → Speaking state
* Save → Saved toast
* More → Bottom sheet
* Manage Privacy → Privacy Settings

---

# 15. Notifications Screen

Include notifications for:

* Sign recognition completed
* Phrase saved
* Camera permission required
* Settings updated
* Recognition model unavailable
* Emergency contact information incomplete

Each notification should show:

* Icon
* Title
* Supporting message
* Time
* Read/unread state
* Delete action

Include:

* Mark All as Read
* Clear Notifications
* Empty state

All buttons must be connected to their state or confirmation dialog.

---

# 16. Live Recognition Screen

This is the most important screen. It must look complete and functional.

## Header

Include:

* Back button
* Screen title: “Live Recognition”
* Camera status indicator
* Current language selector
* Recognition Settings icon

## Camera Area

Create a large camera preview with:

* Dark deep-ocean camera surface, not pure black
* Rounded 22px frame
* Hand-position guide
* Hand landmark overlay
* Instruction: “Keep your hand inside the guide”
* Camera status
* Lighting status
* Fullscreen button
* Switch camera button

## Camera Controls

Include clearly visible controls:

* Start Camera
* Stop Camera
* Start Recognition
* Pause Recognition
* Retry
* Switch Camera

Display only contextually relevant buttons in each state.

## Recognition Result Panel

Include:

* Recognized word: “WATER”
* Confidence: “94%”
* Circular confidence indicator
* Status: “Clear match”
* Primary button: “Add to Sentence”
* Secondary button: “Try Again”
* Text button: “Choose Another Word”

## Recognition States

Create separate connected frames or component variants for:

1. Camera permission required
2. Camera loading
3. Camera ready
4. Model loading
5. No hand detected
6. Multiple hands detected
7. Poor lighting
8. Hand outside guide
9. Recognizing
10. High-confidence result
11. Medium-confidence result
12. Low-confidence result
13. Camera unavailable
14. Model error
15. Offline mode
16. Recognition paused

### High Confidence

* Teal success styling
* Label: “Clear match”
* Confirm or Add to Sentence

### Medium Confidence

* Amber styling
* Label: “Please confirm”
* Buttons: Confirm, Retry, Choose Correct Word

### Low Confidence

* Calm warning styling
* Message: “The sign could not be recognized clearly.”
* Buttons: Retry, Select Word Manually, Check Camera Position

Prototype interactions:

* Start Camera → camera-ready state
* Start Recognition → recognizing state
* Recognizing → high-confidence result
* Pause → paused state
* Retry → recognizing state
* Add to Sentence → sentence builder with word added
* Choose Another Word → prediction-selection bottom sheet
* Manual Selection → searchable word-selection modal
* Settings icon → Recognition Settings
* Language selector → language bottom sheet
* Camera errors → appropriate recovery actions

---

# 17. Select Correct Word Bottom Sheet

Create a bottom sheet containing:

* Heading: “Select the correct word”
* Search field
* Suggested alternatives with confidence values
* WATER — 94%
* WANT — 68%
* WASH — 42%
* “Enter Word Manually” button
* Cancel button

Selecting a word must update the recognition result and return to the sentence builder.

---

# 18. Sentence Builder

Include the sentence builder within or immediately after Live Recognition.

Show recognized words as editable chips:

`I` `NEED` `WATER`

Each chip should support:

* Select
* Edit
* Delete
* Reorder

Include controls:

* Undo Last Word
* Add Word Manually
* Clear Sentence
* Save Draft

Show:

* Recognized sequence: “I NEED WATER”
* Natural sentence preview: “I need water.”
* Edit Sentence button

Important: The sentence should appear only once in each relevant field. Avoid repeating identical text unnecessarily.

Primary action:

* “Continue to Translation”

Prototype interactions:

* Word chip → Edit/Delete bottom sheet
* Drag handle or Move buttons → reorder state
* Undo → previous chip state
* Add Word → manual word modal
* Clear → confirmation dialog
* Save Draft → success toast
* Edit Sentence → editable text field
* Continue → Translation and Speech screen

---

# 19. Translation and Speech Screen

Include:

## Final Message

* Editable final sentence
* Edit button
* Original recognized sequence in smaller text

## Language Selection

* English
* Hindi
* Marathi

Show only the selected translation prominently.

Example:

* English: “I need water.”
* Hindi: “मुझे पानी चाहिए।”
* Marathi: “मला पाणी हवे आहे.”

## Voice Controls

Include:

* Voice selector
* Voice Preview
* Speech rate slider
* Volume slider
* Play
* Pause
* Stop
* Replay

## Confirmation

Display:

“Is this message correct?”

Buttons:

* Primary: “Confirm and Speak”
* Secondary: “Edit Message”
* Outlined: “Try Signs Again”
* Text button: “Save as Phrase”

Do not repeat the same sentence three times on the screen. Show one final sentence and allow language switching.

Prototype interactions:

* Language selection → translation changes
* Confirm and Speak → speaking state
* Pause → paused state
* Stop → stopped state
* Replay → speaking state
* Edit Message → editable text
* Try Signs Again → Live Recognition
* Save as Phrase → Save Phrase modal

---

# 20. Speaking State

Create a clear speech-output state:

* Speaker icon
* Final message
* Small label: “Speaking…”
* Subtle waveform
* Pause
* Stop
* Replay after completion
* Save as Phrase
* Done button

Do not implement moving word-by-word highlighting unless required. Keep the speech state simple and clear.

Done → Dashboard or Live Recognition completion state.

---

# 21. Phrase Library

Create a complete “My Phrases” screen.

## Header

* Title: “My Phrases”
* Search icon
* Add Phrase button

## Search and Filters

* Search field
* Category chips:

  * All
  * Favourites
  * Daily Needs
  * Medical
  * Family
  * Food
  * Travel
  * Custom

## Phrase Cards

Example phrases:

* “I need water.”
* “Please call my family.”
* “I need medical help.”
* “I want to go home.”
* “Thank you.”

Each phrase card must contain:

* Phrase text
* Language label
* Category
* Favourite icon
* Speak button
* More menu

More menu:

* Edit
* Duplicate
* Change Language
* Delete

Include:

* Recently Used section
* Favourite Phrases section
* All Phrases section
* Empty state
* No search results state

Prototype interactions:

* Add Phrase → Add Phrase modal
* Speak → Speaking state
* Favourite → selected favourite state
* Edit → Edit Phrase modal
* Duplicate → duplicate created toast
* Delete → confirmation dialog
* Search → filtered result state
* Category chips → relevant filtered state

---

# 22. Add/Edit Phrase Modal

Include:

* Phrase text
* Category
* Preferred language
* Preferred voice
* Translation preview
* Add to Favourites toggle
* Cancel
* Save Phrase

Create validation for an empty phrase.

Save Phrase → Phrase Library with success toast.

---

# 23. Emergency Communication Mode

Create a formal, calm and high-contrast emergency screen.

Do not use playful illustrations, animation or mascot elements.

## Entry Confirmation

Before opening emergency mode, show:

* Heading: “Open Emergency Communication?”
* Explanation that emergency phrases will be shown with large controls
* Cancel
* Continue

## Emergency Screen

Include:

* Clear title: “Emergency Communication”
* Language selector
* Exit button
* Large emergency phrase buttons:

  * I need medical help.
  * Please call an ambulance.
  * Please call the police.
  * I am in danger.
  * Please contact my family.
  * I cannot speak.
  * I am lost.
  * I am in pain.
  * Please stay with me.

Each phrase must have:

* Large readable text
* Relevant icon
* Speak button
* Replay state

Also include:

* Custom Emergency Message
* Emergency Contact card
* Medical Information card
* Location permission placeholder

Do not automatically call a contact or share location.

Prototype interactions:

* Phrase button → emergency speaking state
* Custom Message → text-entry modal
* Emergency Contact → confirmation before simulated call
* Location → permission information modal
* Exit → Exit Emergency Mode confirmation
* Confirm Exit → Dashboard

---

# 24. Recognition History

Create a searchable History screen.

## Filters

* Today
* This Week
* Date Range
* Language
* Saved Only

Each history card should show:

* Recognized sign sequence
* Final corrected sentence
* Translation
* Date and time
* Average confidence
* Play button
* Save as Phrase
* Copy
* More menu

More menu:

* View Details
* Delete

Include:

* Select Multiple
* Delete Selected
* Clear All History
* Empty state
* Filtered empty state

Prototype interactions:

* History card → History Details
* Play → Speaking state
* Save → Saved toast
* Copy → Copied toast
* Delete → confirmation
* Clear All → strong confirmation dialog
* Filters → filter bottom sheet

---

# 25. History Details

Include:

* Date and time
* Recognized sign sequence
* Individual word confidence
* Final edited sentence
* Selected translation
* Average confidence
* Play Again
* Save as Phrase
* Copy Text
* Delete Record

Back → History.

---

# 26. Profile Screen

Create a detailed but clean user profile.

## Header

* Profile picture
* Full name: Aditi
* Email
* Account status
* Edit Profile button

## Personal Information

* Full name
* Date of birth
* Age
* Gender
* Pronouns
* Mobile number
* City/State

## Communication Preferences Summary

* Interface language
* Default output language
* Preferred voice
* Speech speed
* Confirmation preference

## Accessibility Summary

* Text size
* High contrast
* Reduced motion
* Visual feedback
* Captions

## Emergency Information

* Contact name
* Relationship
* Contact number
* Medical note

## Account Actions

* Change Password
* Privacy and Data
* Connected Devices
* Sign Out
* Delete Account

All sensitive fields must be editable and optional where appropriate.

Prototype interactions:

* Edit Profile → Edit Profile screen
* Profile picture → upload options bottom sheet
* Change Password → Change Password screen
* Privacy and Data → Privacy Settings
* Connected Devices → Devices screen
* Sign Out → confirmation
* Delete Account → strong destructive confirmation

---

# 27. Settings Screen

Organize Settings into clearly separated sections.

## General

* App language
* Theme: Light, Dark, System
* Default start page

## Recognition Preferences

* Confidence threshold slider
* Show confidence score
* Automatically add high-confidence words
* Confirm every prediction
* Confirm before speaking
* Recognition delay
* Preferred camera
* Show hand-position guide
* Show hand landmarks
* Lighting warnings

## Translation

* Default output language
* Show original and translated text
* Remember last selected language

## Voice and Speech

* Preferred voice
* Preview Voice
* Speech rate
* Pitch
* Volume

## Accessibility

* Text size
* High contrast
* Reduced motion
* Larger touch targets
* Captions
* Visual feedback
* Haptic feedback
* Strong focus indicators
* Screen-reader optimization

## Notifications

* Recognition feedback
* Camera warnings
* Emergency information reminders
* Product updates

## Privacy and Data

* Save recognition history
* Save camera frames — OFF by default
* Download My Data
* Clear Recognition History
* Privacy Policy
* Delete Account

Include a fixed or contextual “Save Changes” button.

Prototype interactions:

* Toggles visibly change state
* Sliders move to selected values
* Dropdowns open bottom sheets
* Voice Preview triggers speaking preview
* Save Changes → Settings Saved toast
* Clear History → confirmation
* Delete Account → destructive confirmation
* Theme selection → light/dark preview frame

---

# 28. Help and Support

Do not create a Learn Signs module.

Create a practical Help screen containing:

* How to position your hand
* Camera permission help
* Improving recognition accuracy
* Supported vocabulary
* Using the sentence builder
* Changing language and voice
* Using emergency mode
* Privacy explanation
* Frequently Asked Questions
* Report Incorrect Recognition
* Contact Support

Use expandable accordion sections.

Prototype interactions:

* Accordion → expand/collapse
* Supported Vocabulary → informational list
* Report Recognition → feedback form
* Contact Support → contact form
* Submit → success confirmation

---

# 29. More Screen

Create a clean More screen with:

* User summary
* Profile
* Settings
* Help and Support
* Privacy and Data
* About SignVaani
* Sign Out

Every row must include:

* Icon
* Label
* Supporting text if necessary
* Chevron
* Pressed state

Connect every row to its destination.

---

# 30. Required Modals, Bottom Sheets and Dialogs

Create and connect:

* Quick Accessibility Settings
* Google Account Selection
* Terms and Conditions
* Privacy Policy
* Camera Permission
* Select Correct Word
* Add Word Manually
* Edit Word
* Clear Sentence Confirmation
* Save Phrase
* Edit Phrase
* Language Selection
* Voice Selection
* Recognition Settings
* History Filters
* Delete Phrase Confirmation
* Delete History Confirmation
* Clear All History Confirmation
* Emergency Mode Entry
* Exit Emergency Mode
* Sign Out Confirmation
* Delete Account Confirmation
* Model Error
* Camera Error
* Translation Unavailable
* Offline Mode

---

# 31. Accessibility Requirements

The prototype must demonstrate accessibility through:

* Minimum 16px input text
* Large touch targets
* Clear text contrast
* Visible selected states
* Icons combined with text
* Errors explained in text
* No information communicated only through colour
* Strong focus outlines
* Captions and visual feedback for audio
* Reduced-motion option
* Screen-reader-ready labels
* Clear confirmation before destructive actions
* Easy-to-read emergency controls

For example, do not show only an amber colour for medium confidence. Show:

* Warning icon
* “Please confirm”
* Confidence percentage

---

# 32. Prototype Interaction Requirements

This must be a clickable and testable Figma prototype.

No visible button should be left without an interaction.

Every button must perform one of the following:

* Navigate to a screen
* Navigate back
* Open a modal
* Open a bottom sheet
* Change a component variant
* Toggle a setting
* Display a loading state
* Display success/error feedback
* Show a confirmation dialog
* Close an overlay

Connect the complete primary prototype journey:

**Splash → Welcome → Registration → OTP → Profile Setup → Camera Setup → Dashboard → Live Recognition → Recognizing → WATER at 94% Confidence → Add to Sentence → Sentence Builder → Translation → Confirm and Speak → Save Phrase → Dashboard**

Also connect:

* Login and Forgot Password flow
* Dashboard to all main sections
* Phrase creation and deletion
* History details and deletion
* Emergency entry and exit
* Profile editing
* Settings changes
* Help form submission
* Sign Out

Use Smart Animate only for small, purposeful transitions. Keep reduced-motion compatibility.

---

# 33. Prototype Data

Use realistic mock data:

### User

* Name: Aditi
* Preferred output language: Hindi
* Preferred voice: Female Hindi Voice
* Camera frames saved: No
* Recognition history: Enabled

### Recognition

* Predicted word: WATER
* Confidence: 94%
* Status: Clear match
* Recognized signs: I, NEED, WATER
* Final sentence: I need water.
* Hindi: मुझे पानी चाहिए।
* Marathi: मला पाणी हवे आहे.

### Other History Examples

* Please call my family.
* Thank you.
* I want to go home.
* I need medical help.

### Supported Vocabulary Examples

* Hello
* Yes
* No
* Please
* Thank You
* Help
* Need
* Want
* Water
* Food
* Medicine
* Home
* Family
* Call
* Doctor
* Hospital
* Police
* Emergency
* Pain
* Stop

The supported vocabulary list should appear only inside Help or system information. Do not create a separate learning feature.

---

# 34. Product Accuracy

Use accurate wording throughout the prototype:

* “Recognizes a supported vocabulary of Indian Sign Language gestures.”
* “AI-assisted sign recognition.”
* “Basic editable sentence builder.”
* “Confidence-based verification.”
* “More gestures can be added in future versions.”

Do not claim:

* 100% accuracy
* Recognition of every sign
* Complete continuous sign-language interpretation
* Perfect translation
* Replacement of professional interpreters

---

# 35. Final Quality Instructions

Generate a cohesive design system, not unrelated screens.

Every screen must use the same:

* Sea Glass colour tokens
* Typography
* Spacing system
* Button design
* Card radius
* Input design
* Icon family
* Bottom navigation
* Illustration style
* Status design

Keep the design clean and formal. Use clear outlines, balanced whitespace and meaningful icons.

Do not include:

* Mascots
* Learn Signs page
* Practice mode
* Streaks
* Challenges
* Points
* Rewards
* Badges
* Leaderboards
* Social squads
* Decorative quotes
* “Coming Soon” placeholders
* Dead or non-functional buttons

Create all required mobile frames, reusable components, prototype links, overlays and interaction states. Ensure that the most important actions—Start Signing, Confirm Prediction, Add to Sentence, Translate, Confirm and Speak, Save Phrase and Emergency Communication—are immediately visible and functional in the prototype.
