#!/usr/bin/env bash
#
# Bootstrap: Create S3 bucket + DynamoDB table for Terraform remote state.
# One-time, idempotent. Skips resources that already exist.
#
# Usage:
#   ./scripts/bootstrap-tfstate.sh [--profile <aws-profile>] [--region <region>] [--bucket <name>] [--table <name>]
#
# Defaults:
#   region = ap-northeast-2
#   bucket = makit-tfstate-${AWS_ACCOUNT_ID}-${REGION}   (auto-derived)
#   table  = makit-tflock
#
# After success, outputs values to paste into infra/terraform/envs/*.tfvars.

set -euo pipefail

AWS_PROFILE=""
REGION="ap-northeast-2"
BUCKET=""
TABLE="makit-tfstate-lock"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) AWS_PROFILE="$2"; shift 2 ;;
    --region)  REGION="$2";      shift 2 ;;
    --bucket)  BUCKET="$2";      shift 2 ;;
    --table)   TABLE="$2";       shift 2 ;;
    --dry-run) DRY_RUN="true";   shift   ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "[!] Unknown flag: $1" >&2; exit 2 ;;
  esac
done

AWS_ARGS=()
if [[ -n "$AWS_PROFILE" ]]; then AWS_ARGS+=(--profile "$AWS_PROFILE"); fi
AWS_ARGS+=(--region "$REGION")

command -v aws >/dev/null 2>&1 || { echo "[!] aws CLI not found. Install first."; exit 127; }

echo "[*] Verifying AWS credentials…"
IDENTITY_JSON="$(aws sts get-caller-identity "${AWS_ARGS[@]}")"
ACCOUNT_ID="$(echo "$IDENTITY_JSON" | grep -Eo '"Account"[^"]*"[0-9]+"' | grep -Eo '[0-9]+')"
CALLER_ARN="$(echo "$IDENTITY_JSON" | grep -Eo '"Arn"[^"]*"[^"]+"' | sed 's/.*"Arn"[^"]*"//;s/"$//')"
echo "    Account: $ACCOUNT_ID"
echo "    Caller : $CALLER_ARN"

if [[ -z "$BUCKET" ]]; then
  BUCKET="makit-tfstate-${ACCOUNT_ID}"
fi
echo "[*] Region: $REGION"
echo "[*] Bucket: $BUCKET"
echo "[*] Table : $TABLE"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[*] DRY-RUN mode — no resources will be created."
fi

run() {
  echo "    > $*"
  if [[ "$DRY_RUN" != "true" ]]; then
    "$@"
  fi
}

############################################################
# 1) S3 bucket
############################################################
echo ""
echo "[1/2] S3 bucket for Terraform state"

if aws s3api head-bucket --bucket "$BUCKET" "${AWS_ARGS[@]}" 2>/dev/null; then
  echo "    ✓ Bucket $BUCKET already exists (skipping create)"
else
  echo "    Creating bucket $BUCKET…"
  if [[ "$REGION" == "us-east-1" ]]; then
    run aws s3api create-bucket --bucket "$BUCKET" "${AWS_ARGS[@]}"
  else
    run aws s3api create-bucket --bucket "$BUCKET" \
      --create-bucket-configuration LocationConstraint="$REGION" \
      "${AWS_ARGS[@]}"
  fi
fi

echo "    Enabling versioning…"
run aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled "${AWS_ARGS[@]}"

echo "    Enforcing default SSE-S3 encryption…"
run aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}' \
  "${AWS_ARGS[@]}"

echo "    Blocking all public access…"
run aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true' \
  "${AWS_ARGS[@]}"

# HTTPS-only + deny insecure transport
POLICY="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::${BUCKET}",
        "arn:aws:s3:::${BUCKET}/*"
      ],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
EOF
)"
TMP_POLICY="$(mktemp)"; echo "$POLICY" > "$TMP_POLICY"
echo "    Applying HTTPS-only bucket policy…"
run aws s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$TMP_POLICY" "${AWS_ARGS[@]}"
rm -f "$TMP_POLICY"

echo "    Enabling lifecycle (expire noncurrent state versions after 90 days)…"
LIFECYCLE='{"Rules":[{"ID":"expire-noncurrent","Status":"Enabled","Filter":{},"NoncurrentVersionExpiration":{"NoncurrentDays":90},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}'
TMP_LC="$(mktemp)"; echo "$LIFECYCLE" > "$TMP_LC"
run aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration "file://$TMP_LC" "${AWS_ARGS[@]}"
rm -f "$TMP_LC"

############################################################
# 2) DynamoDB lock table
############################################################
echo ""
echo "[2/2] DynamoDB table for state locking"

if aws dynamodb describe-table --table-name "$TABLE" "${AWS_ARGS[@]}" >/dev/null 2>&1; then
  echo "    ✓ Table $TABLE already exists (skipping create)"
else
  echo "    Creating table $TABLE (PAY_PER_REQUEST)…"
  run aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --tags Key=Project,Value=MaKIT Key=Purpose,Value=TerraformStateLock \
    "${AWS_ARGS[@]}"
  echo "    Waiting for table to become ACTIVE…"
  run aws dynamodb wait table-exists --table-name "$TABLE" "${AWS_ARGS[@]}"
fi

############################################################
# Output summary
############################################################
echo ""
echo "[✓] Bootstrap complete."
echo ""
echo "============================================================"
echo "Paste the following into each infra/terraform/envs/*.tfvars"
echo "(or into a *.tfbackend file if you use -backend-config):"
echo ""
echo "  tfstate_bucket_name = \"$BUCKET\""
echo "  tfstate_lock_table  = \"$TABLE\""
echo "  aws_region          = \"$REGION\""
echo ""
echo "Then:"
echo "  cd infra/terraform"
echo "  terraform init \\"
echo "    -backend-config=\"bucket=$BUCKET\" \\"
echo "    -backend-config=\"dynamodb_table=$TABLE\" \\"
echo "    -backend-config=\"region=$REGION\" \\"
echo "    -backend-config=\"key=makit/dev/terraform.tfstate\""
echo "============================================================"
