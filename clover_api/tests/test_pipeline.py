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

if __name__ == '__main__':
    unittest.main()
