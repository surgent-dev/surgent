#!/bin/bash
# Sync .env file to AWS SSM Parameter Store
# Usage: ./sync-env-to-ssm.sh <path-to-env-file> <ssm-prefix> <aws-region>

set -e

if [ "$#" -ne 3 ]; then
  echo "Usage: ./sync-env-to-ssm.sh <path-to-env-file> <ssm-prefix> <aws-region>"
  echo "Example: ./sync-env-to-ssm.sh ~/.env.prod /your-app/worker us-east-1"
  exit 1
fi

ENV_FILE="$1"
SSM_PREFIX="${2%/}"
REGION="$3"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

echo "Reading from: $ENV_FILE"
echo "SSM prefix: $SSM_PREFIX"
echo "Region: $REGION"
echo ""

# Count parameters
TOTAL=$(grep -v '^#' "$ENV_FILE" | grep -v '^$' | grep '=' | wc -l)
CURRENT=0

while IFS= read -r line || [ -n "$line" ]; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  
  # Skip lines without =
  [[ ! "$line" =~ = ]] && continue
  
  # Extract key and value
  KEY="${line%%=*}"
  VALUE="${line#*=}"
  
  # Remove surrounding quotes from value
  VALUE="${VALUE#\"}"
  VALUE="${VALUE%\"}"
  VALUE="${VALUE#\'}"
  VALUE="${VALUE%\'}"
  
  # Skip if key or value is empty
  [[ -z "$KEY" || -z "$VALUE" ]] && continue
  
  CURRENT=$((CURRENT + 1))
  PARAM_NAME="$SSM_PREFIX/$KEY"
  
  echo "[$CURRENT/$TOTAL] $KEY"
  
  aws ssm put-parameter \
    --name "$PARAM_NAME" \
    --value "$VALUE" \
    --type "SecureString" \
    --overwrite \
    --region "$REGION" \
    > /dev/null
    
done < "$ENV_FILE"

echo ""
echo "Done! Created/updated $CURRENT parameters in SSM."
