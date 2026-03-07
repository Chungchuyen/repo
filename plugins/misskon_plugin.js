"""
Scraper dữ liệu phim từ phimmoichill
Cào thông tin: tên phim, thể loại, năm, rating, mô tả, link
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import time
import re
from urllib.parse import urljoin, urlparse
from dataclasses import dataclass, asdict
from typing import Optional
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

BASE_URL = "https://phimmoichill.you"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": BASE_URL,
}


@dataclass
class Movie:
    title: str
    original_title: str = ""
    year: str = ""
    genres: str = ""
    country: str = ""
    duration: str = ""
    rating: str = ""
    views: str = ""
    director: str = ""
    actors: str = ""
    description: str = ""
    poster_url: str = ""
    movie_url: str = ""
    status: str = ""        # Hoàn tất / Đang chiếu
    quality: str = ""       # HD, FHD, CAM ...
    language: str = ""      # Vietsub, Thuyết minh ...


class PhimMoiChillScraper:
    def __init__(self, delay: float = 1.5):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.delay = delay

    # ------------------------------------------------------------------ #
    #  Helper                                                               #
    # ------------------------------------------------------------------ #

    def _get(self, url: str) -> Optional[BeautifulSoup]:
        try:
            resp = self.session.get(url, timeout=15)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            log.error(f"Lỗi khi tải {url}: {e}")
            return None

    def _text(self, el) -> str:
        return el.get_text(strip=True) if el else ""

    # ------------------------------------------------------------------ #
    #  Lấy danh sách phim từ trang liệt kê                                 #
    # ------------------------------------------------------------------ #

    def get_movie_links_from_listing(self, url: str) -> list[str]:
        """Trả về danh sách URL chi tiết phim từ 1 trang listing."""
        soup = self._get(url)
        if not soup:
            return []

        links = []
        # Selector phổ biến trên các site clone PhimMoi
        for a in soup.select("div.tray-item a, .item a.thumb, .movie-item a, article a.poster"):
            href = a.get("href", "")
            if href and "/phim/" in href:
                full = urljoin(BASE_URL, href)
                if full not in links:
                    links.append(full)

        # Fallback: lấy tất cả link chứa /phim/
        if not links:
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/phim/" in href:
                    full = urljoin(BASE_URL, href)
                    if full not in links:
                        links.append(full)

        log.info(f"  → Tìm thấy {len(links)} phim tại {url}")
        return links

    def get_all_pages(self, section_url: str, max_pages: int = 5) -> list[str]:
        """Duyệt qua nhiều trang của 1 chuyên mục và gom link phim."""
        all_links: list[str] = []
        for page in range(1, max_pages + 1):
            page_url = f"{section_url}?page={page}" if page > 1 else section_url
            log.info(f"Đang cào trang {page}: {page_url}")
            links = self.get_movie_links_from_listing(page_url)
            if not links:
                log.info("  → Hết phim, dừng phân trang.")
                break
            all_links.extend(links)
            time.sleep(self.delay)
        return list(dict.fromkeys(all_links))  # loại trùng, giữ thứ tự

    # ------------------------------------------------------------------ #
    #  Cào chi tiết 1 phim                                                  #
    # ------------------------------------------------------------------ #

    def scrape_movie(self, url: str) -> Optional[Movie]:
        soup = self._get(url)
        if not soup:
            return None

        movie = Movie(title="", movie_url=url)

        # --- Tiêu đề ---
        title_el = soup.select_one("h1.heading_movie, h1.title, h1")
        movie.title = self._text(title_el)

        # --- Poster ---
        poster = soup.select_one("div.poster img, .film-poster img, .thumb img")
        if poster:
            movie.poster_url = poster.get("src") or poster.get("data-src", "")

        # --- Block thông tin (dt/dd hoặc li) ---
        info_map: dict[str, str] = {}

        # Kiểu 1: <ul class="list_info"> với <li>
        for li in soup.select(".list_info li, .film-info li, .movie-info li"):
            text = li.get_text(" ", strip=True)
            if ":" in text:
                key, _, val = text.partition(":")
                info_map[key.strip().lower()] = val.strip()

        # Kiểu 2: <div class="row"> chứa label + value
        for row in soup.select(".info-row, .movie-detail li, .entry-info li"):
            spans = row.find_all(["span", "b", "strong"])
            if len(spans) >= 2:
                key = self._text(spans[0]).lower().rstrip(":")
                val = self._text(spans[1])
                info_map[key] = val

        def _pick(*keys: str) -> str:
            for k in keys:
                for ik, iv in info_map.items():
                    if k in ik:
                        return iv
            return ""

        movie.original_title = _pick("tên khác", "tên gốc", "original")
        movie.year           = _pick("năm", "year", "release")
        movie.genres         = _pick("thể loại", "genre", "category")
        movie.country        = _pick("quốc gia", "country", "nation")
        movie.duration       = _pick("thời lượng", "duration", "runtime")
        movie.director       = _pick("đạo diễn", "director")
        movie.actors         = _pick("diễn viên", "cast", "actor")
        movie.status         = _pick("trạng thái", "status")
        movie.quality        = _pick("chất lượng", "quality")
        movie.language       = _pick("ngôn ngữ", "language", "vietsub", "thuyết minh")
        movie.rating         = _pick("điểm", "rating", "imdb", "tmdb")
        movie.views          = _pick("lượt xem", "view")

        # --- Mô tả ---
        desc_el = soup.select_one(
            ".film-content p, .description p, .detail-content p, "
            "#film-content, .synopsis, .movie-description"
        )
        movie.description = self._text(desc_el)

        log.info(f"  ✓ {movie.title or url}")
        return movie

    # ------------------------------------------------------------------ #
    #  Cào theo chuyên mục                                                  #
    # ------------------------------------------------------------------ #

    def scrape_section(self, section_url: str, max_pages: int = 3) -> list[Movie]:
        """Cào toàn bộ phim trong 1 chuyên mục."""
        links = self.get_all_pages(section_url, max_pages)
        movies: list[Movie] = []
        for i, url in enumerate(links, 1):
            log.info(f"[{i}/{len(links)}] {url}")
            movie = self.scrape_movie(url)
            if movie:
                movies.append(movie)
            time.sleep(self.delay)
        return movies

    # ------------------------------------------------------------------ #
    #  Xuất dữ liệu                                                         #
    # ------------------------------------------------------------------ #

    def save_json(self, movies: list[Movie], path: str = "movies.json"):
        with open(path, "w", encoding="utf-8") as f:
            json.dump([asdict(m) for m in movies], f, ensure_ascii=False, indent=2)
        log.info(f"Đã lưu {len(movies)} phim → {path}")

    def save_csv(self, movies: list[Movie], path: str = "movies.csv"):
        if not movies:
            return
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=asdict(movies[0]).keys())
            writer.writeheader()
            writer.writerows(asdict(m) for m in movies)
        log.info(f"Đã lưu {len(movies)} phim → {path}")


# ------------------------------------------------------------------ #
#  MAIN – chạy thử                                                     #
# ------------------------------------------------------------------ #

if __name__ == "__main__":
    scraper = PhimMoiChillScraper(delay=1.5)

    # ---- Tuỳ chỉnh URL chuyên mục ----
    SECTIONS = {
        "phim-le":   f"{BASE_URL}/phim-le",       # Phim lẻ
        "phim-bo":   f"{BASE_URL}/phim-bo",       # Phim bộ
        "phim-moi":  f"{BASE_URL}/phim-moi-cap-nhat",  # Mới cập nhật
    }

    MAX_PAGES = 2   # Số trang mỗi chuyên mục (tăng lên để cào nhiều hơn)

    all_movies: list[Movie] = []

    for name, url in SECTIONS.items():
        log.info(f"\n{'='*50}")
        log.info(f"Cào chuyên mục: {name}")
        log.info(f"{'='*50}")
        movies = scraper.scrape_section(url, max_pages=MAX_PAGES)
        all_movies.extend(movies)

    # Lưu kết quả
    scraper.save_json(all_movies, "movies.json")
    scraper.save_csv(all_movies, "movies.csv")
    log.info(f"\nTổng cộng: {len(all_movies)} phim đã cào.")
