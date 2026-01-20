# Amazon UPC Scraping System - Task List

This document contains all tasks required to build the complete system from start to finish.

---

## Phase 1: Project Setup & Configuration

### Task 1.1: Initialize Project Structure
- [ ] Create project root folder structure
- [ ] Initialize Node.js project with `npm init`
- [ ] Create `/backend` directory
- [ ] Create `/frontend` directory
- [ ] Create `/storage` directory with subdirectories:
  - `/storage/uploads`
  - `/storage/results`
  - `/storage/exports`

### Task 1.2: Backend Dependencies Installation
```bash
cd backend
npm init -y
npm install express axios cheerio xlsx csv-writer multer uuid cors dotenv
npm install -D nodemon
```

### Task 1.3: Frontend Dependencies Installation
```bash
cd frontend
npm create vite@latest . -- --template react
npm install axios react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Task 1.4: Environment Configuration
- [ ] Create `/backend/.env` file with:
  ```
  PORT=5000
  REQUEST_DELAY_MIN=6000
  REQUEST_DELAY_MAX=10000
  MAX_RETRIES=2
  STORAGE_PATH=../storage
  ```
- [ ] Create `/backend/.env.example` (template without values)

### Task 1.5: Project Structure Creation
```
scrapper-amazon/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── routes/
│   │   └── app.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
├── storage/
│   ├── uploads/
│   ├── results/
│   └── exports/
└── CLAUDE.md
```

---

## Phase 2: Backend Core Infrastructure

### Task 2.1: Express Server Setup
- [ ] Create `backend/src/app.js` - Express app initialization
- [ ] Create `backend/src/server.js` - Server entry point
- [ ] Configure CORS middleware
- [ ] Configure JSON body parser
- [ ] Add basic error handling middleware
- [ ] Create `backend/src/config/index.js` - Configuration loader

### Task 2.2: File Upload Module (Multer)
- [ ] Create `backend/src/config/multer.js`
- [ ] Configure disk storage for uploads
- [ ] Set file filter (accept only .xlsx)
- [ ] Set file size limits
- [ ] Create upload directory if not exists

### Task 2.3: Excel Parsing Service
- [ ] Create `backend/src/services/excelParser.js`
- [ ] Implement `parseExcelFile(filePath)` function
- [ ] Validate required columns (UPC, Brand)
- [ ] Normalize rows to internal format:
  ```javascript
  { rowId, upc, brand, status: 'PENDING' }
  ```
- [ ] Handle parsing errors gracefully
- [ ] Return structured data array

---

## Phase 3: Job Management System

### Task 3.1: Job Manager Service
- [ ] Create `backend/src/services/jobManager.js`
- [ ] Implement job data structure:
  ```javascript
  {
    jobId: 'JOB_xxx',
    status: 'QUEUED',
    totalUpcs: 0,
    processed: 0,
    failed: 0,
    startedAt: null,
    completedAt: null,
    filePath: '',
    upcs: []
  }
  ```
- [ ] Implement `createJob(excelData, filePath)` function
- [ ] Implement `getJob(jobId)` function
- [ ] Implement `getAllJobs()` function
- [ ] Implement `updateJobStatus(jobId, status)` function
- [ ] Implement `updateJobProgress(jobId, processed, failed)` function
- [ ] Save job metadata to JSON file

### Task 3.2: Job State Management
- [ ] Implement state transitions:
  - QUEUED → RUNNING
  - RUNNING → COMPLETED
  - RUNNING → PAUSED
  - RUNNING → FAILED
  - PAUSED → RUNNING
- [ ] Add timestamp tracking for state changes
- [ ] Implement `pauseJob(jobId)` function
- [ ] Implement `resumeJob(jobId)` function

### Task 3.3: Job Persistence
- [ ] Create `backend/src/services/storage.js`
- [ ] Implement `saveJobMetadata(job)` function
- [ ] Implement `loadJobMetadata(jobId)` function
- [ ] Implement `loadAllJobs()` function
- [ ] Store jobs in `/storage/results/JOB_xxx/metadata.json`

---

## Phase 4: API Layer

### Task 4.1: Job Routes
- [ ] Create `backend/src/routes/jobRoutes.js`
- [ ] Implement routes:
  - `POST /api/jobs/upload` - Upload Excel file
  - `GET /api/jobs` - List all jobs
  - `GET /api/jobs/:id` - Get job details
  - `GET /api/jobs/:id/download` - Download CSV
  - `POST /api/jobs/:id/pause` - Pause job
  - `POST /api/jobs/:id/resume` - Resume job

### Task 4.2: Job Controller
- [ ] Create `backend/src/controllers/jobController.js`
- [ ] Implement `uploadExcel` controller
  - Receive file via Multer
  - Parse Excel file
  - Create job
  - Return job ID
- [ ] Implement `getJobs` controller
- [ ] Implement `getJobById` controller
- [ ] Implement `downloadCsv` controller
- [ ] Implement `pauseJob` controller
- [ ] Implement `resumeJob` controller

### Task 4.3: API Error Handling
- [ ] Create `backend/src/utils/errors.js`
- [ ] Define custom error classes
- [ ] Create error handling middleware
- [ ] Return consistent error responses

---

## Phase 5: Scraper Worker (Core Engine)

### Task 5.1: HTTP Client Setup
- [ ] Create `backend/src/services/httpClient.js`
- [ ] Configure Axios instance with:
  - Browser-like User-Agent
  - Accept headers
  - Accept-Language headers
  - No cookies
  - Timeout settings
- [ ] Implement retry logic with exponential backoff

### Task 5.2: Amazon Search Scraper
- [ ] Create `backend/src/services/scraper/searchScraper.js`
- [ ] Implement `searchAmazon(upc)` function
- [ ] Build search URL: `https://www.amazon.com/s?k=<UPC>`
- [ ] Parse HTML response with Cheerio
- [ ] Extract product listings
- [ ] Filter out sponsored results
- [ ] Limit to maximum 3 ASINs
- [ ] Return array of: `{ asin, url }`

### Task 5.3: UPC Fallback Logic
- [ ] In searchScraper.js, implement fallback:
  - If no results found
  - Prepend "00" to UPC
  - Retry search once
  - If still empty, return NOT_FOUND status

### Task 5.4: Product Page Scraper
- [ ] Create `backend/src/services/scraper/productScraper.js`
- [ ] Implement `scrapeProductPage(asin)` function
- [ ] Build product URL: `https://www.amazon.com/dp/<ASIN>`
- [ ] Extract fields using Cheerio:
  - ASIN (from URL)
  - Brand (from "Visit the X Store" link)
  - Rating (star rating)
  - Review Count (global ratings)
  - UPC (from Item Details/Product Information)
  - BSR (Best Seller Rank)
- [ ] Handle missing fields gracefully
- [ ] Return structured product object

### Task 5.5: HTML Selectors Configuration
- [ ] Create `backend/src/config/selectors.js`
- [ ] Define CSS selectors for:
  - Search results container
  - Sponsored badge
  - Product links
  - Brand element
  - Rating element
  - Review count element
  - Product details table
  - BSR element
- [ ] Make selectors easily configurable for maintenance

---

## Phase 6: Validation Engine

### Task 6.1: Validation Service
- [ ] Create `backend/src/services/validator.js`
- [ ] Implement `validateBrand(scrapedBrand, inputBrand)`:
  ```javascript
  return scrapedBrand.toLowerCase().includes(inputBrand.toLowerCase())
  ```
- [ ] Implement `validateUpc(scrapedUpc, inputUpc)`:
  ```javascript
  return scrapedUpc.includes(inputUpc)
  ```
- [ ] Return validation flags:
  ```javascript
  { brandMatch: true/false, upcMatch: true/false }
  ```

---

## Phase 7: Rate Limiting & Throttling

### Task 7.1: Delay Utility
- [ ] Create `backend/src/utils/delay.js`
- [ ] Implement `delay(ms)` function using Promise
- [ ] Implement `randomDelay(min, max)` function
- [ ] Use config values for delay ranges

### Task 7.2: Rate Limiter
- [ ] Create `backend/src/services/rateLimiter.js`
- [ ] Track last request timestamp
- [ ] Enforce minimum delay between requests
- [ ] Implement delay rules:
  - Search → Product: 5-7 seconds
  - Product → Product: 5-7 seconds
  - UPC → UPC: 6-10 seconds

---

## Phase 8: Worker Queue System

### Task 8.1: UPC Queue Manager
- [ ] Create `backend/src/services/upcQueue.js`
- [ ] Implement queue data structure for UPCs
- [ ] Implement `getNextPendingUpc(jobId)` function
- [ ] Implement `markUpcInProgress(jobId, rowId)` function
- [ ] Implement `markUpcDone(jobId, rowId)` function
- [ ] Implement `markUpcFailed(jobId, rowId)` function

### Task 8.2: Worker Process
- [ ] Create `backend/src/services/worker.js`
- [ ] Implement main worker loop:
  ```
  1. Get next PENDING UPC
  2. Mark as IN_PROGRESS
  3. Search Amazon
  4. For each ASIN (max 3):
     - Scrape product page
     - Validate brand/UPC
  5. Store result
  6. Mark as DONE/FAILED
  7. Apply delay
  8. Repeat
  ```
- [ ] Handle job pause/resume
- [ ] Handle job completion

### Task 8.3: Worker Orchestrator
- [ ] Create `backend/src/services/workerOrchestrator.js`
- [ ] Manage active worker per job
- [ ] Start worker when job moves to RUNNING
- [ ] Stop worker when job is PAUSED
- [ ] Track worker state
- [ ] Implement graceful shutdown

---

## Phase 9: Result Storage & Persistence

### Task 9.1: Result Storage Service
- [ ] Create `backend/src/services/resultStorage.js`
- [ ] Implement `saveUpcResult(jobId, result)`:
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
- [ ] Implement incremental writes to JSON file
- [ ] Implement `loadJobResults(jobId)` function
- [ ] Store results in `/storage/results/JOB_xxx/results.json`

---

## Phase 10: CSV Export Module

### Task 10.1: CSV Generator
- [ ] Create `backend/src/services/csvExporter.js`
- [ ] Implement `generateCsv(jobId)` function
- [ ] Define CSV columns:
  - Input UPC
  - Input Brand
  - ASIN
  - Amazon Brand
  - Brand Match
  - UPC Match
  - Rating
  - Reviews
  - BSR
  - Status
- [ ] Flatten nested results (multiple ASINs per UPC = multiple rows)
- [ ] Save to `/storage/exports/JOB_xxx.csv`

### Task 10.2: CSV Download Endpoint
- [ ] Implement download in jobController
- [ ] Check job is COMPLETED before download
- [ ] Stream file to response
- [ ] Set proper headers for download

---

## Phase 11: Error Handling & Recovery

### Task 11.1: Error Detection
- [ ] Create `backend/src/services/errorHandler.js`
- [ ] Detect HTTP 429 (Rate Limited)
- [ ] Detect HTTP 503 (Service Unavailable)
- [ ] Detect CAPTCHA pages (by HTML content)
- [ ] Detect blocked requests

### Task 11.2: Recovery Strategies
- [ ] Implement retry with exponential backoff
- [ ] Implement automatic pause on CAPTCHA (30-60 min)
- [ ] Implement job resume from last UPC
- [ ] Save partial data on failures
- [ ] Log all failures with UPC reference

### Task 11.3: Worker Crash Recovery
- [ ] On server restart, check for RUNNING jobs
- [ ] Resume from last processed UPC
- [ ] Mark incomplete UPCs as PENDING

---

## Phase 12: Logging System

### Task 12.1: Logger Setup
- [ ] Create `backend/src/utils/logger.js`
- [ ] Implement log levels: info, warn, error
- [ ] Log to console and file
- [ ] Include timestamps
- [ ] Include job ID context

### Task 12.2: Logging Integration
- [ ] Log every HTTP request outcome
- [ ] Log job state transitions
- [ ] Log failures with UPC reference
- [ ] Log scraping results summary

---

## Phase 13: Frontend - Project Setup

### Task 13.1: React Project Configuration
- [ ] Configure Vite
- [ ] Setup Tailwind CSS
- [ ] Configure React Router
- [ ] Create folder structure:
  ```
  frontend/src/
  ├── components/
  ├── pages/
  ├── services/
  ├── hooks/
  └── App.jsx
  ```

### Task 13.2: API Service Layer
- [ ] Create `frontend/src/services/api.js`
- [ ] Configure Axios base URL
- [ ] Implement API functions:
  - `uploadExcel(file)`
  - `getJobs()`
  - `getJob(id)`
  - `downloadCsv(id)`
  - `pauseJob(id)`
  - `resumeJob(id)`

---

## Phase 14: Frontend - Pages & Components

### Task 14.1: Layout Components
- [ ] Create `Header.jsx` - App header/navigation
- [ ] Create `Layout.jsx` - Main layout wrapper
- [ ] Create `StatusBadge.jsx` - Job status indicator

### Task 14.2: Dashboard Page
- [ ] Create `pages/Dashboard.jsx`
- [ ] Display job list table with columns:
  - Job ID
  - Created At
  - Status (with badge)
  - Progress (X / Total)
  - Actions (View/Download)
- [ ] Add refresh button
- [ ] Link to upload page

### Task 14.3: Upload Page
- [ ] Create `pages/Upload.jsx`
- [ ] Create file input (accept .xlsx only)
- [ ] Add upload button
- [ ] Show upload progress/status
- [ ] Client-side validation:
  - File type must be .xlsx
  - File size limit
- [ ] Redirect to job page on success

### Task 14.4: Job Progress Page
- [ ] Create `pages/JobProgress.jsx`
- [ ] Display job details:
  - Job ID
  - Status
  - Created/Started/Completed timestamps
- [ ] Show progress bar
- [ ] Show counters:
  - Total UPCs
  - Processed
  - Failed
  - Percentage
- [ ] Implement auto-refresh (poll every 10-15 seconds)
- [ ] Show pause/resume buttons
- [ ] Show download button (when completed)

### Task 14.5: Reusable Components
- [ ] Create `ProgressBar.jsx`
- [ ] Create `JobTable.jsx`
- [ ] Create `FileUploader.jsx`
- [ ] Create `ErrorBanner.jsx`
- [ ] Create `LoadingSpinner.jsx`

---

## Phase 15: Frontend - State & Routing

### Task 15.1: React Router Setup
- [ ] Configure routes in `App.jsx`:
  - `/` - Dashboard
  - `/upload` - Upload page
  - `/jobs/:id` - Job progress page

### Task 15.2: State Management
- [ ] Create custom hooks:
  - `useJobs()` - Fetch and manage jobs list
  - `useJob(id)` - Fetch single job with polling
  - `useUpload()` - Handle file upload state

---

## Phase 16: Integration & Testing

### Task 16.1: Backend Integration Testing
- [ ] Test Excel upload endpoint
- [ ] Test job creation flow
- [ ] Test scraper with sample UPCs
- [ ] Test CSV generation
- [ ] Test error recovery

### Task 16.2: Frontend Integration Testing
- [ ] Test file upload UI
- [ ] Test job list display
- [ ] Test progress updates
- [ ] Test CSV download
- [ ] Test error handling UI

### Task 16.3: End-to-End Testing
- [ ] Upload Excel with 10 test UPCs
- [ ] Monitor job progress
- [ ] Verify CSV output
- [ ] Test pause/resume
- [ ] Test server restart recovery

---

## Phase 17: Performance & Optimization

### Task 17.1: Throughput Verification
- [ ] Run test with 100 UPCs
- [ ] Measure actual processing rate
- [ ] Calculate daily capacity
- [ ] Adjust delays if needed

### Task 17.2: Memory Optimization
- [ ] Use streaming for large files
- [ ] Implement pagination for job lists
- [ ] Clean up old job files

---

## Phase 18: Documentation & Deployment

### Task 18.1: Documentation
- [ ] Update CLAUDE.md with actual commands
- [ ] Document API endpoints
- [ ] Document configuration options
- [ ] Add troubleshooting guide

### Task 18.2: Docker Setup (Optional)
- [ ] Create `Dockerfile` for backend
- [ ] Create `Dockerfile` for frontend
- [ ] Create `docker-compose.yml`
- [ ] Document Docker deployment

### Task 18.3: Production Preparation
- [ ] Add PM2 configuration for backend
- [ ] Build frontend for production
- [ ] Configure reverse proxy (nginx)
- [ ] Set up log rotation

---

## Quick Start Commands

### Development
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Production
```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd frontend
npm install
npm run build
```

---

## Estimated Task Breakdown

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 5 | Project Setup |
| 2 | 3 | Backend Infrastructure |
| 3 | 3 | Job Management |
| 4 | 3 | API Layer |
| 5 | 5 | Scraper Worker |
| 6 | 1 | Validation |
| 7 | 2 | Rate Limiting |
| 8 | 3 | Worker Queue |
| 9 | 1 | Result Storage |
| 10 | 2 | CSV Export |
| 11 | 3 | Error Handling |
| 12 | 2 | Logging |
| 13 | 2 | Frontend Setup |
| 14 | 5 | Frontend Pages |
| 15 | 2 | Frontend State |
| 16 | 3 | Testing |
| 17 | 2 | Optimization |
| 18 | 3 | Documentation |

**Total: 50 Tasks across 18 Phases**

---

## Next Steps

Start with **Phase 1: Project Setup & Configuration** and proceed sequentially. Each phase builds upon the previous one.
