# Frontend UI for DC CEP Marketplace

## Overview
This frontend is a simple single-page application for the four backend microservices:
- User Service (http://localhost:8001)
- Product Service (http://localhost:8002)
- Order Service (http://localhost:8003)
- Payment Service (http://localhost:8004)

## Files
- `index.html` — main UI page
- `styles.css` — styling and layout
- `app.js` — frontend logic and API integration

## Run Instructions
1. Start the backend services using `Backend/run.py`.
2. Serve the frontend from the `Frontend` folder.
   - Example: `python -m http.server 3000`
3. Open `http://localhost:3000` in your browser.

## Notes
- The backend services must be running and accessible on ports `8001` through `8004`.
- CORS has been enabled in each FastAPI service so the frontend can call them from the browser.
