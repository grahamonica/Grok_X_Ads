import os
import json
from typing import List
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


# Response model
class AdDemographics(BaseModel):
    gender: str
    age_range: str
    language: List[str]
    location: str


async def call_grok_api(product_url: str, custom_prompt: str) -> AdDemographics:
    """Call Grok API to generate ad demographics."""
    if not GROK_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROK_API_KEY environment variable is not set"
        )
    
    system_message = """You are an expert in advertising demographics analysis. 
Given a product URL and additional context, analyze and return the target demographic 
information in JSON format with the following exact fields:
- gender: The target gender (string: "Any", "Woman", or "Man")
- age_range: The target age range (string: e.g., "All", "18-34", "25-45", "All ages")
- language: An array of target languages (array of strings). You MUST only use languages from this exact list:
  Albanian, Arabic, Basque, Bengali, Bulgarian, Catalan, Chinese (Simplified), Croatian, Czech, Danish, Dutch, English, Farsi, Finnish, French, Galician, German, Greek, Gujarati, Hebrew, Hindi, Hungarian, Indonesian, Irish, Italian, Japanese, Kannada, Korean, Latvian, Malay, Marathi, Norwegian, Norwegian Bokmål, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Spanish, Swedish, Tamil, Thai, Turkish, Ukrainian, Urdu
  Return an array with one or more languages from this list. Example: ["English"] or ["English", "Spanish", "French"]
- location: The target location (string: e.g., "United States", "Global", "Europe", "Asia-Pacific")

CRITICAL: The language field must be an array of strings, not a single string. Use the exact language names from the list above.

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

