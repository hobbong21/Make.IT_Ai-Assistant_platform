#Requires -Version 5.1
<#
.SYNOPSIS
    Bootstrap Terraform remote state: S3 bucket + DynamoDB lock table (idempotent).

.DESCRIPTION
    One-time setup. Skips resources that already exist.
    After success, outputs values to paste into infra/terraform/envs/*.tfvars.

.PARAMETER Profile
    AWS CLI profile name (optional).

.PARAMETER Region
    AWS region. Default: ap-northeast-2.

.PARAMETER Bucket
    S3 bucket name. Default: makit-tfstate-<account-id>-<region>.

.PARAMETER Table
    DynamoDB table name. Default: makit-tflock.

.PARAMETER DryRun
    If specified, print intended actions without executing.

.EXAMPLE
    .\scripts\bootstrap-tfstate.ps1 -Profile makit-admin

.EXAMPLE
    .\scripts\bootstrap-tfstate.ps1 -Region us-east-1 -DryRun
#>

[CmdletBinding()]
param(
    [string]$Profile = "",
    [string]$Region  = "ap-northeast-2",
    [string]$Bucket  = "",
    [string]$Table   = "makit-tfstate-lock",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-Aws {
    param([string[]]$Args)
    $full = @("aws") + $Args + @("--region", $Region)
    if ($Profile) { $full += @("--profile", $Profile) }
    Write-Host "    > $($full -join ' ')"
    if (-not $DryRun) {
        & $full[0] $full[1..($full.Length - 1)]
        if ($LASTEXITCODE -ne 0) { throw "AWS CLI exited with code $LASTEXITCODE" }
    }
}

function Test-AwsCommand {
    $aws = Get-Command aws -ErrorAction SilentlyContinue
    if (-not $aws) { throw "aws CLI not found on PATH. Install: https://aws.amazon.com/cli/" }
}

Test-AwsCommand

Write-Host "[*] Verifying AWS credentials…"
$idArgs = @("sts", "get-caller-identity", "--output", "json", "--region", $Region)
if ($Profile) { $idArgs += @("--profile", $Profile) }
$identity = (& aws $idArgs) | ConvertFrom-Json
$AccountId = $identity.Account
$CallerArn = $identity.Arn
Write-Host "    Account: $AccountId"
Write-Host "    Caller : $CallerArn"

if (-not $Bucket) { $Bucket = "makit-tfstate-$AccountId" }
Write-Host "[*] Region: $Region"
Write-Host "[*] Bucket: $Bucket"
Write-Host "[*] Table : $Table"
if ($DryRun) { Write-Host "[*] DRY-RUN mode — no resources will be created." }

############################################################
# 1) S3 bucket
############################################################
Write-Host ""
Write-Host "[1/2] S3 bucket for Terraform state"

$headArgs = @("s3api", "head-bucket", "--bucket", $Bucket, "--region", $Region)
if ($Profile) { $headArgs += @("--profile", $Profile) }
& aws $headArgs 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✓ Bucket $Bucket already exists (skipping create)"
} else {
    Write-Host "    Creating bucket $Bucket…"
    if ($Region -eq "us-east-1") {
        Invoke-Aws @("s3api", "create-bucket", "--bucket", $Bucket)
    } else {
        Invoke-Aws @("s3api", "create-bucket", "--bucket", $Bucket,
            "--create-bucket-configuration", "LocationConstraint=$Region")
    }
}

Write-Host "    Enabling versioning…"
Invoke-Aws @("s3api", "put-bucket-versioning", "--bucket", $Bucket,
    "--versioning-configuration", "Status=Enabled")

Write-Host "    Enforcing default SSE-S3 encryption…"
$encCfg = '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
Invoke-Aws @("s3api", "put-bucket-encryption", "--bucket", $Bucket,
    "--server-side-encryption-configuration", $encCfg)

Write-Host "    Blocking all public access…"
Invoke-Aws @("s3api", "put-public-access-block", "--bucket", $Bucket,
    "--public-access-block-configuration",
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true")

$policy = @{
    Version   = "2012-10-17"
    Statement = @(
        @{
            Sid       = "DenyInsecureTransport"
            Effect    = "Deny"
            Principal = "*"
            Action    = "s3:*"
            Resource  = @("arn:aws:s3:::$Bucket", "arn:aws:s3:::$Bucket/*")
            Condition = @{ Bool = @{ "aws:SecureTransport" = "false" } }
        }
    )
} | ConvertTo-Json -Depth 8 -Compress
$tmpPolicy = [System.IO.Path]::GetTempFileName()
$policy | Set-Content -Path $tmpPolicy -Encoding UTF8
Write-Host "    Applying HTTPS-only bucket policy…"
Invoke-Aws @("s3api", "put-bucket-policy", "--bucket", $Bucket, "--policy", "file://$tmpPolicy")
Remove-Item -Force $tmpPolicy -ErrorAction SilentlyContinue

Write-Host "    Enabling lifecycle (expire noncurrent state versions after 90 days)…"
$lifecycle = '{"Rules":[{"ID":"expire-noncurrent","Status":"Enabled","Filter":{},"NoncurrentVersionExpiration":{"NoncurrentDays":90},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}'
$tmpLc = [System.IO.Path]::GetTempFileName()
$lifecycle | Set-Content -Path $tmpLc -Encoding UTF8
Invoke-Aws @("s3api", "put-bucket-lifecycle-configuration", "--bucket", $Bucket, "--lifecycle-configuration", "file://$tmpLc")
Remove-Item -Force $tmpLc -ErrorAction SilentlyContinue

############################################################
# 2) DynamoDB lock table
############################################################
Write-Host ""
Write-Host "[2/2] DynamoDB table for state locking"

$descArgs = @("dynamodb", "describe-table", "--table-name", $Table, "--region", $Region)
if ($Profile) { $descArgs += @("--profile", $Profile) }
& aws $descArgs 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✓ Table $Table already exists (skipping create)"
} else {
    Write-Host "    Creating table $Table (PAY_PER_REQUEST)…"
    Invoke-Aws @("dynamodb", "create-table",
        "--table-name", $Table,
        "--attribute-definitions", "AttributeName=LockID,AttributeType=S",
        "--key-schema", "AttributeName=LockID,KeyType=HASH",
        "--billing-mode", "PAY_PER_REQUEST",
        "--tags", "Key=Project,Value=MaKIT", "Key=Purpose,Value=TerraformStateLock")
    Write-Host "    Waiting for table to become ACTIVE…"
    Invoke-Aws @("dynamodb", "wait", "table-exists", "--table-name", $Table)
}

############################################################
# Output summary
############################################################
Write-Host ""
Write-Host "[✓] Bootstrap complete."
Write-Host ""
Write-Host "============================================================"
Write-Host "Paste the following into each infra/terraform/envs/*.tfvars"
Write-Host "(or into a *.tfbackend file if you use -backend-config):"
Write-Host ""
Write-Host "  tfstate_bucket_name = `"$Bucket`""
Write-Host "  tfstate_lock_table  = `"$Table`""
Write-Host "  aws_region          = `"$Region`""
Write-Host ""
Write-Host "Then:"
Write-Host "  cd infra/terraform"
Write-Host "  terraform init ``"
Write-Host "    -backend-config=`"bucket=$Bucket`" ``"
Write-Host "    -backend-config=`"dynamodb_table=$Table`" ``"
Write-Host "    -backend-config=`"region=$Region`" ``"
Write-Host "    -backend-config=`"key=makit/dev/terraform.tfstate`""
Write-Host "============================================================"
