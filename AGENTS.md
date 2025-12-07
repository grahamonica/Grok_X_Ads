# AGENTS.md

## Scope

These instructions apply to the entire repository. They are written for AI coding assistants working on this project.

## Project Overview

This project builds a small flow that:

1. Takes a **product link** (URL to a product or website).
2. Uses the **Grok LLM** to:
   - Scrape the website content.
   - Infer the **target demographics** for that product.
3. Optionally prompts Grok again to **generate an ad image** targeting those consumers, ideally using **real images from the product website** inside the generated image (this may or may not be feasible; treat it as an experiment).
4. Shows the inferred demographics and generated image to the user for **approval**.

The core value: quickly turning a product link into a demographic profile and a matching ad image.

## High-Level Flow

- **Input**: User pastes a `product_url`.
- **Step 1: Get Demographics**
  - Call `Get Demographics API` with the `product_url`.
  - Grok (or another LLM) scrapes the page and infers:
    - Gender
    - Age Range
    - Language
    - Location
- **Step 2: Autofill UI**
  - The UI auto-populates a form with the returned demographics.
  - The user can review and adjust these fields.
- **Step 3: Get Ad Image**
  - After user approval, call `Get Ad Image API` with:
    - The (possibly edited) demographics.
    - The original `product_url`.
  - Grok generates a **single ad image**, ideally leveraging real product/website images.
- **Step 4: Final Approval**
  - Show the generated image in the UI.
  - The user can approve or discard.

## APIs (Conceptual)

These definitions are conceptual; keep them consistent when creating actual routes/types.

### Get Demographics API

- **Purpose**: From a product URL, infer target demographics.
- **Suggested endpoint**: `POST /api/demographics`
- **Request body**:
  - `productUrl: string`
- **Response body**:
  - `gender: string | null` (e.g. `"male"`, `"female"`, `"unisex"`)
  - `ageRange: string | null` (e.g. `"18-24"`, `"25-34"`)
  - `language: string | null` (e.g. `"en"`, `"es"`)
  - `location: string | null` (e.g. `"US"`, `"Europe"`)

### Get Ad Image API

- **Purpose**: Generate an ad image tailored to the inferred demographics and product page.
- **Suggested endpoint**: `POST /api/ad-image`
- **Request body**:
  - `productUrl: string`
  - `gender?: string`
  - `ageRange?: string`
  - `language?: string`
  - `location?: string`
- **Response body**:
  - `imageUrl: string` (or `imageBase64: string`)  
  - Optional metadata fields (e.g. `promptUsed: string`).

## Grok / LLM Usage Notes

- The system is expected to:
  - Scrape the target page content and visible product imagery.
  - Infer demographics without requiring explicit labels on the site.
  - When generating images, **attempt** to reflect:
    - The site’s visual style.
    - Actual product imagery (if technically feasible).
- If the “use real images from the website in the generated image” feature is not fully supported, design the code so this can be:
  - Toggled off gracefully.
  - Extended later without breaking APIs.

## Expectations for AI Assistants

- Preserve the **two-step flow**:
  - `Get Demographics` → UI autofill → user approval → `Get Ad Image`.
- Avoid changing the conceptual API shapes above without a clear reason.
- Keep code and types aligned with:
  - `productUrl`
  - `gender`
  - `ageRange`
  - `language`
  - `location`
  - generated `imageUrl` (or equivalent).
- When adding code:
  - Prefer clear, descriptive names over abbreviations.
  - Keep features modular (demographics logic separate from image generation).
- Do not rely on external network access at runtime unless the project explicitly supports it (e.g. via Grok API keys and configuration).

