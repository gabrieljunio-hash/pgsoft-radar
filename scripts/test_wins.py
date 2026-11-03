import unittest
from datetime import datetime, timezone, timedelta
from scripts.collect_wins import parse_rows, norm

class WinFeedTests(unittest.TestCase):
    def test_source_status_is_not_ok_when_page_has_no_pgsoft_rows(self):
        from scripts.collect_wins import classify_source
        self.assertEqual(classify_source({"pgsoft_rows": 0, "eligible_rows": 0}), "no_pgsoft_data")
        self.assertEqual(classify_source({"pgsoft_rows": 2, "eligible_rows": 0}), "no_50x_events")
        self.assertEqual(classify_source({"pgsoft_rows": 2, "eligible_rows": 1}), "ok")

    def test_accessible_sources_without_pgsoft_data_do_not_fail_collection(self):
        from scripts.collect_wins import should_fail_collection
        self.assertFalse(should_fail_collection([
            {"status": "no_pgsoft_data"},
            {"status": "no_50x_events"},
        ]))
        self.assertTrue(should_fail_collection([
            {"status": "error"},
            {"status": "error"},
        ]))

    def test_only_pgsoft_games_and_50x_or_more(self):
        html = """
        <table><tr><th>Jogo</th><th>Jogador</th><th>Data e hora</th><th>Aposta</th><th>Multiplicador</th><th>Pagamento</th></tr>
        <tr><td><img src="https://img.example/tiger.png" alt="Fortune Tiger">Fortune Tiger</td><td>123***456</td><td>02/11, 08:56</td><td>R$ 2,00</td><td>50.00×</td><td>R$ 100,00</td></tr>
        <tr><td>Gates of Olympus</td><td>123***456</td><td>02/11, 08:55</td><td>R$ 2,00</td><td>100×</td><td>R$ 200,00</td></tr>
        <tr><td>Fortune Ox</td><td>123***456</td><td>02/11, 08:54</td><td>R$ 1,00</td><td>10×</td><td>R$ 10,00</td></tr>
        </table>"""
        known = {norm("Fortune Tiger"): "Fortune Tiger", norm("Fortune Ox"): "Fortune Ox"}
        now = datetime(2026, 11, 2, 9, 0, tzinfo=timezone(timedelta(hours=-3)))
        rows = parse_rows(html, known, now)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["game"], "Fortune Tiger")
        self.assertEqual(rows[0]["multiplier"], 50)
        self.assertEqual(rows[0]["image"], "https://img.example/tiger.png")

if __name__ == "__main__":
    unittest.main()
