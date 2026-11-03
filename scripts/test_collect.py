import unittest
from unittest.mock import patch
from scripts.collect import parse_games, parse_game_images, collect_batch

class ParserTests(unittest.TestCase):
    def test_game_image_matching(self):
        html = '<img alt="Fortune Tiger" src="/games/fortune-tiger.webp"><img alt="Banner" src="/banner.jpg">'
        images = parse_game_images(html, ["Fortune Tiger", "Lucky Neko"], "https://example.com/cassino/pg-soft")
        self.assertEqual(images.get("Fortune Tiger"), "https://example.com/games/fortune-tiger.webp")
        self.assertNotIn("Lucky Neko", images)


    def test_image_uses_lazy_source_instead_of_placeholder(self):
        html = '<img alt="Fortune Tiger" src="data:image/gif;base64,AAAA" data-src="/covers/fortune-tiger.webp">'
        images = parse_game_images(html, ["Fortune Tiger"], "https://example.com/casino")
        self.assertEqual(images.get("Fortune Tiger"), "https://example.com/covers/fortune-tiger.webp")

    def test_image_srcset_prefers_largest_variant(self):
        html = '<img alt="Lucky Neko" src="/small.webp" srcset="/small.webp 320w, /large.webp 960w">'
        images = parse_game_images(html, ["Lucky Neko"], "https://example.com/casino")
        self.assertEqual(images.get("Lucky Neko"), "https://example.com/large.webp")

    def test_image_matching_ignores_placeholder_and_supports_accents(self):
        html = '<img alt="Banner" src="/placeholder.webp"><img data-game-name="Fortuné Tíger" data-src="//cdn.example.com/tiger.webp">'
        images = parse_game_images(html, ["Fortune Tiger"], "https://example.com/casino")
        self.assertEqual(images.get("Fortune Tiger"), "https://cdn.example.com/tiger.webp")

    def test_image_rejects_data_and_blob_urls(self):
        html = '<img alt="Fortune Tiger" src="data:image/png;base64,AAAA"><img alt="Lucky Neko" src="blob:https://example.com/abc">'
        images = parse_game_images(html, ["Fortune Tiger", "Lucky Neko"], "https://example.com/casino")
        self.assertEqual(images, {})

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


    def test_parallel_batch_keeps_source_order_and_captures_errors(self):
        sources = [
            {"id": "a", "name": "A", "provider": "PG Soft"},
            {"id": "b", "name": "B", "provider": "PG Soft"},
        ]
        def fake_fetch(source):
            if source["id"] == "b":
                raise RuntimeError("indisponível")
            return {"Tiger": 10}, {}
        with patch("scripts.collect.fetch_source_details", side_effect=fake_fetch):
            results = collect_batch(sources, parallel=True)
        self.assertEqual([item[0]["id"] for item in results], ["a", "b"])
        self.assertEqual(results[0][1], {"Tiger": 10})
        self.assertIsNone(results[0][3])
        self.assertIsInstance(results[1][3], RuntimeError)

if __name__ == "__main__":
    unittest.main()
