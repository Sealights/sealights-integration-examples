# Mirror a SeaLights Lambda Layer Into Your Own AWS Account

`mirror-sl-layer.sh` copies a SeaLights-published Lambda layer into **your** AWS account and republishes it under your own layer ARN.

## Why you might need this

SeaLights publishes serverless agents (Python, Node, and Java) as AWS Lambda layers in a SeaLights-owned account. Many organizations can't (or won't) reference an external, third-party layer ARN directly from their functions — common reasons include:

- Security policies that forbid attaching layers owned by another AWS account.
- Air-gapped, region-restricted, or otherwise isolated environments.
- Wanting full control over the exact artifact deployed, in their own account.

This script solves that: it reads the SeaLights layer (a cross-account read that SeaLights explicitly allows), verifies its integrity, and republishes an identical copy as a layer **you own**. You then reference *your* layer ARN from your functions.

## What this script does — and does not — do

- **It does:** download the SeaLights layer content, verify its checksum, and publish an identical copy into your account.
- **It does NOT** touch, create, or modify any of your Lambda functions; describe or demonstrate the SeaLights Lambda integration process.

## Prerequisites

- The AWS CLI, configured with **your own** account's credentials.
- `jq`, `curl`, and `openssl` on your `PATH`.

## Usage

```bash
./mirror-sl-layer.sh --tech <nodejs-cjs|nodejs-esm|python|java> --version <n> --region <region> [options]
```

| Flag | Required | Description |
|------|----------|-------------|
| `-t, --tech` | yes | One of `nodejs-cjs`, `nodejs-esm`, `python`, `java` |
| `-v, --version` | yes | The **SeaLights** layer version you want to mirror |
| `-r, --region` | yes | AWS region (e.g. `us-east-1`, `eu-west-1`) |
| `-n, --target-name` | no | Layer name to publish under in your account (defaults to the SeaLights layer name) |
| `-k, --keep` | no | Keep the downloaded layer zip instead of deleting it |
| `-h, --help` | no | Show usage help and exit |

Example — mirror version `6` of the Node.js (CJS) layer in `us-east-1`:

```bash
./mirror-sl-layer.sh --tech nodejs-cjs --version 6 --region us-east-1
```

On success it prints the new layer ARN in your account. That is the ARN you attach to your functions.

## Important: keep the source ARN in the layer description

The script **automatically records the original SeaLights source ARN in the description** of the layer it publishes into your account. We strongly urge you to keep it there.

Here's why it matters. AWS assigns layer version numbers **sequentially and independently per account** — the number simply counts how many times *that layer name* has been published *in that account*. It has no relationship to SeaLights' version numbering. So the version number you see in your account will almost never match the SeaLights version you actually mirrored.

For example, the very first layer you publish becomes version `1` in your account — even if it's a mirror of SeaLights version `6`.

That mismatch makes it impossible to tell which SeaLights layer version you're running just by looking at your own version number. The source ARN in the description is the one reliable record of exactly what you mirrored. Keeping it there means:

- You can see at a glance which SeaLights layer version each of your layer versions came from.
- If you ever open a support ticket, SeaLights can immediately identify the exact agent version you're running — which makes troubleshooting far faster.
