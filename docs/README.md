# SnapRelay

> File storage and sharing service built on AWS. Upload photos from your camera, share with your team instantly, download from any device.

**Live App:** [your-app.vercel.app]  
**Architecture Diagram:** [docs/architecture.png]

---

## AWS Services

| Service | Role |
|---|---|
| S3 | Binary file storage |
| Lambda | Serverless business logic (5 functions) |
| API Gateway | REST API with Cognito auth |
| Cognito | User auth + group management |
| DynamoDB | File metadata + GSI for group queries |
| SQS | Async processing queue |

## Architecture

```
Browser → API Gateway → Lambda → S3 + DynamoDB
                                      ↓
                                  SQS Queue
                                      ↓
                              processUpload Lambda
                                      ↓
                              DynamoDB (status: ready)
```

## Local Development

```bash
# Frontend
cd snaprelay-frontend
cp .env.example .env.local  # fill in your values
npm install
npm run dev
# → http://localhost:3000

# Test a Lambda locally
cd snaprelay-backend/presign
node -e "import('./index.mjs').then(m => m.handler(require('./test-event.json')).then(console.log))"
```

## Deploy

```bash
# Frontend
vercel deploy --prod

# Lambda (from backend folder)
cd snaprelay-backend/presign
zip -r presign.zip .
aws lambda update-function-code --function-name snaprelay-presign --zip-file fileb://presign.zip
```

## Environment Variables

```
NEXT_PUBLIC_API_URL=https://{id}.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Project Structure

```
snaprelay/
├── snaprelay-backend/
│   ├── presign/index.mjs         # Generate S3 upload URL
│   ├── savePhoto/index.mjs       # Write metadata to DynamoDB
│   ├── listFiles/index.mjs       # Query files/gallery
│   ├── shareLink/index.mjs       # Generate download URL
│   └── processUpload/index.mjs   # SQS consumer
├── snaprelay-frontend/
│   ├── app/
│   │   ├── login/page.tsx
│   │   └── gallery/page.tsx
│   ├── components/
│   │   ├── UploadZone.tsx
│   │   ├── FileGrid.tsx
│   │   └── FileModal.tsx
│   └── lib/
│       ├── auth.ts
│       ├── api.ts
│       └── upload.ts
└── docs/
    ├── architecture.png
    ├── DAILY-CHECKLIST.md
    ├── ARCHITECTURE.md
    └── AWS-CLI-CHEATSHEET.md
```

---

Built for SVU CS AWS Final Project — Spring 2026
