# Action: `action-coolify-deployment`

This GitHub Action triggers one or more deployments to Coolify based on `tag` and `uuid`. It waits until the deployment(s) reach the `finished` status.

## Inputs

- `coolify-url` (optional): The Coolify API URL. Default is `https://app.coolify.io`.
- `api-key` (required): The Coolify API key.
- `wait` (optional): Seconds to wait for the deployment to finish. Default is `600`.
- `tag` (optional): Tag name(s). Comma-separated list is also accepted.
- `uuid` (optional): Resource UUID(s). Comma-separated list is also accepted.
- `force` (optional): Force rebuild (without cache). Default is `false`.

## Outputs

This action does not produce any outputs.

## Example Usage

```yaml
name: Deploy to Coolify

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Deploy to Coolify
        uses: ./
        with:
          coolify-url: ${{ secrets.COOLIFY_URL }}
          api-key: ${{ secrets.COOLIFY_API_KEY }}
          wait: 600
          tag: "app"
```
