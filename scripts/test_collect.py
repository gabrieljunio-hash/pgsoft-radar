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

    def test_tada_provider_page(self):
        html = "<div>Fortune Garuda 1000 Pagou hoje R$ 114.030</div><div>Lucky Jaguar 500 Pagou hoje R$ 74.109</div>"
        games = parse_games(html)
        self.assertEqual(games.get("Fortune Garuda 1000"), 114030.0)

    def test_pragmatic_provider_page(self):
        html = "<div>Gates of Olympus Super Scatter Pagou hoje R$ 78.998</div>"
        games = parse_games(html)
        self.assertEqual(games.get("Gates of Olympus Super Scatter"), 78998.0)

    def test_popok_amount_and_names(self):
        html = "<div>Yummy: Trick or Treat507 Pagou hoje R$ 8.345.051,55</div><div>FastMaster513 Pagou hoje R$ 8.345.259,14</div>"
        games = parse_games(html)
        self.assertEqual(games.get("Yummy: Trick or Treat507"), 8345051.55)
        self.assertEqual(games.get("FastMaster513"), 8345259.14)

if __name__ == "__main__":
    unittest.main()
