# Nexis

> File storage and sharing service built on AWS. Upload photos from your camera, share with your team instantly, download from any device.

**Live App:** [your-app.vercel.app]  
**Architecture Diagram:** [docs/architecture.png]

---

## AWS Services

| Service | Role |
|---|---|
| S3 | Binary file storage |
| Lambda | Serverless business logic (11 functions) |
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
npm install
npm run dev
# → http://localhost:3000
```

## Environment Variables

All config lives in a single `.env` file at the project root.
See `.env.example` for the full template.

## Project Structure

```
nexis/
├── snaprelay-frontend/       # Next.js 15 + Tailwind v4
│   ├── app/                  # Pages: login, signup, gallery, join, share
│   ├── components/           # UI: UploadZone, FileGrid, FileModal, dialogs
│   └── lib/                  # API layer, auth context, upload utilities
├── snaprelay-backend/        # Lambda functions (Phase 2)
└── docs/                     # Architecture, AWS setup, cheat sheets
```

---

Built for SVU CS AWS Final Project — Spring 2026
