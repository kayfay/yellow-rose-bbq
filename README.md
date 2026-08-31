# Yellow Rose BBQ - Sausage & BBQ Prep Command Center

A mobile-first, high-contrast, kitchen-line-optimized productivity tool, recipe calculator, and production forecasting platform for Yellow Rose BBQ.

## Features

- **Production Forecasting Engine**: Automated data pipeline that fetches Clover POS transactions nightly, generates baseline SARIMA forecasts for raw meat requirements, and adjusts for weather and local events (Jaguars games, etc.).
- **Dynamic Ratio Scaling**: Drag the slider or use the helper tap buttons to scale sausage recipes dynamically.
- **Guided Insights**: Generates actionable procurement and staffing insights for upcoming peak sales periods.
- **Day-split Workflow Checklist**: Day 1 and Day 2 checklists with striking success states (green highlighting) and large tap targets.
- **GitHub Actions Pipeline**: Nightly 3 AM cron jobs ingest raw data, process analytics via Polars and Scikit-learn, and deploy static JSON payloads directly to GitHub Pages.

## Architecture & Data Pipeline

The platform uses a fully static frontend hosted on GitHub Pages. The "backend" consists of Python scripts executed via GitHub Actions daily at 3:00 AM EST. 

1. **Ingestion (`clover_api/ingest.py`)**: Pulls the latest transaction data from the Clover POS API.
2. **Feature Engineering**: Retrieves weather forecasts and event schedules.
3. **Forecasting (`arima_baseline.py`)**: Produces raw meat target yields based on historical sales trends.
4. **Dashboard Generation**: Compiles the data into optimized JSON payloads, committed back to the repository for the frontend to consume.

## Setup & Deployment

1. Set up GitHub Actions secrets: `CLOVER_MERCHANT_ID` and `CLOVER_API_KEY`.
2. Enable GitHub Pages pointing to the `main` branch root.
3. The dashboard and charts (D3/Plotly) will auto-update nightly.
