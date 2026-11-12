import unittest
import sys
from pathlib import Path

# Ensure root dir is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from clover_api.analytics.dashboard import export_dashboard_data
from clover_api.analytics.arima_baseline import build_arima_forecast
from clover_api.analytics.event_impact import run_event_impact_analysis
from clover_api.analytics.weather_impact import run_weather_impact_analysis
from clover_api.analytics.shift_forecast import build_shift_forecast

class TestPipelineExecution(unittest.TestCase):
    """
    Tests that the core analytics pipeline functions can execute fully
    without raising exceptions (e.g. KeyError on missing payload elements).
    Since they write to ANALYTICS_DIR and rely on SQLite reads,
    this serves as an integration test for the ETL structure.
    """
    def test_pipeline_execution(self):
        # 1. Dashboard payload
        try:
            export_dashboard_data()
        except Exception as e:
            self.fail(f"Dashboard export failed: {e}")

        # 2. ARIMA baseline payload
        try:
            build_arima_forecast()
        except Exception as e:
            self.fail(f"ARIMA baseline export failed: {e}")

        # 3. Event Impact payload
        try:
            run_event_impact_analysis()
        except Exception as e:
            self.fail(f"Event impact export failed: {e}")

        # 4. Weather Impact payload
        try:
            run_weather_impact_analysis()
        except Exception as e:
            self.fail(f"Weather impact export failed: {e}")

        # 5. Shift Forecast payload
        try:
            build_shift_forecast()
        except Exception as e:
            self.fail(f"Shift forecast export failed: {e}")

    def test_standalone_script_execution(self):
        """
        Verify that analytics scripts execute cleanly as standalone CLI processes
        (reproducing CI invocation without relying on PYTHONPATH or root sys.path).
        """
        import subprocess

        scripts_to_test = [
            ROOT_DIR / "clover_api" / "analytics" / "food_cost_engine.py",
            ROOT_DIR / "clover_api" / "analytics" / "anomaly_detector.py",
            ROOT_DIR / "clover_api" / "analytics" / "ml_model.py",
        ]

        for script in scripts_to_test:
            result = subprocess.run(
                [sys.executable, str(script)],
                cwd=str(ROOT_DIR),
                capture_output=True,
                text=True,
            )
            self.assertEqual(
                result.returncode,
                0,
                f"Standalone execution of {script.name} failed with code {result.returncode}:\n"
                f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}",
            )


if __name__ == '__main__':
    unittest.main()
