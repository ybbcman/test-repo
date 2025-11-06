# TMJ Clinician Portal Prototype

This prototype demonstrates how clinicians can manage treatment exercises, define
per-step biomechanical thresholds, and monitor patient progress.

## Key Concepts
- **Exercises** contain ordered steps. Each step references an instructional video
  (recorded clinician or AI avatar) and a set of **MovementThresholds** that encode
  measurable criteria (e.g., cervical rotation ≥ 60°).
- **Prescriptions** bind a registered patient to an exercise, defining how many
  repetitions per day to complete.
- **Progress events** represent AI-evaluated sessions from the patient app,
  including measured values that are compared against thresholds.

## Backend
- Implemented with FastAPI (`backend/main.py`).
- Stores exercises, patients, and prescriptions in-memory for clarity.
- `/ai/coach` endpoint showcases how measurement deviations can be transformed
  into actionable feedback for the patient. In production this would forward
  pose-estimation metrics into a language model prompt template.

Run locally:

```bash
pip install fastapi uvicorn[standard]
uvicorn main:app --reload --port 8000
```

## Frontend
- React SPA (`frontend/src/App.tsx`) calling the FastAPI endpoints.
- Provides form controls to define video source (real vs avatar id) and threshold
  criteria. The threshold editor guides clinicians to express the coaching prompt
  patients will hear when they fall short of the metric.

Run locally:

```bash
cd frontend
npm install
npm run dev
```

Use an HTTP proxy (e.g., Vite dev server) and configure CORS in FastAPI accordingly.
