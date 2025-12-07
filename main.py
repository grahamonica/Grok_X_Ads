import os
import json
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiless
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Grok Ad Demographics API")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Environment variable for Grok API key
GROK_API_KEY = os.getenv("GROK_API_KEY")
GROK_API_URL = "https://api.x.ai/v1/chat/completions"
# Grok image generation follows the OpenAI-compatible images/generations endpoint shape
GROK_IMAGE_API_URL = "https://api.x.ai/v1/images/generations"


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


class AdImageRequest(BaseModel):
    product_url: str
    gender: Optional[str] = None
    age_range: Optional[str] = None
    language: Optional[str] = None
    location: Optional[str] = None
    colors: Optional[List[str]] = None  # Brand colors in hex format (e.g., ["#FF5733", "#3498DB"])
    mood: Optional[str] = None  # Brand mood (e.g., "professional", "playful", "luxury")
    product_description: Optional[str] = None  # Product/service description for image generation


class AdImageResponse(BaseModel):
    image_url: str
    prompt_used: Optional[str] = None
    metadata: Optional[dict] = None


class BrandStyleRequest(BaseModel):
    product_url: str


class BrandStyleResponse(BaseModel):
    colors: List[str]  # List of colors in hex format (e.g., "#FF5733", "#3498DB") for image generation
    mood: str  # Mood/atmosphere for image generation (e.g., "professional", "playful", "luxury")
    font_style: str  # Font style recommendation for HTML (e.g., "Modern Sans-Serif", "Elegant Serif")
    slogan: Optional[str] = None  # Suggested slogan for the business
    product_description: str  # Detailed description of the product/service for image generation


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


def build_image_prompt(request: AdImageRequest) -> str:
    """Construct a concise image-generation prompt using product description, brand styles, and demographics."""
    # Start with product description - this is the core focus
    if request.product_description:
        # Truncate product description if too long to leave room for other instructions
        max_desc_length = 400
        product_desc = request.product_description[:max_desc_length] if len(request.product_description) > max_desc_length else request.product_description
        product_focus = f"Professional ad image: {product_desc}"
    else:
        product_focus = f"Professional ad image for product at {request.product_url}"
    
    # Build brand style instructions (concise)
    style_parts = []
    if request.colors:
        colors_list = ", ".join(request.colors[:3])  # Limit to 3 colors to save space
        style_parts.append(f"colors: {colors_list}")
    if request.mood:
        style_parts.append(f"mood: {request.mood}")
    
    style_text = f" Brand style: {', '.join(style_parts)}." if style_parts else ""
    
    # Concise requirements
    requirements = (
        " No text. No people. Product-focused. "
        "Bottom third: simple/uncluttered for text overlay. "
        "Upper two-thirds: product hero. Professional quality."
    )
    
    prompt = f"{product_focus}{style_text}{requirements}"
    
    # Ensure prompt doesn't exceed 1024 characters
    if len(prompt) > 1024:
        # Further truncate product description if needed
        available_space = 1024 - len(style_text) - len(requirements) - 50  # 50 char buffer
        if request.product_description:
            truncated_desc = request.product_description[:available_space]
            product_focus = f"Professional ad image: {truncated_desc}"
            prompt = f"{product_focus}{style_text}{requirements}"
    
    return prompt[:1024]  # Hard limit


async def call_grok_brand_style_api(product_url: str) -> BrandStyleResponse:
    """Call Grok API to analyze website and extract brand style elements."""
    if not GROK_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROK_API_KEY environment variable is not set"
        )
    
    system_message = """You are an expert in brand identity and visual design analysis. 
Given a business website URL, browse and analyze the website to extract key brand style elements 
that will be useful for creating advertisements. Return the information in JSON format with the 
following exact fields:

- colors: REQUIRED - An array of color strings in hex format (HTML color format). Extract the primary 
  brand colors from the website. All colors MUST be provided as hex codes in the format "#RRGGBB" 
  (e.g., "#FF5733", "#3498DB", "#000000", "#FFFFFF"). Do NOT use color names. 
  Include 3-5 primary colors that represent the brand's visual identity. These will be used for 
  image generation, so prioritize colors that appear prominently in the website's design, logo, 
  or visual elements. Convert any color names you observe to their corresponding hex codes.

- mood: REQUIRED - A single string describing the overall mood or atmosphere of the brand. 
  This should be a concise descriptor that captures the emotional tone of the website. Examples:
  * "professional", "playful", "luxury", "minimalist", "energetic", "calm", "sophisticated", 
    "friendly", "bold", "elegant", "modern", "rustic", "tech-forward", "artisanal"
  This will be used to guide image generation to match the brand's emotional tone.

- font_style: REQUIRED - A single string describing the recommended font style for HTML use. 
  This should be a descriptive font category or style that matches the website's typography. 
  Examples:
  * "Modern Sans-Serif" (for clean, contemporary sites)
  * "Elegant Serif" (for sophisticated, traditional brands)
  * "Bold Geometric" (for strong, impactful brands)
  * "Playful Rounded" (for friendly, approachable brands)
  * "Minimalist Sans" (for clean, simple designs)
  * "Classic Serif" (for traditional, established brands)
  * "Tech Monospace" (for technology-focused brands)
  Base this on the typography you observe on the website.

- slogan: OPTIONAL - A string containing a suggested slogan or tagline for the business. 
  If the website already has a clear slogan or tagline, extract it. If not, create a compelling 
  slogan that captures the essence of the brand based on the website content. If you cannot 
  determine or create a suitable slogan, set this field to null.

- product_description: REQUIRED - A detailed, descriptive string about the product or service 
  being offered. This should be a comprehensive description (2-4 sentences) that captures:
  * What the product/service is
  * Key features, benefits, or characteristics
  * Visual elements that would be important for creating an advertisement image
  * The type of product (physical product, digital service, software, etc.)
  This description will be used to generate high-quality advertisement images, so be specific 
  about visual aspects, product appearance, and context. Examples:
  * "A sleek, modern smartphone with a premium metal frame and vibrant OLED display, featuring 
    advanced camera technology and minimalist design aesthetic."
  * "An online fitness coaching platform offering personalized workout plans and nutrition guidance, 
    with a focus on home-based exercises and progress tracking."
  * "A luxury skincare line featuring organic ingredients, elegant packaging, and products designed 
    for anti-aging and hydration."

CRITICAL: 
- Browse the website thoroughly to understand its visual identity, color scheme, typography, messaging, 
  and most importantly, the product or service being offered.
- The colors array must contain 3-5 color strings that accurately represent the brand.
- The mood should be a single descriptive word or short phrase.
- The font_style should be a descriptive category that can guide HTML font selection.
- The product_description must be detailed and visually descriptive to enable high-quality image generation.
- Return ONLY valid JSON with these five fields, no additional text or markdown formatting."""

    user_message = f"""Business Website URL: {product_url}

Please browse this website and analyze its brand identity. Extract the colors, mood, font style, 
slogan, and a detailed product description that would be useful for creating advertisements. 
Pay special attention to understanding what product or service is being offered, and provide a 
comprehensive visual description of it. Return the analysis in JSON format."""

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
                timeout=60.0  # Longer timeout for website browsing
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
            
            style_data = json.loads(content)
            return BrandStyleResponse(**style_data)
            
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


async def call_grok_image_api(request: AdImageRequest) -> AdImageResponse:
    """Call Grok image generation API to produce an ad image."""
    if not GROK_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROK_API_KEY environment variable is not set"
        )

    prompt_text = build_image_prompt(request)

    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "grok-2-image",
        "prompt": prompt_text,
        "n": 1
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GROK_IMAGE_API_URL,
                headers=headers,
                json=payload,
                timeout=60.0
            )
            response.raise_for_status()
            result = response.json()

            data = result.get("data")
            if not data or not isinstance(data, list):
                raise ValueError("Missing image data in Grok response")

            image_entry = data[0]
            image_url = image_entry.get("url")
            if not image_url and image_entry.get("b64_json"):
                image_url = f"data:image/png;base64,{image_entry['b64_json']}"

            if not image_url:
                raise ValueError("No image URL returned by Grok")

            return AdImageResponse(
                image_url=image_url,
                prompt_used=prompt_text,
                metadata={"raw": image_entry}
            )

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Grok image API error: {e.response.text}"
        )
    except (KeyError, json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Grok image API response: {str(e)}"
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


@app.post("/generate-ad-image", response_model=AdImageResponse)
async def generate_ad_image(request: AdImageRequest):
    """Generate a single ad image tailored to the product and demographics."""
    return await call_grok_image_api(request)


@app.post("/analyze-brand-style", response_model=BrandStyleResponse)
async def analyze_brand_style(request: BrandStyleRequest):
    """Analyze a business website to extract colors, mood, font style, and slogan for ad creation."""
    return await call_grok_brand_style_api(request.product_url)


@app.get("/")
async def root():
    """Serve the single-page UI."""
    index_path = Path(__file__).parent / "static" / "index.html"
    if not index_path.exists():
        return HTMLResponse(
            content="UI not found. Ensure static/index.html exists.",
            status_code=404
        )
    return HTMLResponse(index_path.read_text(encoding="utf-8"))
