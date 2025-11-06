"""FastAPI backend for TMJ digital therapeutics clinician portal."""
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="TMJ Clinician Portal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MovementThreshold(BaseModel):
    """Clinician-defined target for a body metric."""

    metric: str = Field(..., description="Name of the metric, e.g., neck_rotation")
    comparator: str = Field(
        ">=",
        description="Comparison operator (>=, <=, between). Between expects `value` and `secondary_value`.",
    )
    value: float = Field(..., description="Primary threshold value.")
    secondary_value: Optional[float] = Field(
        None, description="Optional upper bound for 'between' comparator."
    )
    unit: str = Field(..., description="Unit for display, e.g., degrees or repetitions.")
    coaching_prompt: str = Field(
        ..., description="Plain-language explanation of how to meet the threshold."
    )


class MetricObservation(BaseModel):
    """AI-measured result compared to a threshold."""

    threshold: MovementThreshold
    actual_value: float


class ExerciseStep(BaseModel):
    index: int
    title: str
    description: str
    video_url: Optional[str]
    avatar_style: str = Field(
        "real",
        description="Video rendering style: 'real' for clinician footage or 'avatar:<id>' for generated.",
    )
    thresholds: List[MovementThreshold] = []


class Exercise(BaseModel):
    id: str
    symptom: str
    title: str
    description: str
    steps: List[ExerciseStep]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Patient(BaseModel):
    national_id: str
    name: str
    birthdate: datetime
    active_prescriptions: List[str] = []  # exercise ids


class Prescription(BaseModel):
    id: str
    patient_id: str
    exercise_id: str
    repetitions: int
    frequency_per_day: int
    notes: Optional[str] = None
    issued_at: datetime = Field(default_factory=datetime.utcnow)


class ProgressEvent(BaseModel):
    timestamp: datetime
    exercise_id: str
    repetition_index: int
    success: bool
    metrics: List[MetricObservation]
    deviation_report: Optional[str] = None


# --- In-memory storage for prototype ---
EXERCISES: dict[str, Exercise] = {}
PATIENTS: dict[str, Patient] = {}
PRESCRIPTIONS: dict[str, Prescription] = {}
PROGRESS: dict[str, List[ProgressEvent]] = {}


@app.post("/exercises", response_model=Exercise)
def create_exercise(exercise: Exercise) -> Exercise:
    if exercise.id in EXERCISES:
        raise HTTPException(status_code=400, detail="Exercise already exists")
    EXERCISES[exercise.id] = exercise
    return exercise


@app.get("/exercises", response_model=List[Exercise])
def list_exercises(symptom: Optional[str] = None) -> List[Exercise]:
    exercises = list(EXERCISES.values())
    if symptom:
        exercises = [ex for ex in exercises if ex.symptom == symptom]
    return exercises


@app.get("/exercises/{exercise_id}", response_model=Exercise)
def get_exercise(exercise_id: str) -> Exercise:
    try:
        return EXERCISES[exercise_id]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Exercise not found") from exc


@app.put("/exercises/{exercise_id}", response_model=Exercise)
def update_exercise(exercise_id: str, payload: Exercise) -> Exercise:
    if exercise_id not in EXERCISES:
        raise HTTPException(status_code=404, detail="Exercise not found")
    EXERCISES[exercise_id] = payload
    return payload


@app.delete("/exercises/{exercise_id}")
def delete_exercise(exercise_id: str) -> None:
    if exercise_id not in EXERCISES:
        raise HTTPException(status_code=404, detail="Exercise not found")
    del EXERCISES[exercise_id]


@app.post("/patients", response_model=Patient)
def create_patient(patient: Patient) -> Patient:
    if patient.national_id in PATIENTS:
        raise HTTPException(status_code=400, detail="Patient already exists")
    PATIENTS[patient.national_id] = patient
    return patient


@app.get("/patients/{national_id}", response_model=Patient)
def get_patient(national_id: str) -> Patient:
    try:
        return PATIENTS[national_id]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Patient not found") from exc


@app.post("/prescriptions", response_model=Prescription)
def prescribe(prescription: Prescription) -> Prescription:
    if prescription.id in PRESCRIPTIONS:
        raise HTTPException(status_code=400, detail="Prescription already exists")
    if prescription.exercise_id not in EXERCISES:
        raise HTTPException(status_code=404, detail="Exercise not found")
    if prescription.patient_id not in PATIENTS:
        raise HTTPException(status_code=404, detail="Patient not found")

    PRESCRIPTIONS[prescription.id] = prescription
    patient = PATIENTS[prescription.patient_id]
    patient.active_prescriptions.append(prescription.exercise_id)
    return prescription


@app.get("/patients/{national_id}/progress", response_model=List[ProgressEvent])
def get_patient_progress(national_id: str) -> List[ProgressEvent]:
    if national_id not in PATIENTS:
        raise HTTPException(status_code=404, detail="Patient not found")
    return PROGRESS.get(national_id, [])


@app.post("/patients/{national_id}/progress", response_model=ProgressEvent)
def add_progress(national_id: str, event: ProgressEvent) -> ProgressEvent:
    if national_id not in PATIENTS:
        raise HTTPException(status_code=404, detail="Patient not found")
    PROGRESS.setdefault(national_id, []).append(event)
    return event


@app.post("/ai/coach")
def generate_coaching(event: ProgressEvent) -> dict:
    """Prototype: build feedback string when thresholds are not met."""

    feedback = []
    for observation in event.metrics:
        threshold = observation.threshold
        actual = observation.actual_value
        meets = True
        if threshold.comparator == ">=":
            meets = actual >= threshold.value
        elif threshold.comparator == "<=":
            meets = actual <= threshold.value
        elif threshold.comparator == "between" and threshold.secondary_value is not None:
            meets = threshold.value <= actual <= threshold.secondary_value

        if not meets:
            gap = threshold.value - actual if threshold.comparator == ">=" else 0
            feedback.append(
                {
                    "metric": threshold.metric,
                    "message": (
                        f"{threshold.coaching_prompt} 현재 {actual:.1f}{threshold.unit}."
                        + (f" 목표까지 {gap:.1f}{threshold.unit} 남았습니다." if gap > 0 else "")
                    ),
                }
            )

    return {"feedback": feedback}


