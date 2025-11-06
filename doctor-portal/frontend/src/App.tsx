import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

export type MovementThreshold = {
  metric: string;
  comparator: ">=" | "<=" | "between";
  value: number;
  secondary_value?: number;
  unit: string;
  coaching_prompt: string;
};

export type ExerciseStep = {
  index: number;
  title: string;
  description: string;
  video_url?: string;
  avatar_style: string;
  thresholds: MovementThreshold[];
};

export type Exercise = {
  id: string;
  symptom: string;
  title: string;
  description: string;
  steps: ExerciseStep[];
};

const API = axios.create({ baseURL: "http://localhost:8000" });

function ThresholdEditor({
  thresholds,
  onChange,
}: {
  thresholds: MovementThreshold[];
  onChange: (next: MovementThreshold[]) => void;
}) {
  const updateThreshold = (index: number, patch: Partial<MovementThreshold>) => {
    const next = thresholds.map((th, idx) =>
      idx === index ? { ...th, ...patch } : th
    );
    onChange(next);
  };

  return (
    <div className="threshold-editor">
      <h4>Performance thresholds</h4>
      {thresholds.map((threshold, index) => (
        <div className="threshold" key={index}>
          <input
            value={threshold.metric}
            placeholder="Metric (neck_rotation)"
            onChange={(event) =>
              updateThreshold(index, { metric: event.target.value })
            }
          />
          <select
            value={threshold.comparator}
            onChange={(event) =>
              updateThreshold(index, {
                comparator: event.target.value as MovementThreshold["comparator"],
              })
            }
          >
            <option value=">=">≥</option>
            <option value="<=">≤</option>
            <option value="between">범위</option>
          </select>
          <input
            type="number"
            value={threshold.value}
            placeholder="Target value"
            onChange={(event) =>
              updateThreshold(index, { value: parseFloat(event.target.value) })
            }
          />
          {threshold.comparator === "between" && (
            <input
              type="number"
              value={threshold.secondary_value ?? ""}
              placeholder="Upper bound"
              onChange={(event) =>
                updateThreshold(index, {
                  secondary_value: parseFloat(event.target.value),
                })
              }
            />
          )}
          <input
            value={threshold.unit}
            placeholder="단위 (도, 회 등)"
            onChange={(event) => updateThreshold(index, { unit: event.target.value })}
          />
          <input
            value={threshold.coaching_prompt}
            placeholder="코칭 안내 문구"
            onChange={(event) =>
              updateThreshold(index, { coaching_prompt: event.target.value })
            }
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...thresholds,
            {
              metric: "neck_rotation",
              comparator: ">=",
              value: 60,
              unit: "도",
              coaching_prompt: "얼굴을 왼쪽으로 더 돌려주세요.",
            },
          ])
        }
      >
        + Threshold
      </button>
    </div>
  );
}

function ExerciseForm({ onCreated }: { onCreated: () => void }) {
  const [exercise, setExercise] = useState<Exercise>({
    id: "",
    title: "",
    description: "",
    symptom: "jaw_pain",
    steps: [
      {
        index: 0,
        title: "자세 정렬",
        description: "의사의 안내에 따라 준비 자세를 취합니다.",
        avatar_style: "real",
        thresholds: [],
      },
    ],
  });

  const updateStep = (index: number, patch: Partial<ExerciseStep>) => {
    const steps = exercise.steps.map((step, idx) =>
      idx === index ? { ...step, ...patch } : step
    );
    setExercise({ ...exercise, steps });
  };

  const addStep = () => {
    const nextIndex = exercise.steps.length;
    setExercise({
      ...exercise,
      steps: [
        ...exercise.steps,
        {
          index: nextIndex,
          title: "새 단계",
          description: "단계 설명",
          avatar_style: "avatar:male-30s",
          thresholds: [],
        },
      ],
    });
  };

  const submit = async () => {
    await API.post("/exercises", exercise);
    onCreated();
    setExercise({
      ...exercise,
      id: "",
      title: "",
      description: "",
      steps: exercise.steps.map((step, index) => ({ ...step, index })),
    });
  };

  return (
    <div className="exercise-form">
      <h3>새 처치행동 등록</h3>
      <input
        value={exercise.id}
        placeholder="Exercise ID"
        onChange={(event) => setExercise({ ...exercise, id: event.target.value })}
      />
      <input
        value={exercise.title}
        placeholder="Title"
        onChange={(event) =>
          setExercise({ ...exercise, title: event.target.value })
        }
      />
      <textarea
        value={exercise.description}
        placeholder="설명"
        onChange={(event) =>
          setExercise({ ...exercise, description: event.target.value })
        }
      />
      {exercise.steps.map((step, index) => (
        <div key={index} className="step-card">
          <h4>Step {index + 1}</h4>
          <input
            value={step.title}
            placeholder="Step title"
            onChange={(event) => updateStep(index, { title: event.target.value })}
          />
          <textarea
            value={step.description}
            placeholder="Step description"
            onChange={(event) =>
              updateStep(index, { description: event.target.value })
            }
          />
          <input
            value={step.video_url ?? ""}
            placeholder="Video URL"
            onChange={(event) => updateStep(index, { video_url: event.target.value })}
          />
          <select
            value={step.avatar_style}
            onChange={(event) => updateStep(index, { avatar_style: event.target.value })}
          >
            <option value="real">의사 영상</option>
            <option value="avatar:male-30s">남성 30대 아바타</option>
            <option value="avatar:female-20s">여성 20대 아바타</option>
          </select>
          <ThresholdEditor
            thresholds={step.thresholds}
            onChange={(next) => updateStep(index, { thresholds: next })}
          />
        </div>
      ))}
      <button type="button" onClick={addStep}>
        단계 추가
      </button>
      <button type="button" onClick={submit}>
        저장
      </button>
    </div>
  );
}

function ExerciseTable({ exercises }: { exercises: Exercise[] }) {
  return (
    <table className="exercise-table">
      <thead>
        <tr>
          <th>증상</th>
          <th>제목</th>
          <th>단계 수</th>
        </tr>
      </thead>
      <tbody>
        {exercises.map((exercise) => (
          <tr key={exercise.id}>
            <td>{exercise.symptom}</td>
            <td>{exercise.title}</td>
            <td>{exercise.steps.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PatientProgress({ nationalId }: { nationalId: string }) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!nationalId) return;
    API.get(`/patients/${nationalId}/progress`).then((response) =>
      setEvents(response.data)
    );
  }, [nationalId]);

  const summaries = useMemo(() => {
    const grouped: Record<string, { success: number; total: number }> = {};
    events.forEach((event) => {
      const stats = (grouped[event.exercise_id] ||= { success: 0, total: 0 });
      stats.total += 1;
      if (event.success) stats.success += 1;
    });
    return grouped;
  }, [events]);

  return (
    <div className="patient-progress">
      <h3>처치 경과</h3>
      <ul>
        {Object.entries(summaries).map(([exerciseId, stats]) => (
          <li key={exerciseId}>
            {exerciseId}: {stats.success}/{stats.total} 회 성공
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [nationalId, setNationalId] = useState("");

  const loadExercises = () => {
    API.get("/exercises").then((response) => setExercises(response.data));
  };

  useEffect(() => {
    loadExercises();
  }, []);

  return (
    <div className="app">
      <h1>TMJ 처치행동 관리</h1>
      <ExerciseForm onCreated={loadExercises} />
      <ExerciseTable exercises={exercises} />

      <section className="patient-section">
        <h2>환자 경과 모니터링</h2>
        <input
          value={nationalId}
          placeholder="주민등록번호"
          onChange={(event) => setNationalId(event.target.value)}
        />
        {nationalId && <PatientProgress nationalId={nationalId} />}
      </section>
    </div>
  );
}
