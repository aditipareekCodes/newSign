"""
Translation Router for SignVaani
Integrates verified multilingual dictionary and live translation API
with timeout handling, graceful fallback, and honest provenance tracking.
"""

import json
import urllib.parse
import urllib.request
from typing import Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.config import settings

router = APIRouter(prefix="/translate", tags=["Translation"])

# Verified multilingual dictionary
VERIFIED_DICTIONARY: Dict[str, Dict[str, str]] = {
    "i need water.": {
        "English": "I need water.",
        "Hindi": "मुझे पानी चाहिए।",
        "Marathi": "मला पाणी हवे आहे.",
    },
    "i need water": {
        "English": "I need water.",
        "Hindi": "मुझे पानी चाहिए।",
        "Marathi": "मला पाणी हवे आहे.",
    },
    "water.": {
        "English": "Water.",
        "Hindi": "पानी।",
        "Marathi": "पाणी.",
    },
    "water": {
        "English": "Water.",
        "Hindi": "पानी।",
        "Marathi": "पाणी.",
    },
    "please call my family.": {
        "English": "Please call my family.",
        "Hindi": "कृपया मेरे परिवार को बुलाओ।",
        "Marathi": "कृपया माझ्या कुटुंबाला बोलवा.",
    },
    "please call my family": {
        "English": "Please call my family.",
        "Hindi": "कृपया मेरे परिवार को बुलाओ।",
        "Marathi": "कृपया माझ्या कुटुंबाला बोलवा.",
    },
    "i want to go home.": {
        "English": "I want to go home.",
        "Hindi": "मैं घर जाना चाहता हूँ।",
        "Marathi": "मला घरी जायचे आहे.",
    },
    "i want to go home": {
        "English": "I want to go home.",
        "Hindi": "मैं घर जाना चाहता हूँ।",
        "Marathi": "मला घरी जायचे आहे.",
    },
    "thank you.": {
        "English": "Thank you.",
        "Hindi": "धन्यवाद।",
        "Marathi": "धन्यवाद.",
    },
    "thank you": {
        "English": "Thank you.",
        "Hindi": "धन्यवाद।",
        "Marathi": "धन्यवाद.",
    },
    "please help me.": {
        "English": "Please help me.",
        "Hindi": "कृपया मेरी मदद करें।",
        "Marathi": "कृपया मला मदत करा.",
    },
    "help me.": {
        "English": "Help me.",
        "Hindi": "मेरी मदद करो।",
        "Marathi": "मला मदत करा.",
    },
    "help.": {
        "English": "Help.",
        "Hindi": "मदद।",
        "Marathi": "मदत.",
    },
    "help": {
        "English": "Help.",
        "Hindi": "मदद।",
        "Marathi": "मदत.",
    },
    "i am hungry.": {
        "English": "I am hungry.",
        "Hindi": "मुझे भूख लगी है।",
        "Marathi": "मला भूक लागली आहे.",
    },
    "i am fine.": {
        "English": "I am fine.",
        "Hindi": "मैं ठीक हूँ।",
        "Marathi": "मी ठीक आहे.",
    },
    "good morning.": {
        "English": "Good morning.",
        "Hindi": "शुभ प्रभात।",
        "Marathi": "शुभ सकाळ.",
    },
    "good evening.": {
        "English": "Good evening.",
        "Hindi": "शुभ संध्या।",
        "Marathi": "शुभ संध्याकाळ.",
    },
    # Emergency phrases
    "i need medical help.": {
        "English": "I need medical help.",
        "Hindi": "मुझे चिकित्सकीय सहायता चाहिए।",
        "Marathi": "मला वैद्यकीय मदत हवी आहे.",
    },
    "please call an ambulance.": {
        "English": "Please call an ambulance.",
        "Hindi": "कृपया एम्बुलेंस बुलाएं।",
        "Marathi": "कृपया रुग्णवाहिका बोलवा.",
    },
    "please call the police.": {
        "English": "Please call the police.",
        "Hindi": "कृपया पुलिस को बुलाएं।",
        "Marathi": "कृपया पोलिसांना बोलवा.",
    },
    "i am in danger.": {
        "English": "I am in danger.",
        "Hindi": "मैं खतरे में हूँ।",
        "Marathi": "मी धोक्यात आहे.",
    },
    "please contact my family.": {
        "English": "Please contact my family.",
        "Hindi": "कृपया मेरे परिवार से संपर्क करें।",
        "Marathi": "कृपया माझ्या कुटुंबाशी संपर्क करा.",
    },
    "i cannot speak.": {
        "English": "I cannot speak.",
        "Hindi": "मैं बोल नहीं सकता।",
        "Marathi": "मला बोलता येत नाही.",
    },
}

class TranslateRequest(BaseModel):
    text: str = Field(..., description="Text to translate")
    source_language: str = Field("English", description="Source language: English, Hindi, or Marathi")

class TranslateResponse(BaseModel):
    translations: Dict[str, str]
    source: str  # "dictionary", "api", "fallback"
    message: Optional[str] = None

def _fetch_external_translation(text: str, src_code: str, target_code: str) -> Optional[str]:
    """
    Queries live translation provider with timeout.
    Supports configured custom API endpoint or public MyMemory endpoint.
    """
    if not text.strip():
        return ""

    # 1. Custom configured translation API
    if settings.TRANSLATION_API_URL:
        try:
            req_data = json.dumps({
                "q": text,
                "source": src_code,
                "target": target_code,
                "format": "text",
            }).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            if settings.TRANSLATION_API_KEY:
                headers["Authorization"] = f"Bearer {settings.TRANSLATION_API_KEY}"

            req = urllib.request.Request(
                f"{settings.TRANSLATION_API_URL.rstrip('/')}/translate",
                data=req_data,
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if "translatedText" in data:
                    return data["translatedText"]
        except Exception as e:
            print(f"Custom translation API error: {e}")

    # 2. Public MyMemory translation provider
    try:
        lang_pair = f"{src_code}|{target_code}"
        encoded_query = urllib.parse.quote(text)
        url = f"https://api.mymemory.translated.net/get?q={encoded_query}&langpair={lang_pair}"

        req = urllib.request.Request(url, headers={"User-Agent": "SignVaani-Assistive-App/1.0"})
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("responseStatus") == 200 and data.get("responseData"):
                trans = data["responseData"].get("translatedText")
                # Filter out error strings returned as text by MyMemory
                if trans and "MYMEMORY WARNING" not in trans.upper() and "QUERY LENGTH LIMIT" not in trans.upper():
                    return trans
    except Exception as e:
        print(f"External translation provider exception: {e}")

    return None

@router.post("", response_model=TranslateResponse)
def translate_text(payload: TranslateRequest):
    text = payload.text.strip()
    source_lang = payload.source_language.capitalize()
    lower_key = text.lower()

    # 1. Verified Dictionary Check
    if lower_key in VERIFIED_DICTIONARY:
        dict_match = VERIFIED_DICTIONARY[lower_key]
        return TranslateResponse(
            translations={
                "English": dict_match.get("English", text),
                "Hindi": dict_match.get("Hindi", text),
                "Marathi": dict_match.get("Marathi", text),
            },
            source="dictionary",
            message="Verified dictionary match.",
        )

    # 2. Live API Translation
    src_codes = {"English": "en", "Hindi": "hi", "Marathi": "mr"}
    src_code = src_codes.get(source_lang, "en")

    translations: Dict[str, str] = {source_lang: text}
    api_success_count = 0

    for target_lang, target_code in [("English", "en"), ("Hindi", "hi"), ("Marathi", "mr")]:
        if target_lang == source_lang:
            translations[target_lang] = text
        else:
            trans = _fetch_external_translation(text, src_code, target_code)
            if trans:
                translations[target_lang] = trans
                api_success_count += 1
            else:
                # If API translation failed, do NOT pretend original English is Hindi/Marathi
                translations[target_lang] = ""

    if api_success_count > 0:
        return TranslateResponse(
            translations=translations,
            source="api",
            message="Live translation completed via external provider.",
        )

    # 3. Graceful Fallback
    # Preserve original text for source language, leave unknown targets empty for manual entry
    return TranslateResponse(
        translations={
            "English": text if source_lang == "English" else "",
            "Hindi": text if source_lang == "Hindi" else "",
            "Marathi": text if source_lang == "Marathi" else "",
        },
        source="fallback",
        message="External translation provider unavailable or timed out. Original text preserved.",
    )
