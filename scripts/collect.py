#!/usr/bin/env python3
"""Collect public daily cumulative totals, tagged by game provider."""
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
SOURCES = [
    {"id": "farra.bet", "name": "Farra.bet", "url": "https://farra.bet/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "jogou.io", "name": "Jogou", "url": "https://jogou.io/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "cassino365.bet", "name": "Cassino10", "url": "https://www.cassino365.bet/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "tokyoclubbet.com", "name": "Tokyo Club", "url": "https://tokyoclubbet.com/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "betz1nha.com", "name": "Betzinha", "url": "https://betz1nha.com/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "jogofacil.net.br", "name": "Jogo Fácil", "url": "https://jogofacil.net.br/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "farra.bet:tada", "name": "Farra.bet", "url": "https://farra.bet/cassino/tada", "provider": "TaDa Gaming"},
    {"id": "jogou.io:tada", "name": "Jogou", "url": "https://jogou.io/cassino/tada", "provider": "TaDa Gaming"},
    {"id": "farra.bet:pragmatic", "name": "Farra.bet", "url": "https://farra.bet/cassino/pragmatic", "provider": "Pragmatic Play"},
    {"id": "jogou.io:pragmatic", "name": "Jogou", "url": "https://jogou.io/cassino/pragmatic", "provider": "Pragmatic Play"},
    {"id": "cazebetbr.com:popok", "name": "Cazé Bet", "url": "https://cazebetbr.com/cassino?lista=popok", "provider": "PopOK", "layout": "after", "use_browser": True},
]
AMOUNT = r"([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:,[0-9]{2})?)"

def parse_amount(value):
    return float(value.replace(".", "").replace(",", "."))

def clean_name(value):
    name = re.sub(r"\s+", " ", unescape(value)).strip(" -|—:·")
    name = re.sub(r"\s+Jogar$", "", name, flags=re.I)
    name = re.sub(r"\s+(?:PG\s*Soft|TaDa\s*Gaming|Pragmatic\s*Play|PopOK)$", "", name, flags=re.I)
    name = re.sub(r"^(?:Quente|Popular|Novo)\s+", "", name, flags=re.I)
    return name.strip()

def parse_games(raw, layout="before"):
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(re.sub(r"\s+", " ", text))
    games = {}
    if layout == "after":
        patterns = [
            re.compile(r"Pagou hoje\s+R\$\s*" + AMOUNT + r"\s+(.{2,90}?)\s+(?:PG\s*Soft|TaDa\s*Gaming|Pragmatic\s*Play|PopOK|RTP)", re.I),
        ]
        for pattern in patterns:
            for value, raw_name in pattern.findall(text):
                name = clean_name(raw_name)
                if name and len(name) <= 85:
                    games[name] = parse_amount(value)
    else:
        pattern = re.compile(r"([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 '’&:!?().-]{1,100}?)\s+(?:Jogar\s+)?Pagou hoje\s+R\$\s*" + AMOUNT, re.I)
        for raw_name, value in pattern.findall(text):
            name = clean_name(raw_name)
            if name and len(name) <= 85:
                games[name] = parse_amount(value)
    return games

class ImageParser(HTMLParser):
    """Collect real game artwork URLs from image and picture elements."""
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag not in ("img", "source"):
            return
        attrs = dict(attrs)
        # Prefer lazy-loaded sources: a plain src is often a 1x1 placeholder.
        src = next((attrs.get(k) for k in (
            "data-src", "data-lazy-src", "data-original",
            "data-original-src", "data-url", "src"
        ) if attrs.get(k)), None)
        srcset = attrs.get("data-srcset") or attrs.get("srcset")
        if srcset:
            candidates = []
            for item in srcset.split(","):
                bits = item.strip().split()
                if bits:
                    descriptor = bits[1] if len(bits) > 1 else "1x"
                    score = float(descriptor[:-1]) if descriptor.endswith("x") else (float(descriptor[:-1]) / 1000 if descriptor.endswith("w") and descriptor[:-1].isdigit() else 1)
                    candidates.append((score, bits[0]))
            if candidates:
                src = max(candidates)[1]
        if not src:
            return
        src = unescape(src.strip())
        lowered = src.lower()
        if lowered.startswith(("data:", "blob:", "javascript:")):
            return
        if any(token in lowered for token in ("placeholder", "transparent", "spacer.gif", "blank.gif")):
            return
        label = " ".join(attrs.get(k, "") for k in (
            "alt", "title", "data-name", "data-game", "data-game-name",
            "data-title", "aria-label"
        ))
        self.images.append((label, src))


def normalize_label(value):
    value = unicodedata.normalize("NFKD", unescape(str(value)).lower())
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", value)


def parse_game_images(raw, game_names, page_url):
    parser = ImageParser()
    try:
        parser.feed(raw)
    except Exception:
        pass
    result = {}
    for game in game_names:
        wanted = normalize_label(game)
        if not wanted:
            continue
        for label, src in parser.images:
            label_key = normalize_label(label)
            path_key = normalize_label(urlparse(src).path.rsplit("/", 1)[-1].rsplit(".", 1)[0])
            label_match = label_key and (
                label_key == wanted or wanted in label_key or
                (label_key in wanted and len(label_key) >= 6)
            )
            path_match = path_key and (
                path_key == wanted or wanted in path_key or
                (path_key in wanted and len(path_key) >= 6)
            )
            if label_match or path_match:
                absolute = urljoin(page_url, src)
                parsed = urlparse(absolute)
                if parsed.scheme in ("http", "https") and parsed.netloc:
                    result[game] = absolute
                    break
    return result

def fetch_source_details(source):
    req = Request(source["url"], headers={
        "User-Agent": "Mozilla/5.0 (compatible; PGSoftRadar/1.0; +https://github.com/gabrieljunio-hash/pgsoft-radar)",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    })
    with urlopen(req, timeout=25) as response:
        raw = response.read().decode("utf-8", "replace")
    games = parse_games(raw, source.get("layout", "before"))
    images = parse_game_images(raw, games.keys(), source["url"])
    if len(games) < 5 and source.get("use_browser"):
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page(locale="pt-BR", user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36")
            page.goto(source["url"], wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(5000)
            rendered = page.locator("body").inner_text(timeout=15000)
            raw = page.content()
            browser.close()
        games = parse_games(rendered, source.get("layout", "before"))
        images = parse_game_images(raw, games.keys(), source["url"])
    if len(games) < 5:
        raise RuntimeError(f"parser encontrou apenas {len(games)} jogos")
    return games, images

def fetch_source(source):
    return fetch_source_details(source)[0]

def load_history(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"schema_version": 2, "snapshots": []}

def main():
    history_path = DATA / "history.json"
    history = load_history(history_path)
    snapshots = history.get("snapshots", [])
    successes, failures = [], []
    print(f"Iniciando monitoramento de {len(SOURCES)} fontes/provedoras.")
    for source in SOURCES:
        try:
            games, game_images = fetch_source_details(source)
            now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            snapshots.append({
                "source": source["id"],
                "source_name": source["name"],
                "source_url": source["url"],
                "provider": source["provider"],
                "collected_at": now,
                "currency": "BRL",
                "metric": "daily_cumulative_total",
                "games": games,
                "game_images": game_images,
            })
            successes.append((source["name"], source["provider"], len(games)))
            print(f"OK {source['name']} / {source['provider']}: {len(games)} jogos")
        except Exception as exc:
            failures.append((source["name"], source["provider"], str(exc)))
            print(f"FALHA {source['name']} / {source['provider']}: {exc}", file=sys.stderr)

    if not successes:
        raise RuntimeError("Nenhuma fonte produziu dados válidos; histórico preservado.")
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    snapshots = [
        s for s in snapshots
        if datetime.fromisoformat(s["collected_at"].replace("Z", "+00:00")) >= cutoff
    ]
    snapshots.sort(key=lambda s: s["collected_at"])
    payload = {
        "schema_version": 3,
        "notice": "Valores acumulados diários publicados por cada fonte. Variações entre coletas não são prêmios individuais nem previsões.",
        "snapshots": snapshots,
    }
    history_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    latest_by_source = {}
    for snapshot in snapshots:
        latest_by_source[snapshot["source"] + "|" + snapshot.get("provider", "PG Soft")] = snapshot
    (DATA / "latest.json").write_text(
        json.dumps({"updated_at": datetime.now(timezone.utc).isoformat(), "sources": latest_by_source}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Coleta finalizada: {len(successes)}/{len(SOURCES)} fontes válidas; {len(snapshots)} snapshots no histórico.")
    if failures:
        print("Fontes indisponíveis: " + "; ".join(f"{name}/{provider}" for name, provider, _ in failures))

if __name__ == "__main__":
    main()
