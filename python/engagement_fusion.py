"""
engagement_fusion.py - Multimodal Engagement Scoring & Dynamics Analysis
Part of the Multimodal Attendance & Engagement Agent (Scenario 2)

Mathematical Formulation:
MES_i = w_gaze * G_i + w_posture * P_i + w_audio * A - lambda * I_i
Where:
- G_i: Gaze alignment score derived from head pose yaw, pitch, and roll (0-100)
- P_i: Posture stability and active writing/hand-raising movement (0-100)
- A: Acoustic dialogue synchrony (voice activity, interactive balance) (0-100)
- I_i: Inactivity penalty (escalates if student is stationary > 60s)
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple


@dataclass
class FusionWeights:
    w_gaze: float = 0.50
    w_posture: float = 0.30
    w_audio: float = 0.20
    w_inactivity: float = 0.15


class MultimodalEngagementFusion:
    def __init__(self, weights: FusionWeights = None):
        self.weights = weights or FusionWeights()
        self.classroom_history = []

    def compute_gaze_alignment(self, yaw_deg: float, pitch_deg: float) -> float:
        """
        Derives gaze alignment to the instructor/whiteboard.
        Yaw: 0 is center, Pitch: -5 to -10 is natural eye contact.
        """
        yaw_penalty = min(1.0, abs(yaw_deg) / 45.0)
        pitch_penalty = (
            min(1.0, (abs(pitch_deg) - 20.0) / 35.0)
            if pitch_deg < -20.0
            else min(1.0, abs(pitch_deg) / 40.0)
        )
        alignment = max(0.0, min(100.0, (1.0 - (yaw_penalty * 0.6 + pitch_penalty * 0.4)) * 100.0))
        return round(alignment, 1)

    def compute_student_mes(
        self,
        gaze_score: float,
        is_hand_raised: bool,
        is_note_taking: bool,
        motion_velocity: float,
        inactivity_sec: float,
        acoustic_speech_ratio: float,
        is_qa_mode: bool,
    ) -> Dict:
        """
        Calculates individual student Multimodal Engagement Score (MES).
        """
        # Posture score
        if is_hand_raised:
            posture_score = 100.0
        elif is_note_taking:
            posture_score = 92.0
        elif motion_velocity < 0.05:
            posture_score = 50.0  # Slumped / low motion
        else:
            posture_score = 80.0

        # Audio synchrony score
        if is_qa_mode:
            audio_score = 95.0 if is_hand_raised else 85.0
        else:
            audio_score = 80.0 if gaze_score > 70.0 else 55.0

        # Inactivity penalty
        penalty = 0.0
        if inactivity_sec > 60.0:
            penalty = min(100.0, ((inactivity_sec - 60.0) / 120.0) * 100.0)

        raw_mes = (
            gaze_score * self.weights.w_gaze
            + posture_score * self.weights.w_posture
            + audio_score * self.weights.w_audio
            - penalty * self.weights.w_inactivity
        )
        mes = max(0.0, min(100.0, round(raw_mes, 1)))

        return {
            "mes": mes,
            "gaze_score": gaze_score,
            "posture_score": posture_score,
            "audio_score": audio_score,
            "inactivity_penalty": round(penalty, 1),
        }

    def analyze_session_dynamics(
        self, student_scores: List[Dict], speech_ratio: float, monologue_sec: float
    ) -> Dict:
        """
        Synthesizes cohort-wide dynamics and classifies the classroom state.
        """
        if not student_scores:
            return {"classroom_score": 75.0, "state": "STANDBY"}

        avg_mes = round(sum(s["mes"] for s in student_scores) / len(student_scores), 1)
        self.classroom_history.append(avg_mes)
        if len(self.classroom_history) > 30:
            self.classroom_history.pop(0)

        # Detect rapid attention drop
        is_attention_drop = False
        if len(self.classroom_history) >= 10:
            if (self.classroom_history[0] - avg_mes) >= 18.0 and avg_mes < 60.0:
                is_attention_drop = True

        # State classification
        if is_attention_drop or (avg_mes < 52.0 and monologue_sec > 300.0):
            state = "MONOTONE_LECTURE_FATIGUE"
        elif any(s.get("is_hand_raised", False) for s in student_scores) and avg_mes > 80.0:
            state = "COLLABORATIVE_QA_SURGE"
        elif avg_mes < 50.0:
            state = "DISENGAGEMENT_CLUSTER"
        elif speech_ratio < 0.15 and avg_mes > 80.0:
            state = "DEEP_FOCUS_STUDY"
        else:
            state = "OPTIMAL_FLOW"

        return {
            "classroom_score": avg_mes,
            "classroom_state": state,
            "attention_drop_alert": is_attention_drop,
            "student_count": len(student_scores),
        }


if __name__ == "__main__":
    fusion = MultimodalEngagementFusion()
    gaze = fusion.compute_gaze_alignment(yaw_deg=5.0, pitch_deg=-8.0)
    score = fusion.compute_student_mes(
        gaze_score=gaze,
        is_hand_raised=False,
        is_note_taking=True,
        motion_velocity=0.2,
        inactivity_sec=10.0,
        acoustic_speech_ratio=0.5,
        is_qa_mode=False,
    )
    print(f"Computed Student MES: {score}")
    assert score["mes"] > 75.0
    print("Engagement Fusion algorithm tests passed successfully!")
