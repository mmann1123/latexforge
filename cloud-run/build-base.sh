#!/bin/bash
# One-time: build and push the heavy base image with texlive-full.
# After this, deploy.sh builds only the thin app layer (~seconds).
# Re-run only if you need to update texlive or system packages.

set -e

PROJECT_ID=${1:-$(gcloud config get-value project)}
REGION=us-central1
REPO=latexforge-base
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/texlive:latest"

# Create Artifact Registry repo if it doesn't exist
gcloud artifacts repositories describe "$REPO" --location="$REGION" --project="$PROJECT_ID" 2>/dev/null || \
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --description="LaTeX Forge base image"

# Configure Docker auth
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

# Build and push
echo "Building base image (this will take ~15 minutes the first time)..."
docker build -f Dockerfile.base -t "$IMAGE" .
docker push "$IMAGE"

echo "Done! Base image pushed to: $IMAGE"
echo "Future deploys via deploy.sh will be fast."
