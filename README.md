# Grok_X_Ads

A simple FastAPI service that uses Grok API to generate ad demographics for products.

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
