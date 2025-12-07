import os
import json
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Grok Ad Demographics API")
app.mount("/static", StaticFiles(directory="static"), name="static")
# Serve data files (e.g., tweet feeds)
app.mount("/data", StaticFiles(directory="data"), name="data")

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
    text_placement: Optional[dict] = None  # Suggested text placement coordinates


class TextPlacementRequest(BaseModel):
    image_url: str
    product_description: Optional[str] = None


class TextPlacementResponse(BaseModel):
    slogan: dict  # {"x": float, "y": float} as percentages
    company: dict  # {"x": float, "y": float} as percentages


class BrandStyleRequest(BaseModel):
    product_url: str


class BrandStyleResponse(BaseModel):
    colors: List[str]  # List of colors in hex format (e.g., "#FF5733", "#3498DB") for image generation
    mood: str  # Mood/atmosphere for image generation (e.g., "professional", "playful", "luxury")
    font_style: str  # Font style recommendation for HTML (e.g., "Modern Sans-Serif", "Elegant Serif")
    slogan: Optional[str] = None  # Suggested slogan for the business
    company_name: Optional[str] = None  # Extracted company/brand name
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
        "model": "grok-3",
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

    # Build demographic targeting instructions
    demo_parts = []
    if request.gender and request.gender != "Any":
        demo_parts.append(request.gender.lower())
    if request.age_range:
        demo_parts.append(f"aged {request.age_range}")
    if request.language:
        demo_parts.append(f"speaking {request.language}")
    if request.location:
        demo_parts.append(f"located in {request.location}")

    demo_text = f" Target audience: {', '.join(demo_parts)}." if demo_parts else ""

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
        "No text in image, background, or reflections. No logos. No people unless depicting target audience is applicable. Product-focused. "
        "Keep product depiction accurate and close to real product, minimize hallucination.  keep it consistent with this brand's identity, and target the target audience heavily "
        "Bottom third: simple/uncluttered for text overlay. "
        "Upper two-thirds: product. "
        "Suggest optimal text placement coordinates for slogan (top text) and company name (bottom text) as percentages from top-left corner."
    )

    prompt = f"{requirements}{style_text}{product_focus}{demo_text}"

    # Ensure prompt doesn't exceed 1024 characters
    if len(prompt) > 1024:
        # Further truncate product description if needed
        available_space = 1024 - len(demo_text) - len(style_text) - len(requirements) - 50  # 50 char buffer
        if request.product_description:
            truncated_desc = request.product_description[:available_space]
            product_focus = truncated_desc
            prompt = f"{product_focus}{demo_text}{style_text}{requirements}"

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

- company_name: OPTIONAL - A string containing the company or brand name. Extract the primary
  company/brand name from the website. This should be the main business name, not including
  legal suffixes like "Inc.", "LLC", etc. If you cannot determine a clear company name, set
  this field to null.

- product_description: REQUIRED - A concise summary of the product or service (50 words or less).
  This should capture the essence of what the product/service is, key features, and visual elements
  important for advertisement image generation. Do not include packaging. Keep it brief and focused. Examples:
  * "Sleek modern smartphone with premium metal frame, OLED display, and advanced camera."
  * "Online fitness platform with personalized workout plans and nutrition guidance."
  * "Luxury skincare line with organic ingredients and elegant anti-aging products."

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
        "model": "grok-4-fast",
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
        "model": "grok-imagine-v0p9",
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

            # Get text placement suggestions
            text_placement = await get_text_placement(image_url, request.product_description)

            return AdImageResponse(
                image_url=image_url,
                prompt_used=prompt_text,
                metadata={"raw": image_entry},
                text_placement=text_placement
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


async def get_text_placement(image_url: str, product_description: Optional[str] = None) -> dict:
    """Get suggested text placement coordinates for the ad image."""
    if not GROK_API_KEY:
        return {"slogan": {"x": 50, "y": 70}, "company": {"x": 50, "y": 85}}  # Default positions

    system_message = """You are an expert in advertisement design and typography placement.
Given an ad image URL and optional product description, analyze the image composition and suggest optimal text placement coordinates for:
- slogan: The main headline/tagline (should be prominent, usually upper portion)
- company: The brand/company name (should be secondary, usually lower portion)

Return coordinates as percentages from the top-left corner (0-100) where the text should be centered.
Consider visual hierarchy, negative space, and readability. Avoid placing text over busy areas or important product elements.

Return ONLY valid JSON with this exact structure:
{
  "slogan": {"x": 50.0, "y": 30.0},
  "company": {"x": 50.0, "y": 85.0}
}"""

    user_message = f"""Ad Image URL: {image_url}
Product Description: {product_description or 'N/A'}

Please analyze this ad image and suggest optimal text placement coordinates for slogan and company name as percentages from top-left corner."""

    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "grok-3",
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.3
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

            content = result["choices"][0]["message"]["content"]
            content = content.strip()
            if content.startswith("```"):
                lines = content.split("\n")
                content = "\n".join(lines[1:-1]) if len(lines) > 2 else content

            placement_data = json.loads(content)
            return placement_data

    except Exception as e:
        # Return default positions on error
        return {"slogan": {"x": 50, "y": 70}, "company": {"x": 50, "y": 85}}


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


@app.post("/overlay-text", response_model=dict)
async def overlay_text(
    image_url: str,
    slogan_text: str = "",
    company_text: str = "",
    slogan_x: float = 50,
    slogan_y: float = 70,
    company_x: float = 50,
    company_y: float = 85,
    slogan_color: str = "#FFFFFF",
    company_color: str = "#FFFFFF",
    slogan_size: int = 32,
    company_size: int = 24,
    slogan_width: Optional[int] = None,
    slogan_height: Optional[int] = None,
    company_width: Optional[int] = None,
    company_height: Optional[int] = None,
    font_style: str = "Modern Sans-Serif"
):
    """Overlay text on image with feathered backdrop."""
    try:
        # Fetch the image
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url, timeout=30.0, follow_redirects=True)
            response.raise_for_status()
            image_data = response.content

        # Process image with PIL
        from PIL import Image, ImageDraw, ImageFont, ImageFilter
        import io

        image = Image.open(io.BytesIO(image_data)).convert("RGBA")
        draw = ImageDraw.Draw(image, "RGBA")

        # Map font style to actual font
        font_map = {
            "Modern Sans-Serif": "arial.ttf",
            "Elegant Serif": "times.ttf",
            "Bold Geometric": "arialbd.ttf",
            "Playful Rounded": "arial.ttf",
            "Minimalist Sans": "arial.ttf",
            "Classic Serif": "times.ttf",
            "Tech Monospace": "cour.ttf"
        }
        font_name = font_map.get(font_style, "arial.ttf")

        try:
            slogan_font = ImageFont.truetype(font_name, slogan_size)
        except:
            slogan_font = ImageFont.load_default()

        try:
            company_font = ImageFont.truetype(font_name, company_size)
        except:
            company_font = ImageFont.load_default()

        def draw_text_with_backdrop(text, x_percent, y_percent, font, color, width=None, height=None, backdrop_color=(0, 0, 0, 128)):
            if not text:
                return

            img_width, img_height = image.size
            x = int((x_percent / 100) * img_width)
            y = int((y_percent / 100) * img_height)

            # Get text bbox
            bbox = draw.textbbox((x, y), text, font=font, anchor="mm")
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]

            # Use provided dimensions if available, otherwise calculate from text
            if width is not None and height is not None:
                backdrop_width = width
                backdrop_height = height
            else:
                backdrop_width = text_width + 40  # padding
                backdrop_height = text_height + 40  # padding

            # Create backdrop centered on the text position
            backdrop_x1 = x - backdrop_width // 2
            backdrop_y1 = y - backdrop_height // 2
            backdrop_x2 = x + backdrop_width // 2
            backdrop_y2 = y + backdrop_height // 2

            # Create backdrop image with feathered edges
            backdrop = Image.new("RGBA", image.size, (0, 0, 0, 0))
            backdrop_draw = ImageDraw.Draw(backdrop, "RGBA")

            # Draw rounded rectangle with feathered edges
            backdrop_draw.rounded_rectangle(
                [backdrop_x1, backdrop_y1, backdrop_x2, backdrop_y2],
                radius=15,
                fill=backdrop_color
            )

            # Apply gaussian blur for feathering
            backdrop = backdrop.filter(ImageFilter.GaussianBlur(radius=5))

            # Composite backdrop onto main image
            image.alpha_composite(backdrop)

            # Draw text
            draw.text((x, y), text, font=font, fill=color, anchor="mm")

        # Draw slogan
        draw_text_with_backdrop(slogan_text, slogan_x, slogan_y, slogan_font, slogan_color, slogan_width, slogan_height)

        # Draw company
        draw_text_with_backdrop(company_text, company_x, company_y, company_font, company_color, company_width, company_height)

        # Convert back to bytes
        output = io.BytesIO()
        image.save(output, format="PNG")
        output.seek(0)

        # Return as base64
        import base64
        encoded = base64.b64encode(output.getvalue()).decode()

        return {"image_base64": f"data:image/png;base64,{encoded}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to overlay text: {str(e)}")


@app.get("/")
async def root():
    """Serve the single-page UI (legacy)."""
    index_path = Path(__file__).parent / "static" / "index.html"
    if not index_path.exists():
        return HTMLResponse(
            content="UI not found. Ensure static/index.html exists.",
            status_code=404
        )
    return HTMLResponse(index_path.read_text(encoding="utf-8"))


@app.get("/editor")
async def editor():
    """Serve the ad editor UI."""
    editor_path = Path(__file__).parent / "static" / "editor.html"
    if not editor_path.exists():
        return HTMLResponse(
            content="Editor not found. Ensure static/editor.html exists.",
            status_code=404
        )
    return HTMLResponse(editor_path.read_text(encoding="utf-8"))


@app.get("/app")
@app.get("/app/{path:path}")
async def serve_react_app(path: str = ""):
    """Serve the React app (new workflow canvas UI)."""
    app_dir = Path(__file__).parent / "static" / "app"
    
    # Try to serve the requested file
    if path and path != "":
        file_path = app_dir / path
        if file_path.exists() and file_path.is_file():
            # Determine content type
            suffix = file_path.suffix.lower()
            content_types = {
                ".html": "text/html",
                ".js": "application/javascript",
                ".css": "text/css",
                ".svg": "image/svg+xml",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".ico": "image/x-icon",
                ".json": "application/json",
            }
            content_type = content_types.get(suffix, "application/octet-stream")
            return Response(
                content=file_path.read_bytes(),
                media_type=content_type
            )
    
    # Serve index.html for all other routes (SPA routing)
    index_path = app_dir / "index.html"
    if not index_path.exists():
        return HTMLResponse(
            content="""
            <html>
            <head><title>React App Not Built</title></head>
            <body style="background:#0a0a0f;color:#f5f5f7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="text-align:center;">
                    <h1>React App Not Built</h1>
                    <p>Run the following commands to build the React app:</p>
                    <pre style="background:#1a1a24;padding:20px;border-radius:10px;text-align:left;">
cd frontend
npm install
npm run build</pre>
                    <p style="margin-top:20px;">Or for development mode:</p>
                    <pre style="background:#1a1a24;padding:20px;border-radius:10px;text-align:left;">
cd frontend
npm run dev</pre>
                </div>
            </body>
            </html>
            """,
            status_code=200
        )
    return HTMLResponse(index_path.read_text(encoding="utf-8"))


@app.get("/proxy-image")
async def proxy_image(image_url: str):
    """Proxy image requests to bypass CORS issues."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                image_url,
                timeout=30.0,
                follow_redirects=True
            )
            response.raise_for_status()
            
            # Determine content type
            content_type = response.headers.get("content-type", "image/jpeg")
            
            return Response(
                content=response.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*"
                }
            )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Failed to fetch image: {e.response.text}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error proxying image: {str(e)}"
        )
