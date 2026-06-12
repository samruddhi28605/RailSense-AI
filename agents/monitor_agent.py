"""
Monitor Agent
─────────────
Watches sensor readings and flags anything suspicious.
Returns True if something needs investigation, False if normal.
"""


class MonitorAgent:

    def __init__(self):
        self.history = []

    def monitor(self, sensor_data: dict) -> bool:
        """
        Returns True if sensor data looks suspicious.
        Thresholds match the project document exactly.
        """
        self.history.append(sensor_data)
        if len(self.history) > 100:
            self.history.pop(0)

        temperature = sensor_data.get("temperature", 0)
        vibration   = sensor_data.get("vibration", 0)
        signal      = sensor_data.get("signal", "GREEN")
        speed       = sensor_data.get("speed", 0)

        if (
            temperature > 65
            or vibration   > 80
            or signal      == "FAULT"
            or speed       > 140
        ):
            return True

        return False

    def log_message(self, sensor_data: dict) -> str:
        """Human-readable log line for this scan."""
        tid = sensor_data.get("train_id", "UNKNOWN")
        return f"Sensor scan for {tid} — temp={sensor_data.get('temperature')}°C, vib={sensor_data.get('vibration')}, signal={sensor_data.get('signal')}, speed={sensor_data.get('speed')} km/h"
