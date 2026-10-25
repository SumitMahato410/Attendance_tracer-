"""
teaching_advisor.py - AI-Driven Pedagogical Decision-Support Agent
Part of the Multimodal Attendance & Engagement Agent (Scenario 3)

Operates as a non-intrusive decision-support tool providing:
- Real-time instructional pacing adjustments
- Active learning intervention recommendations (Think-Pair-Share, Concept Checks)
- Individual student support cues for disengagement clusters
- Offline LLM prompt synthesis for local model inference (e.g., Ollama/Llama 3)
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class TeachingSuggestion:
    suggestion_id: str
    timestamp: str
    category: str  # PACING, INTERVENTION, ENERGY_BOOST, INDIVIDUAL_SUPPORT
    urgency: str  # high, medium, low
    badge: str
    title: str
    rationale: str
    action: str


class PedagogicalAdvisorAgent:
    """
    Evaluates multimodal classroom telemetry and formulates assistive pedagogical recommendations.
    Does not enforce decisions; acts as an assistive cockpit tool for educators.
    """

    def __init__(self, cooldown_seconds: float = 30.0):
        self.cooldown_seconds = cooldown_seconds
        self.last_trigger_time = 0.0
        self.history: List[TeachingSuggestion] = []

    def evaluate_telemetry(
        self,
        session_elapsed_sec: float,
        classroom_score: float,
        classroom_state: str,
        speech_ratio: float,
        monologue_sec: float,
        student_scores: List[Dict],
    ) -> Optional[TeachingSuggestion]:
        # Enforce rate-limiting cooldown
        if (session_elapsed_sec - self.last_trigger_time) < self.cooldown_seconds:
            return None

        suggestion = None
        now_str = datetime.now().strftime("%H:%M:%S")

        # RULE 1: Extended Teacher Monologue & Attention Softening
        if monologue_sec > 420.0 and classroom_score < 60.0:  # > 7 minutes
            suggestion = TeachingSuggestion(
                suggestion_id=f"sug_{int(session_elapsed_sec)}",
                timestamp=now_str,
                category="PACING",
                urgency="high",
                badge="Monologue Fatigue",
                title="Pacing Alert: Extended Lecture Monologue (>7m)",
                rationale=(
                    f"Instructor continuous talk ratio is {int(speech_ratio * 100)}% with prolonged monologue. "
                    f"Average attention index has softened to {classroom_score}%."
                ),
                action=(
                    "Pause lecture delivery and prompt students with a 60-second 'Think-Pair-Share' "
                    "or conduct a rapid hands-up concept check."
                ),
            )

        # RULE 2: Rapid Attention Drop
        elif classroom_state == "MONOTONE_LECTURE_FATIGUE" or classroom_score < 48.0:
            suggestion = TeachingSuggestion(
                suggestion_id=f"sug_{int(session_elapsed_sec)}",
                timestamp=now_str,
                category="INTERVENTION",
                urgency="high",
                badge="Attention Drop",
                title="Rapid Attention Drop Detected",
                rationale=(
                    f"Classroom Attention Index dropped sharply to {classroom_score}%. "
                    "Multiple students exhibit downward gaze away from instructional focus."
                ),
                action=(
                    "Re-anchor classroom focus: shift vocal tone, step away from the podium towards "
                    "the student desks, or ask a student to explain the last concept in their own words."
                ),
            )

        # RULE 3: Collaborative Q&A Surge Momentum
        elif classroom_state == "COLLABORATIVE_QA_SURGE":
            suggestion = TeachingSuggestion(
                suggestion_id=f"sug_{int(session_elapsed_sec)}",
                timestamp=now_str,
                category="POSITIVE_MOMENTUM",
                urgency="low",
                badge="High Engagement",
                title="High Interaction Momentum",
                rationale=(
                    f"Classroom engagement peaked at {classroom_score}% with active hand-raising and vocal participation."
                ),
                action=(
                    "Great participatory momentum. Open the floor to student-led debate rather than "
                    "answering directly to consolidate peer learning."
                ),
            )

        # RULE 4: Localized Disengagement Cluster
        else:
            low_engaged = [s for s in student_scores if s.get("mes", 100) < 45]
            if len(low_engaged) >= 2:
                names = ", ".join(s.get("student_id", "Unknown") for s in low_engaged)
                suggestion = TeachingSuggestion(
                    suggestion_id=f"sug_{int(session_elapsed_sec)}",
                    timestamp=now_str,
                    category="INDIVIDUAL_SUPPORT",
                    urgency="medium",
                    badge="Cluster Drift",
                    title="Localized Seating Drift Detected",
                    rationale=f"Students ({names}) display prolonged downward gaze or minimal note-taking motion.",
                    action="Apply proximity teaching by moving toward their section or directing the next example to that area.",
                )

        if suggestion:
            self.last_trigger_time = session_elapsed_sec
            self.history.append(suggestion)

        return suggestion

    def generate_offline_llm_prompt(self, telemetry_summary: Dict) -> str:
        """
        Synthesizes a standardized pedagogical prompt suitable for offline local LLMs (e.g. Ollama).
        """
        return f"""<|system|>
You are an expert pedagogical assistant advising a live classroom educator. Analyze the real-time multimodal telemetry below and formulate a concise, actionable, non-punitive teaching suggestion.

Classroom Telemetry:
- Elapsed Session Time: {telemetry_summary.get('elapsed_time_min', 0)} minutes
- Classroom Attention Index: {telemetry_summary.get('attention_index', 0)}%
- Acoustic Dialogue State: {telemetry_summary.get('dialogue_state', 'Unknown')}
- Teacher Speech Ratio: {telemetry_summary.get('speech_ratio', 0)}%
- High-risk Student Count: {telemetry_summary.get('disengaged_students', 0)}

Respond in 2 sentences:
1. Concise Diagnostic Observation
2. Specific Actionable Instructional Move
<|assistant|>"""


if __name__ == "__main__":
    advisor = PedagogicalAdvisorAgent(cooldown_seconds=10.0)
    sug = advisor.evaluate_telemetry(
        session_elapsed_sec=450.0,
        classroom_score=52.0,
        classroom_state="MONOTONE_LECTURE_FATIGUE",
        speech_ratio=0.88,
        monologue_sec=460.0,
        student_scores=[{"student_id": "STU_103", "mes": 40.0}],
    )
    print("Generated Suggestion:", sug)
    assert sug is not None
    assert sug.category == "PACING"
    print("Teaching Advisor tests passed successfully!")
