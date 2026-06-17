import unittest
import math
from unittest.mock import MagicMock, patch
from app.services.market_data import safe_float, safe_int, MarketDataService
from app.schemas.stock import StockOverview

class TestFinancialMetrics(unittest.TestCase):
    
    # 1. Test safe_float utility
    def test_safe_float_valid(self):
        self.assertEqual(safe_float("12.34"), 12.34)
        self.assertEqual(safe_float(45.67), 45.67)
        self.assertEqual(safe_float(100), 100.0)

    def test_safe_float_none(self):
        self.assertIsNone(safe_float(None))

    def test_safe_float_invalid_str(self):
        self.assertIsNone(safe_float("N/A"))
        self.assertIsNone(safe_float("invalid"))
        self.assertIsNone(safe_float([]))

    def test_safe_float_nan_inf(self):
        self.assertIsNone(safe_float(float('nan')))
        self.assertIsNone(safe_float(float('inf')))
        self.assertIsNone(safe_float(float('-inf')))

    # 2. Test safe_int utility
    def test_safe_int_valid(self):
        self.assertEqual(safe_int("100"), 100)
        self.assertEqual(safe_int(123), 123)
        self.assertEqual(safe_int(123.99), 123)  # truncates float

    def test_safe_int_none(self):
        self.assertIsNone(safe_int(None))

    def test_safe_int_invalid(self):
        self.assertIsNone(safe_int("N/A"))
        self.assertIsNone(safe_int("abc"))
        self.assertIsNone(safe_int({}))

    # 3. Test MarketDataService.get_stock_overview Parsing & Normalization
    @patch('yfinance.Ticker')
    def test_get_stock_overview_normalization(self, mock_ticker):
        # Setup mock Ticker info
        mock_instance = MagicMock()
        mock_instance.fast_info = None
        mock_instance.info = {
            "symbol": "NVDA",
            "longName": "NVIDIA Corporation",
            "longBusinessSummary": "NVIDIA designs graphics processing units...",
            "sector": "Technology",
            "industry": "Semiconductors",
            "website": "https://www.nvidia.com",
            "marketCap": 3000000000000,
            "trailingPE": 75.5,
            "dividendYield": 0.49,  # 0.49% returned as 0.49 by yfinance
            "currentPrice": 125.25,
            "dayHigh": 127.00,
            "dayLow": 124.50,
            "fiftyTwoWeekHigh": 140.00,
            "fiftyTwoWeekLow": 80.00,
            "volume": 45000000,
            "previousClose": 124.00,
            "open": 124.50
        }
        mock_ticker.return_value = mock_instance

        # Call service
        overview = MarketDataService.get_stock_overview("NVDA")
        
        self.assertIsNotNone(overview)
        self.assertEqual(overview.ticker, "NVDA")
        self.assertEqual(overview.name, "NVIDIA Corporation")
        
        # Verify normalization of dividend yield: 0.49 (percentage) -> 0.0049 (fraction)
        self.assertEqual(overview.dividend_yield, 0.0049)
        self.assertEqual(overview.market_cap, 3000000000000)
        self.assertEqual(overview.pe_ratio, 75.5)
        self.assertEqual(overview.current_price, 125.25)
        self.assertEqual(overview.day_high, 127.00)
        self.assertEqual(overview.day_low, 124.50)
        self.assertEqual(overview.fifty_two_week_high, 140.00)
        self.assertEqual(overview.fifty_two_week_low, 80.00)
        self.assertEqual(overview.volume, 45000000)
        self.assertEqual(overview.previous_close, 124.00)
        self.assertEqual(overview.open_price, 124.50)

    @patch('yfinance.Ticker')
    def test_get_stock_overview_missing_values(self, mock_ticker):
        # Setup mock Ticker with missing/malformed values
        mock_instance = MagicMock()
        mock_instance.fast_info = None
        mock_instance.info = {
            "symbol": "MOCK",
            "longName": "Mock Company",
            "marketCap": "N/A",           # Should resolve to None
            "trailingPE": float('nan'),   # Should resolve to None
            "dividendYield": None,        # Should resolve to None
            "currentPrice": 50.0,
            "dayHigh": "Infinity",        # Should resolve to None
            "dayLow": 49.0,
            "volume": None
        }
        mock_ticker.return_value = mock_instance

        # Call service
        overview = MarketDataService.get_stock_overview("MOCK")

        self.assertIsNotNone(overview)
        self.assertEqual(overview.ticker, "MOCK")
        self.assertEqual(overview.current_price, 50.0)
        self.assertEqual(overview.day_low, 49.0)
        
        # Verify missing or invalid fields resolved to None robustly
        self.assertIsNone(overview.market_cap)
        self.assertIsNone(overview.pe_ratio)
        self.assertIsNone(overview.dividend_yield)
        self.assertIsNone(overview.day_high)
        self.assertIsNone(overview.volume)

if __name__ == "__main__":
    unittest.main()
