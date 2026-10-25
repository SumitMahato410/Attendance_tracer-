"""
run_offline_batch.py - Offline Batch Classroom Analysis CLI Runner
Part of the Multimodal Attendance & Engagement Agent

Runs an end-to-end simulated classroom session offline,
evaluating sustained presence attendance, multimodal engagement scoring,
and AI-driven teaching suggestions.
"""

import csv
import json
import os
import sys
from datetime import datetime

# Local module imports
from attendance_tracker import SustainedPresenceTracker
from engagement_fusion import MultimodalEngagementFusion
from privacy_guard import PrivacyGuard
from teaching_advisor import PedagogicalAdvisorAgent


def run_batch_simulation(duration_seconds: int = 120, output_dir: str = "../sample_data"):
    print("\n" + "=" * 60)
    print(" MULTIMODAL ATTENDANCE & ENGAGEMENT AGENT - OFFLINE BATCH RUNNER")
    print(" 100% Privacy-Preserving On-Device Simulation")
    print("=" * 60)

    tracker = SustainedPresenceTracker(
        window_seconds=30.0,
        presence_ratio_threshold=0.65,
        min_sustained_seconds=15.0,
        late_cutoff_seconds=35.0,
    )
    fusion = MultimodalEngagementFusion()
    advisor = PedagogicalAdvisorAgent(cooldown_seconds=25.0)
    guard = PrivacyGuard()

    # Pre-registered classroom roster
    students = [
        {"id": "STU-101", "name": "Aarav Sharma", "active_from": 0, "active_to": 120, "is_transitory": False},
        {"id": "STU-102", "name": "Maya Chen", "active_from": 0, "active_to": 120, "is_transitory": False},
        {"id": "STU-103", "name": "Liam Davis", "active_from": 0, "active_to": 120, "is_transitory": False},
        {"id": "STU-104", "name": "Sophia Patel", "active_from": 0, "active_to": 120, "is_transitory": False},
        {"id": "STU-105", "name": "Noah Wilson (Late)", "active_from": 40, "active_to": 120, "is_transitory": False},
        {"id": "VIS-999", "name": "Hallway Visitor", "active_from": 15, "active_to": 22, "is_transitory": True},
    ]

    print(f"\nSimulating {duration_seconds} seconds of continuous classroom activity...")

    session_log = []
    latest_roster = []

    for t in range(duration_seconds):
        # 1. Determine active participants at second t
        active_candidates = []
        for s in students:
            if s["active_from"] <= t <= s["active_to"]:
                active_candidates.append(s)

        # 2. Update Sustained Presence Attendance
        roster_update = tracker.update_frame(active_candidates, current_session_time_sec=float(t))
        latest_roster = roster_update

        # 3. Simulate multimodal cues
        student_scores = []
        speech_ratio = 0.85 if 20 <= t <= 55 else 0.45  # Monologue between 20s and 55s
        monologue_duration = float(t - 20) if 20 <= t <= 55 else 0.0

        for cand in active_candidates:
            if cand.get("is_transitory"):
                continue

            # Liam drifts into phone distraction between t=30 and t=70
            if cand["id"] == "STU-103" and 30 <= t <= 70:
                gaze = 32.0
                inactivity = float(t - 30)
                hand_raised = False
                note_taking = False
            elif cand["id"] == "STU-102" and 75 <= t <= 90:
                # Maya raises hand during Q&A
                gaze = 95.0
                inactivity = 0.0
                hand_raised = True
                note_taking = False
            else:
                gaze = 85.0
                inactivity = 0.0
                hand_raised = False
                note_taking = True

            score_data = fusion.compute_student_mes(
                gaze_score=gaze,
                is_hand_raised=hand_raised,
                is_note_taking=note_taking,
                motion_velocity=0.2,
                inactivity_sec=inactivity,
                acoustic_speech_ratio=speech_ratio,
                is_qa_mode=(75 <= t <= 95),
            )
            score_data["student_id"] = cand["id"]
            student_scores.append(score_data)

        # 4. Session Dynamics Analysis
        dynamics = fusion.analyze_session_dynamics(student_scores, speech_ratio, monologue_duration)

        # 5. Pedagogical Advisor Reasoning
        suggestion = advisor.evaluate_telemetry(
            session_elapsed_sec=float(t),
            classroom_score=dynamics["classroom_score"],
            classroom_state=dynamics["classroom_state"],
            speech_ratio=speech_ratio,
            monologue_sec=monologue_duration,
            student_scores=student_scores,
        )

        if suggestion:
            print(f"  [T={t:02d}s] [AI ADVISOR PROMPT] ({suggestion.badge}): {suggestion.title}")
            print(f"             Action: {suggestion.action[:80]}...")

        session_log.append({
            "second": t,
            "classroom_score": dynamics["classroom_score"],
            "state": dynamics["classroom_state"],
            "active_students": len(student_scores),
        })

    # Export Attendance to CSV
    os.makedirs(output_dir, exist_ok=True)
    csv_path = os.path.join(output_dir, "batch_attendance_log.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["StudentID", "Name", "Status", "SustainedSeconds", "PresenceRatioPct", "FirstSeen", "LastSeen"])
        for r in latest_roster:
            writer.writerow([
                r["student_id"],
                r["name"],
                r["status"],
                r["sustained_seconds"],
                f"{r['presence_ratio_pct']}%",
                f"{r['first_seen_sec']}s",
                f"{r['last_seen_sec']}s",
            ])

    print("\n" + "=" * 60)
    print(" BATCH EXECUTION RESULTS & SUSTAINED PRESENCE VERIFICATION")
    print("=" * 60)
    for r in latest_roster:
        status_tag = f"[{r['status']}]"
        print(f"  • {r['student_id']} ({r['name']}): {status_tag} (Sustained: {r['sustained_seconds']}s, Ratio: {r['presence_ratio_pct']}%)")

    print(f"\nGenerated Attendance CSV: {csv_path}")
    print(f"AI Teaching Suggestions Emitted: {len(advisor.history)}")
    print("Batch simulation finished successfully.\n")


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sample_dir = os.path.join(current_dir, "..", "sample_data")
    run_batch_simulation(duration_seconds=100, output_dir=sample_dir)
