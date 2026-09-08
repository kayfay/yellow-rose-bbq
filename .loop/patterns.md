# Loop Patterns
- Ensure GitHub Actions workflows use `${{ secrets.VAR_NAME }}` properly mapped to `env`.
- Ensure python scripts parse environment variables gracefully with `os.getenv()` rather than failing with raw HTTP errors upon `401 Unauthorized`.
