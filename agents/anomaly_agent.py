"""
Anomaly Agent
─────────────
Receives flagged sensor data. Uses Claude API to classify severity
and generate a human-readable description + recommended action.
Falls back to pure rule-based logic if API key is missing.
"""

import os
import json


class AnomalyAgent:

    def analyze(self, sensor_data: dict) -> dict:
        """
        Returns anomaly report dict with keys:
          severity, risk_score, issue, location, action, description
        """
        # Try Claude API first
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if api_key and not api_key.startswith("sk-ant-paste"):
            result = self._claude_analyze(sensor_data, api_key)
            if result:
                return result

        # Fallback: pure rule-based
        return self._rule_based(sensor_data)

    # ── Claude API analysis ───────────────────────────────────
    def _claude_analyze(self, sensor_data: dict, api_key: str) -> dict | None:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=api_key)

            prompt = f"""You are RailSense AI, an autonomous railway safety system for Indian Railways.
Analyze this sensor reading and respond ONLY with valid JSON — no markdown, no explanation.

SENSOR DATA:
- Train ID:    {sensor_data.get('train_id', 'UNKNOWN')}
- Temperature: {sensor_data.get('temperature')}°C   (danger >65, critical >75)
- Vibration:   {sensor_data.get('vibration')} mm/s  (danger >80, critical >90)
- Signal:      {sensor_data.get('signal')}           (FAULT = critical)
- Speed:       {sensor_data.get('speed')} km/h       (danger >140)
- Crowding:    {sensor_data.get('crowding')}%

Respond ONLY with this JSON (no extra text):
{{
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "risk_score": <integer 0-100>,
  "issue": "<short title, max 6 words>",
  "location": "<station or zone>",
  "action": "<one clear operator instruction>",
  "description": "<one sentence plain-English explanation>"
}}"""

            response = client.messages.create(
                model="claude-opus-4-5",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            raw = response.content[0].text.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)

        except Exception as e:
            print(f"[AnomalyAgent] Claude API error: {e} — using fallback")
            return None

    # ── Rule-based fallback ───────────────────────────────────
    def _rule_based(self, sensor_data: dict) -> dict:
        temperature = sensor_data.get("temperature", 0)
        vibration   = sensor_data.get("vibration", 0)
        signal      = sensor_data.get("signal", "GREEN")
        speed       = sensor_data.get("speed", 0)
        train_id    = sensor_data.get("train_id", "UNKNOWN")

        # Determine severity
        if vibration > 90 or signal == "FAULT" or temperature > 75:
            severity   = "CRITICAL"
            risk_score = min(90 + int(vibration / 10), 100)
            issue      = "Track Fracture / Signal Fault" if signal == "FAULT" else "Critical Track Vibration"
            action     = "EMERGENCY STOP — dispatch maintenance immediately"
        elif temperature > 70 or vibration > 80 or speed > 150:
            severity   = "HIGH"
            risk_score = min(70 + int(temperature / 5), 100)
            issue      = "Track Temperature Spike" if temperature > 70 else "Overspeed Alert"
            action     = "Reduce speed to 30 km/h, alert station master"
        elif temperature > 60 or speed > 140:
            severity   = "MEDIUM"
            risk_score = min(50 + int(temperature / 5), 100)
            issue      = "Temperature Warning"
            action     = "Reduce speed to 60 km/h, monitor closely"
        else:
            severity   = "LOW"
            risk_score = 30
            issue      = "Minor Sensor Anomaly"
            action     = "Log for scheduled inspection"

        return {
            "severity":    severity,
            "risk_score":  risk_score,
            "issue":       issue,
            "location":    f"Train {train_id}",
            "action":      action,
            "description": f"Sensor anomaly detected — temp {temperature}°C, vibration {vibration} mm/s, signal {signal}, speed {speed} km/h."
        }
