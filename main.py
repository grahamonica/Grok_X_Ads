import os
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

app = FastAPI(title="Grok Ad Demographics API")

# Environment variable for Grok API key
GROK_API_KEY = os.getenv("GROK_API_KEY")
GROK_API_URL = "https://api.x.ai/v1/chat/completions"


# Request model
class AdRequest(BaseModel):
    product_url: str
    prompt: str


# Age range model
class AgeRange(BaseModel):
    min: Optional[int] = None  # Lower bound (null means "All" or no lower bound)
    max: Optional[int] = None  # Upper bound (null means "And Up" or no upper bound)


# Response model
class AdDemographics(BaseModel):
    gender: str
    age_range: AgeRange
    language: Optional[List[str]] = None
    location: Optional[List[str]] = None


async def call_grok_api(product_url: str, custom_prompt: str) -> AdDemographics:
    """Call Grok API to generate ad demographics."""
    if not GROK_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROK_API_KEY environment variable is not set"
        )
    
    system_message = """You are an expert in advertising demographics analysis. 
Given a product URL and additional context, analyze and return the TOP target demographic 
information in JSON format with the following exact fields:
- gender: REQUIRED - The target gender (string: "Any", "Woman", or "Man")
- age_range: REQUIRED - An object with "min" and "max" fields (both integers or null). Valid age ranges are:
  * "All" -> {"min": null, "max": null}
  * "13-24" -> {"min": 13, "max": 24}
  * "13-34" -> {"min": 13, "max": 34}
  * "13-49" -> {"min": 13, "max": 49}
  * "13-54" -> {"min": 13, "max": 54}
  * "13+" -> {"min": 13, "max": null}
  * "18-24" -> {"min": 18, "max": 24}
  * "18-34" -> {"min": 18, "max": 34}
  * "18-49" -> {"min": 18, "max": 49}
  * "18-54" -> {"min": 18, "max": 54}
  * "18+" -> {"min": 18, "max": null}
  * "21-34" -> {"min": 21, "max": 34}
  * "21-49" -> {"min": 21, "max": 49}
  * "21-54" -> {"min": 21, "max": 54}
  * "21+" -> {"min": 21, "max": null}
  * "25-49" -> {"min": 25, "max": 49}
  * "25-54" -> {"min": 25, "max": 54}
  * "25+" -> {"min": 25, "max": null}
  * "35-49" -> {"min": 35, "max": 49}
  * "35-54" -> {"min": 35, "max": 54}
  * "35+" -> {"min": 35, "max": null}
  * "50+" -> {"min": 50, "max": null}
- language: OPTIONAL - An array of target languages (array of strings or null). If you can determine specific target languages, use ONLY languages from this exact list:
  Albanian, Arabic, Basque, Bengali, Bulgarian, Catalan, Chinese (Simplified), Croatian, Czech, Danish, Dutch, English, Farsi, Finnish, French, Galician, German, Greek, Gujarati, Hebrew, Hindi, Hungarian, Indonesian, Irish, Italian, Japanese, Kannada, Korean, Latvian, Malay, Marathi, Norwegian, Norwegian Bokmål, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Spanish, Swedish, Tamil, Thai, Turkish, Ukrainian, Urdu
  Return an array with one or more languages from this list. Example: ["English"] or ["English", "Spanish", "French"]
  If you cannot determine or should not specify target languages, set this field to null.
- location: OPTIONAL (choose only if necessary) - An array of target locations (array of strings or null). Return one or more location names if applicable. Examples: ["United States"], ["United States", "Canada"], ["Europe"], ["Global"], ["Asia-Pacific", "Australia"]
  If you cannot determine or should not specify target locations, set this field to null.

CRITICAL: 
- The language field is OPTIONAL. If provided, it must be an array of strings (not a single string). Use the exact language names from the list above. If not applicable or cannot be determined, set to null.
- The location field is OPTIONAL. If provided, it must be an array of strings (not a single string). If not applicable or cannot be determined, set to null.
- The age_range field must be an object with "min" and "max" fields (both can be integers or null). Use only the valid age range combinations listed above.

Return ONLY valid JSON with these four fields, no additional text or markdown formatting."""

    user_message = f"""Product URL: {product_url}

Custom Prompt: {custom_prompt}

Please analyze this product and provide the ad demographics in JSON format."""

    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "grok-4-0709",
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.7
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GROK_API_URL,
                headers=headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            
            # Extract content from Grok response
            content = result["choices"][0]["message"]["content"]
            
            # Parse JSON from response (handle if wrapped in markdown code blocks)
            content = content.strip()
            if content.startswith("```"):
                # Remove markdown code block markers
                lines = content.split("\n")
                content = "\n".join(lines[1:-1]) if len(lines) > 2 else content
            
            demographics_data = json.loads(content)
            return AdDemographics(**demographics_data)
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Grok API error: {e.response.text}"
        )
    except (KeyError, json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Grok API response: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )


@app.post("/generate-demographics", response_model=AdDemographics)
async def generate_demographics(request: AdRequest):
    """Generate ad demographics for a product using Grok API."""
    return await call_grok_api(request.product_url, request.prompt)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Grok Ad Demographics API"}

