# Selenium Cookie Extractor

This project provides a tool to extract cookies from websites using Selenium WebDriver, which can access more cookies than the Chrome extension method.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure you have Chrome browser installed on your system.

## Usage

1. Start the server:
```bash
python server.py
```

2. The server provides the following endpoints:

   - `POST /extract`: Extract cookies from a URL
     ```json
     {
         "url": "https://example.com"
     }
     ```

   - `POST /predict`: Get prediction for a sequence
     ```json
     {
         "sequence": [1, 2, 3, ...]
     }
     ```

   - `POST /cleanup`: Clean up browser resources
     ```json
     {}
     ```

## Features

- Uses Selenium WebDriver to access all cookies, including those not accessible via Chrome extension
- Handles various browser scenarios and anti-bot measures
- Provides a REST API for easy integration
- Saves extracted cookies to a JSON file
- Includes cleanup functionality to manage browser resources

## Notes

- The script includes a 5-second wait time for page loading. Adjust this in `cookie_extractor.py` if needed.
- The browser window will be visible by default. You can modify the Chrome options to run in headless mode if desired.
- Make sure to call the cleanup endpoint when you're done to properly close the browser. 