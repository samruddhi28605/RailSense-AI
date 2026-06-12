"""
Response Agent
──────────────
Receives anomaly report, generates response actions for:
  - Driver (speed advisory or emergency stop)
  - Station Master (alert message)
  - Maintenance Crew (work order)
"""


class ResponseAgent:

    def respond(self, report: dict) -> dict:
        severity = report.get("severity", "LOW")
        issue    = report.get("issue", "Unknown anomaly")
        location = report.get("location", "Unknown location")
        action   = report.get("action", "Monitor closely")

        if severity == "CRITICAL":
            return {
                "alert":        f"🔴 CRITICAL: {issue} at {location}",
                "driver_action": "APPLY EMERGENCY BRAKES — stop immediately",
                "maintenance":   "Dispatch emergency crew NOW — do not delay",
                "station_master": f"CRITICAL anomaly at {location}. Train stopped. Await crew report.",
                "speed_limit":   0
            }
        elif severity == "HIGH":
            return {
                "alert":        f"🟠 HIGH: {issue} at {location}",
                "driver_action": "Reduce speed to 30 km/h immediately",
                "maintenance":   "Dispatch crew within 15 minutes",
                "station_master": f"HIGH alert at {location}. Speed restricted to 30 km/h.",
                "speed_limit":   30
            }
        elif severity == "MEDIUM":
            return {
                "alert":        f"🟡 MEDIUM: {issue} at {location}",
                "driver_action": "Reduce speed to 60 km/h and monitor",
                "maintenance":   "Schedule inspection within 2 hours",
                "station_master": f"MEDIUM alert at {location}. Speed restricted to 60 km/h.",
                "speed_limit":   60
            }
        else:
            return {
                "alert":        f"🟢 LOW: {issue} at {location}",
                "driver_action": "Continue at normal speed, log observation",
                "maintenance":   "Schedule routine inspection",
                "station_master": f"LOW priority note: {issue} at {location}.",
                "speed_limit":   None
            }

    def format_response_actions(self, response: dict) -> list[str]:
        """Returns list of action strings for the dashboard AI Response Panel."""
        actions = []
        if response.get("driver_action"):
            actions.append(response["driver_action"])
        if response.get("maintenance"):
            actions.append(response["maintenance"])
        if response.get("station_master"):
            actions.append(response["station_master"])
        return actions
