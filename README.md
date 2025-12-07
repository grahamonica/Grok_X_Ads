# Grok X Ads Local Server

This project sets up a local Flask server to serve the scraped X (Twitter) Ads interface HTML and proxy external scripts, allowing it to run locally without ad errors.

## Setup

1. Install dependencies:
   ```bash
   python3 -m pip install flask requests
   ```

## Running the Server

1. Start the server:
   ```bash
   python3 app.py
   ```

2. Open your browser and go to `http://localhost:8000`

The server proxies requests to external domains (ton.twimg.com, abs.twimg.com, etc.) so the page loads the necessary scripts and styles.

## Features

- Serves the index.html page locally
- Proxies external scripts and resources to avoid CORS issues
- Allows navigation within the ads interface on a surface level

Note: This is a basic setup for local development. Full functionality may require additional backend mocking for API calls.