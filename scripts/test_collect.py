import unittest
from scripts.collect import parse_games

class ParserTests(unittest.TestCase):
    def test_standard_layout(self):
        html = "<div>Fortune Tiger Jogar Pagou hoje R$ 244.441</div><div>Lucky Neko Pagou hoje R$ 12.345,67</div>"
        games = parse_games(html, "before")
        self.assertEqual(games.get("Fortune Tiger"), 244441.0)
        self.assertEqual(games.get("Lucky Neko"), 12345.67)

    def test_after_amount_layout(self):
        html = "<div>Quente Pagou hoje R$ 8.515.153,88 Fortune Tiger PG Soft RTP 94.54</div>"
        games = parse_games(html, "after")
        self.assertEqual(games.get("Fortune Tiger"), 8515153.88)

if __name__ == "__main__":
    unittest.main()
