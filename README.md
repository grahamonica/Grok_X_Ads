# Grok_X_Ads

A FastAPI service that uses Grok API to generate ad demographics and ad images for products.

## Setup

### Using uv (Recommended)

1. Create and activate a virtual environment:
```bash
uv venv
source .venv/bin/activate  # On macOS/Linux
# or
.venv\Scripts\activate  # On Windows
```

2. Install dependencies:
```bash
uv pip install -r requirements.txt
```

3. Set the Grok API key as an environment variable:
```bash
export GROK_API_KEY=your_api_key_here
```

## Running the Application

```bash
uv run uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## API Endpoints

### 1. Generate Demographics
`POST /generate-demographics`

**Request:**
```json
{
  "product_url": "https://example.com/product",
  "prompt": "Analyze this product"
}
```

**Response:**
```json
{
  "gender": "Any",
  "age_range": "18-34",
  "language": ["English"],
  "location": "United States"
}
```

### 2. Generate Ad Image
`POST /generate-ad-image`

**Request:**
```json
{
  "product_url": "https://example.com/product",
  "gender": "Any",
  "age_range": "18-34",
  "language": "English",
  "location": "United States"
}
```

**Response:**
```json
{
  "image_url": "https://...",
  "prompt_used": "Create a single marketing image...",
  "metadata": {...}
}
```

## Testing

### Using curl

**Test Demographics API:**
```bash
curl -X POST "http://localhost:8000/generate-demographics" \
  -H "Content-Type: application/json" \
  -d '{
    "product_url": "https://example.com/product",
    "prompt": "Analyze this product"
  }'
```

**Test Ad Image API:**
```bash
curl -X POST "http://localhost:8000/generate-ad-image" \
  -H "Content-Type: application/json" \
  -d '{
    "product_url": "https://example.com/product",
    "gender": "Any",
    "age_range": "18-34",
    "language": "English",
    "location": "United States"
  }'
```

### Using FastAPI Docs

Once the server is running, visit:
- Interactive API docs: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`
