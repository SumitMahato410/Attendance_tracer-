"""
attendance_tracker.py - Automated Sustained Presence Attendance Tracking Engine
Part of the Multimodal Attendance & Engagement Agent (Scenario 1)

Implements:
- Temporal sliding window presence validation
- Suppression of false positives caused by momentary walk-ins or passersby
- Timestamped audit logs with sustained duration and presence ratio
- Late entry and early departure classification
"""

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple


@dataclass
class ParticipantPresenceState:
    student_id: str
    name: str
    first_detected_sec: float
    last_detected_sec: float
    detection_window: deque = field(default_factory=deque)
    sustained_seconds: float = 0.0
    status: str = "EVALUATING"
    is_transitory: bool = False
    average_engagement: float = 0.0


class SustainedPresenceTracker:
    """
    Evaluates participant presence over temporal windows to mark robust attendance
    without brittle single-frame false alarms.
    """

    def __init__(
        self,
        window_seconds: float = 45.0,
        presence_ratio_threshold: float = 0.65,
        min_sustained_seconds: float = 20.0,
        late_cutoff_seconds: float = 60.0,
    ):
        self.window_seconds = window_seconds
        self.presence_threshold = presence_ratio_threshold
        self.min_sustained_seconds = min_sustained_seconds
        self.late_cutoff_seconds = late_cutoff_seconds
        self.roster: Dict[str, ParticipantPresenceState] = {}

    def update_frame(
        self,
        detected_candidates: List[Dict],
        current_session_time_sec: float,
        dt_sec: float = 1.0,
    ) -> List[Dict]:
        """
        Process a time step with detected student tracks.
        """
        active_ids = {cand["id"] for cand in detected_candidates}

        # Update detected participants
        for cand in detected_candidates:
            cid = cand["id"]
            name = cand.get("name", f"Student-{cid}")
            is_transitory = cand.get("is_transitory", False)

            if cid not in self.roster:
                self.roster[cid] = ParticipantPresenceState(
                    student_id=cid,
                    name=name,
                    first_detected_sec=current_session_time_sec,
                    last_detected_sec=current_session_time_sec,
                    detection_window=deque(),
                    is_transitory=is_transitory,
                )

            entry = self.roster[cid]
            entry.last_detected_sec = current_session_time_sec
            entry.sustained_seconds += dt_sec
            entry.detection_window.append((current_session_time_sec, 1))

        # Handle absent candidates in current window
        cutoff_time = current_session_time_sec - self.window_seconds
        results = []

        for cid, entry in self.roster.items():
            if cid not in active_ids:
                entry.detection_window.append((current_session_time_sec, 0))

            # Evict samples older than window
            while entry.detection_window and entry.detection_window[0][0] < cutoff_time:
                entry.detection_window.popleft()

            # Compute window presence ratio
            window_len = len(entry.detection_window)
            if window_len > 0:
                present_frames = sum(val for _, val in entry.detection_window)
                presence_ratio = present_frames / window_len
            else:
                presence_ratio = 0.0

            time_absent = current_session_time_sec - entry.last_detected_sec

            # Determine official status
            if entry.is_transitory or (
                entry.sustained_seconds < self.min_sustained_seconds
                and presence_ratio < self.presence_threshold
            ):
                if time_absent > 10.0:
                    entry.status = "FILTERED_TRANSITORY_WALKIN"
                else:
                    entry.status = "VERIFYING_PRESENCE"
            elif (
                entry.sustained_seconds >= self.min_sustained_seconds
                and presence_ratio >= (self.presence_threshold * 0.8)
            ):
                if time_absent > 90.0:
                    entry.status = "TEMPORARY_ABSENCE"
                elif entry.first_detected_sec > self.late_cutoff_seconds:
                    entry.status = "PRESENT_LATE_ARRIVAL"
                else:
                    entry.status = "PRESENT_SUSTAINED"
            elif time_absent > 120.0 and entry.sustained_seconds >= self.min_sustained_seconds:
                entry.status = "EARLY_DEPARTURE"

            results.append(
                {
                    "student_id": entry.student_id,
                    "name": entry.name,
                    "status": entry.status,
                    "sustained_seconds": round(entry.sustained_seconds, 1),
                    "presence_ratio_pct": round(presence_ratio * 100, 1),
                    "first_seen_sec": round(entry.first_detected_sec, 1),
                    "last_seen_sec": round(entry.last_detected_sec, 1),
                }
            )

        return results


if __name__ == "__main__":
    print("Testing SustainedPresenceTracker...")
    tracker = SustainedPresenceTracker(
        window_seconds=10.0,
        presence_ratio_threshold=0.6,
        min_sustained_seconds=5.0,
    )

    # 1. Simulate Student A (sustained attendee)
    for t in range(8):
        res = tracker.update_frame([{"id": "STU_001", "name": "Alice"}], current_session_time_sec=float(t))
    alice_status = [r for r in res if r["student_id"] == "STU_001"][0]
    print(f"Alice (t=8): {alice_status['status']} (sustained: {alice_status['sustained_seconds']}s)")
    assert "PRESENT" in alice_status["status"]

    # 2. Simulate Transitory Visitor (appears for only 2 seconds)
    for t in range(8, 10):
        res = tracker.update_frame(
            [{"id": "STU_001", "name": "Alice"}, {"id": "VIS_999", "name": "Hallway Visitor", "is_transitory": True}],
            current_session_time_sec=float(t),
        )
    # Visitor leaves for next 15 seconds
    for t in range(10, 25):
        res = tracker.update_frame([{"id": "STU_001", "name": "Alice"}], current_session_time_sec=float(t))
    visitor_status = [r for r in res if r["student_id"] == "VIS_999"][0]
    print(f"Visitor (t=25): {visitor_status['status']} (sustained: {visitor_status['sustained_seconds']}s)")
    assert "FILTERED" in visitor_status["status"]
    print("Sustained Presence Tracking algorithm tests passed successfully!")
