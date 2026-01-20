# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amazon UPC Scraping System - an internal automation tool that processes Excel files containing UPCs and brands, scrapes Amazon US public pages for product data, validates brand/UPC matches, and exports results to CSV.

**Target:** 4,000-5,000 UPCs per day

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend Runtime | Node.js (LTS) |
| API Framework | Express |
| HTTP Client | Axios |
| HTML Parser | Cheerio |
| File Upload | Multer |
| Excel Parsing | xlsx |
| CSV Export | csv-writer |
| Frontend | React.js + Vite |
| Styling | Tailwind CSS |
| HTTP Client (FE) | Axios |

## Project Structure

```
scrapper-amazon/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration files (multer, selectors, env)
│   │   ├── controllers/    # Route handlers
│   │   ├── services/       # Business logic
│   │   │   ├── scraper/    # Amazon scraping modules
│   │   │   └── ...
│   │   ├── utils/          # Helper functions (delay, logger, errors)
│   │   ├── routes/         # API route definitions
│   │   └── app.js          # Express app entry
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   ├── hooks/          # Custom React hooks
│   │   └── App.jsx
│   └── package.json
├── storage/
│   ├── uploads/            # Uploaded Excel files
│   ├── results/            # Job results (JSON per job)
│   └── exports/            # Generated CSV files
├── TASKS.md                # Development task list
└── CLAUDE.md
```

## Architecture Flow

```
Excel Upload → API Layer → Job Manager → Scraper Worker → Result Storage → CSV Export
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs/upload` | POST | Upload Excel file |
| `/api/jobs` | GET | List all jobs |
| `/api/jobs/:id` | GET | Get job details |
| `/api/jobs/:id/download` | GET | Download CSV |
| `/api/jobs/:id/pause` | POST | Pause job |
| `/api/jobs/:id/resume` | POST | Resume job |

## Key Data Structures

**Job Metadata:**
```javascript
{
  jobId: 'JOB_xxx',
  status: 'QUEUED|RUNNING|PAUSED|COMPLETED|FAILED',
  totalUpcs: 5000,
  processed: 0,
  failed: 0,
  startedAt: null,
  completedAt: null
}
```

**UPC Row:**
```javascript
{ rowId: 1, upc: '720476124771', brand: 'Ergodyne', status: 'PENDING' }
```

**Scraped Result:**
```javascript
{
  rowId: 1,
  inputUpc: '720476124771',
  inputBrand: 'Ergodyne',
  results: [{
    asin: 'B08XXXX',
    brand: 'Ergodyne ABC',
    brandMatch: true,
    upcMatch: true,
    rating: 4.5,
    reviews: 12644,
    bsr: 193008
  }],
  status: 'DONE'
}
```

## Scraping Rules

- **Sequential processing only** - one UPC at a time
- **No proxies, no browser automation, no paid APIs**
- **Public pages only** - no cookies/login
- **Browser-like headers required**
- **Rate limiting:**
  - Search → Product: 5-7 seconds
  - Product → Product: 5-7 seconds
  - UPC → UPC: 6-10 seconds
- **Max 3 ASINs per UPC** (organic results only)
- **UPC fallback:** prepend "00" and retry once if no results

## Validation Logic

```javascript
// Brand match
scrapedBrand.toLowerCase().includes(inputBrand.toLowerCase())

// UPC match
scrapedUpc.includes(inputUpc)
```

## Error Handling

| Scenario | Action |
|----------|--------|
| HTTP 429/503 | Retry with backoff |
| CAPTCHA detected | Pause job 30-60 min |
| Single UPC failure | Mark FAILED, continue |
| Worker crash | Resume from last UPC |

## Environment Variables

```
PORT=5000
REQUEST_DELAY_MIN=6000
REQUEST_DELAY_MAX=10000
MAX_RETRIES=2
STORAGE_PATH=../storage
```

## Development Commands

```bash
# Backend
cd backend
npm install
npm run dev          # Development with nodemon
npm start            # Production

# Frontend
cd frontend
npm install
npm run dev          # Development server
npm run build        # Production build
```

## CSV Output Columns

Input UPC, Input Brand, ASIN, Amazon Brand, Brand Match, UPC Match, Rating, Reviews, BSR, Status

## Frontend Pages

1. **Dashboard** (`/`) - Job list with status and actions
2. **Upload** (`/upload`) - Excel file upload
3. **Job Progress** (`/jobs/:id`) - Real-time progress with auto-refresh

## Important Constraints

- No Amazon APIs (SP-API, Advertising API)
- No paid scraping services
- No proxy or IP rotation
- Only free and open-source libraries
- Jobs must be restart-safe (resume from last UPC)
