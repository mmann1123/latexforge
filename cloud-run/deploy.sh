#!/bin/bash
# Deploy the LaTeX compile service to Cloud Run
# Usage: ./deploy.sh [PROJECT_ID] [REGION]

PROJECT_ID=${1:-$(gcloud config get-value project)}
REGION=${2:-us-central1}

echo "Deploying to project: $PROJECT_ID, region: $REGION"

gcloud run deploy latex-compiler \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 120 \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 4 \
  --set-env-vars "^||^ALLOWED_ORIGINS=https://latexforge.web.app,https://latexforge.firebaseapp.com||ALLOWED_EMAILS=mmann1123@gmail.com||GEMINI_API_KEY=${GEMINI_API_KEY:?Set GEMINI_API_KEY env var before deploying}" \
  --project "$PROJECT_ID"

echo "Deployment complete!"
echo "Service URL:"
gcloud run services describe latex-compiler --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)'
