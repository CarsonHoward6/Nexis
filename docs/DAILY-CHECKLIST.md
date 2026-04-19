# SnapRelay — 14-Day Build Checklist

Track every task. Check boxes as you go. Each day has a clear deliverable so you always know if you're on track.

---

## Pre-Work (Before Day 1)

- [ ] Create AWS account (use your SVU email for student credits)
- [ ] Apply for AWS Educate at `aws.amazon.com/education/awseducate` — free $100 credits
- [ ] Install: Node.js 20+, AWS CLI, Git
- [ ] Run `aws configure` with your IAM access keys
- [ ] Create GitHub repo: `snaprelay`
- [ ] Bootstrap Next.js: `npx create-next-app snaprelay-frontend --typescript --tailwind --app`
- [ ] Create `snaprelay-backend/` folder for Lambda functions

**✅ Pre-work done when:** `aws s3 ls` returns without error

---

## WEEK 1 — AWS Backend

---

### Day 1 — S3 + IAM
**Goal: Files can be stored and retrieved in S3**

- [ ] Open AWS Console → S3 → Create bucket: `snaprelay-files-{your-account-id}`
- [ ] Region: `us-east-1`
- [ ] Block all public access: ON (files served via signed URLs only)
- [ ] Enable bucket versioning
- [ ] Add CORS configuration (copy from SKILL.md)
- [ ] Create IAM role: `snaprelay-lambda-role` with inline policy (copy from SKILL.md)
- [ ] Test: manually upload a test file via console, generate a pre-signed URL, open in browser

**✅ Day 1 done when:** You can open a pre-signed URL for a file in your S3 bucket

---

### Day 2 — DynamoDB
**Goal: File metadata can be written and queried**

- [ ] Open DynamoDB → Create table: `snaprelay-files`
- [ ] Partition key: `userId` (String)
- [ ] Sort key: `fileId` (String)
- [ ] Create GSI: `groupId-uploadedAt-index`
  - Partition key: `groupId` (String)
  - Sort key: `uploadedAt` (String)
  - Projection: ALL
- [ ] Manually insert a test item via console to verify schema
- [ ] Query the table via console to verify GSI works

**✅ Day 2 done when:** You can query the GSI and get your test item back

---

### Day 3 — Lambda Functions (presign + savePhoto)
**Goal: Two core Lambdas deployed and testable**

- [ ] In `snaprelay-backend/`, create `presign/index.mjs` (copy from SKILL.md)
- [ ] Zip and deploy: `zip -r presign.zip . && aws lambda create-function ...`
  - Runtime: `nodejs20.x`
  - Handler: `index.handler`
  - Role: `snaprelay-lambda-role` ARN
  - Set env vars: `S3_BUCKET`, `REGION`
- [ ] Create `savePhoto/index.mjs` (copy from SKILL.md), zip and deploy same way
  - Set env vars: `DYNAMODB_TABLE`, `REGION`
- [ ] Test each Lambda via console Test button with mock event JSON
- [ ] Check CloudWatch logs to confirm execution

**✅ Day 3 done when:** Both Lambdas run without error in CloudWatch

---

### Day 4 — Lambda Functions (listFiles + shareLink)
**Goal: Files can be listed and download links generated**

- [ ] Create `listFiles/index.mjs` (copy from SKILL.md), deploy
  - Set env vars: `DYNAMODB_TABLE`, `REGION`
- [ ] Create `shareLink/index.mjs` (copy from SKILL.md), deploy
  - Set env vars: `S3_BUCKET`, `DYNAMODB_TABLE`, `REGION`
- [ ] Test `listFiles` — mock event with userId claim, verify returns array
- [ ] Test `shareLink` — mock event with a real fileId from DynamoDB, verify signed URL returned
- [ ] Open signed URL in browser — file should download

**✅ Day 4 done when:** You get a working download link from shareLink Lambda

---

### Day 5 — SQS + processUpload Lambda
**Goal: Async processing pipeline working end-to-end**

- [ ] Open SQS → Create queue: `snaprelay-processing`
  - Type: Standard
  - Default visibility timeout: 30 seconds
  - Message retention: 4 days
- [ ] Create `processUpload/index.mjs` (copy from SKILL.md), deploy
  - Set env vars: `DYNAMODB_TABLE`, `REGION`
- [ ] Add SQS event source mapping to `processUpload` Lambda:
  - AWS Console → Lambda → processUpload → Add trigger → SQS → select `snaprelay-processing`
  - Batch size: 1
- [ ] Manually send a test message to SQS queue via console
- [ ] Check CloudWatch logs — processUpload Lambda should have fired
- [ ] Check DynamoDB — test item status should now be "ready"

**✅ Day 5 done when:** SQS message → Lambda → DynamoDB update works automatically

---

### Day 6 — Cognito + API Gateway
**Goal: Authenticated REST API fully wired up**

- [ ] Open Cognito → Create User Pool: `snaprelay-users`
  - Sign-in: Email
  - Password policy: default
  - No MFA for now
  - App client: `snaprelay-web` (public, no secret)
- [ ] Create groups: `admins`, `wedding-crew`, `sports-team`
- [ ] Create a test user manually and add to `wedding-crew` group
- [ ] Open API Gateway → Create REST API: `snaprelay-api`
- [ ] Create Cognito Authorizer → point at your User Pool
- [ ] Create all routes (see SKILL.md for full list)
  - Each route: Integration type = Lambda, select correct function
  - Each route: Authorization = your Cognito Authorizer
  - Enable CORS on every resource
- [ ] Deploy API → Stage name: `prod`
- [ ] Copy the Invoke URL

**✅ Day 6 done when:** `curl -H "Authorization: Bearer {token}" {apiUrl}/files` returns 200

---

### Day 7 — Integration Test + S3 Event Trigger
**Goal: Full backend flow works from API call to SQS processing**

- [ ] Wire S3 → SQS: S3 bucket → Properties → Event notifications
  - Event type: `s3:ObjectCreated:*`
  - Destination: SQS → `snaprelay-processing`
  - (Or: S3 → Lambda → SQS for more control)
- [ ] Get a Cognito JWT: use Cognito Hosted UI or `aws cognito-idp initiate-auth` CLI
- [ ] Full flow test in Postman or curl:
  1. `POST /upload/presign` → get uploadUrl + fileId
  2. `PUT {uploadUrl}` with a test file → 200
  3. `POST /files` with metadata → 201
  4. Wait 5 seconds
  5. `GET /files` → file appears with status "ready"
  6. `POST /files/{id}/share` → get download URL
  7. Open download URL → file downloads
- [ ] Fix any CORS or permission errors

**✅ Day 7 done when:** All 6 steps complete without error

---

## WEEK 2 — Frontend + Polish

---

### Day 8 — Next.js Setup + Auth
**Goal: Login works, token available to make API calls**

- [ ] `cd snaprelay-frontend`
- [ ] `npm install aws-amplify`
- [ ] Create `lib/auth.ts` (copy from SKILL.md)
- [ ] Create `lib/api.ts` with fetch wrapper that auto-adds `Authorization: Bearer {token}`
- [ ] Create `app/login/page.tsx` — simple email/password form calling Amplify `signIn()`
- [ ] Create auth context/provider to share user state across app
- [ ] Create `.env.local` with Cognito and API values
- [ ] Test: login with your test user, console.log the JWT

**✅ Day 8 done when:** You can sign in and see a JWT in the browser console

---

### Day 9 — Gallery Page
**Goal: Uploaded files display in the UI**

- [ ] Create `app/gallery/page.tsx`
- [ ] Fetch `GET /files` on load, render file grid
- [ ] Show per file: filename, file size, type badge (RAW/JPG), uploader, time, status badge
- [ ] Add group filter tabs (All, wedding-crew, sports-team)
- [ ] Clicking a group tab fetches `GET /files?group=wedding-crew`
- [ ] Loading and empty states
- [ ] Test with real files in DynamoDB

**✅ Day 9 done when:** Gallery renders real files from your API

---

### Day 10 — Upload Flow
**Goal: Files upload through the UI end-to-end**

- [ ] Create `components/UploadZone.tsx` — drag and drop + file input
- [ ] Accept: `image/*,.CR3,.CR2,.NEF,.ARW,.DNG`
- [ ] Group selector dropdown + Public/Private toggle
- [ ] On drop/select: call `lib/upload.ts` uploadFile() — 3-step flow (presign → S3 PUT → savePhoto)
- [ ] Show upload progress bar (use XHR instead of fetch for progress events)
- [ ] On complete: refresh gallery
- [ ] Test with a real JPG and a large RAW file

**✅ Day 10 done when:** A real file uploads, appears in gallery with status "processing" then "ready"

---

### Day 11 — File Modal + Share/Download
**Goal: Users can download files and generate share links**

- [ ] Create `components/FileModal.tsx` — opens on file click
- [ ] Show: full filename, size, uploader, group, upload date, status
- [ ] Download button → `POST /files/{id}/share?expires=3600` → trigger browser download
- [ ] Share Link button → `POST /files/{id}/share?expires=86400` → copy URL to clipboard
- [ ] Toast notification: "Link copied! Expires in 24 hours"
- [ ] Test share link in incognito window — should work without login

**✅ Day 11 done when:** Download works and share link opens in incognito

---

### Day 12 — Architecture Diagram
**Goal: Submission-ready diagram**

- [ ] Go to `app.diagrams.net` (draw.io, free)
- [ ] Use AWS shape library (Extras → Edit Diagram or built-in AWS icons)
- [ ] Draw the architecture (reference SKILL.md diagram description)
- [ ] Label every arrow with what flows through it (JWT, pre-signed URL, S3 key, SQS message)
- [ ] Color code by layer: Auth (blue), API (orange), Storage (green), Async (purple)
- [ ] Export as PNG (high res) and PDF
- [ ] Save to your GitHub repo as `docs/architecture.png`

**✅ Day 12 done when:** Diagram exported and pushed to GitHub

---

### Day 13 — Deploy + Polish
**Goal: App live on the internet**

- [ ] Push frontend to GitHub
- [ ] Connect repo to Vercel (vercel.com → Import Project)
- [ ] Add all `.env.local` values as Vercel Environment Variables
- [ ] Update S3 CORS AllowedOrigins to include your `*.vercel.app` URL
- [ ] Update API Gateway CORS to allow your Vercel domain
- [ ] Deploy and test full flow on live URL from your phone
- [ ] Add Vercel URL to your GitHub README
- [ ] Write README: what the app does, architecture overview, how to run locally

**✅ Day 13 done when:** App works end-to-end at your Vercel URL on your phone

---

### Day 14 — Demo Prep
**Goal: Confident, smooth demo**

- [ ] Run through demo script from SKILL.md 3 times
- [ ] Create two test accounts: `carson@test.com` (admin), `teammate@test.com` (wedding-crew)
- [ ] Pre-upload 3-4 test files so gallery isn't empty at start of demo
- [ ] Have architecture diagram open in a second tab
- [ ] Practice the SQS explanation out loud (this is your "wow" moment)
- [ ] Prepare for Q&A: why pre-signed URLs? why SQS vs direct processing? why DynamoDB vs RDS?

**✅ Day 14 done when:** You can demo start-to-finish in under 5 minutes without looking at notes

---

## Q&A Prep (Common Professor Questions)

**"Why pre-signed URLs instead of uploading through your server?"**
Files go directly from browser to S3 — your Lambda never handles binary data. This is cheaper, faster, and more scalable. A 25MB RAW file would blow through Lambda's memory if routed through it.

**"Why SQS instead of just processing in the upload Lambda?"**
Lambda has a 15-minute timeout and the upload response would be delayed. SQS decouples the concerns — user gets instant confirmation, processing happens in background. If processing fails, SQS retries automatically.

**"Why DynamoDB instead of RDS?"**
File metadata is a simple key-value access pattern — fetch by userId, query by groupId. DynamoDB's GSI handles this perfectly with no SQL, no connection pooling, and scales to millions of records for the same price.

**"How does auth work?"**
Cognito issues a JWT on login. The browser sends it in every API request. API Gateway has a Cognito Authorizer that validates the token before the Lambda even runs — the Lambda never does auth logic itself.
