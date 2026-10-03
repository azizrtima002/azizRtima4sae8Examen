"""A polite HTTP client: robots.txt, rate limiting, honest User-Agent, retries.

Every scraper goes through `PoliteSession`, so the scraping rules of the
project are enforced in one place rather than trusted to each source.
"""

from __future__ import annotations

import logging
import os
import random
import time
from collections.abc import Callable
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import requests

from . import __version__

log = logging.getLogger(__name__)

DEFAULT_CONTACT = "https://github.com/azizrtima002/azizRtima4sae8Examen"
USER_AGENT = (
    f"StageFinderTN-Bot/{__version__} "
    f"(+{os.environ.get('SCRAPER_CONTACT', DEFAULT_CONTACT)}; internship aggregator)"
)

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class ScrapeError(RuntimeError):
    """A source could not be scraped (network, HTTP status, robots.txt...)."""


class RobotsDisallowed(ScrapeError):
    """The target URL is disallowed for our User-Agent by robots.txt."""


class PoliteSession:
    """`requests.Session` wrapper enforcing the project's scraping rules.

    * waits `min_delay`..`max_delay` seconds between two requests to a host
      (2-3 s by default, or the robots.txt Crawl-delay if it is longer);
    * refuses URLs disallowed by robots.txt;
    * identifies itself with a descriptive User-Agent;
    * retries transient failures with exponential backoff.
    """

    def __init__(
        self,
        min_delay: float = 2.0,
        max_delay: float = 3.0,
        timeout: float = 20.0,
        max_retries: int = 2,
        session: requests.Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
                "Accept-Language": "fr-TN,fr;q=0.9,en;q=0.6",
            }
        )
        self._sleep = sleep
        self._clock = clock
        self._last_request: dict[str, float] = {}
        self._robots: dict[str, RobotFileParser | None] = {}

    # -- robots.txt ---------------------------------------------------------

    def _robots_for(self, url: str) -> RobotFileParser | None:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._robots:
            parser: RobotFileParser | None = RobotFileParser()
            robots_url = f"{origin}/robots.txt"
            try:
                self._throttle(parts.netloc)
                resp = self.session.get(robots_url, timeout=self.timeout)
                if resp.status_code in (401, 403):
                    # Same convention as Google: an access-denied robots.txt
                    # means the whole site is off-limits.
                    parser.disallow_all = True
                elif resp.status_code >= 400:
                    parser.allow_all = True
                else:
                    parser.parse(resp.text.splitlines())
            except requests.RequestException as exc:
                log.warning("robots.txt unreachable for %s (%s): assuming allowed", origin, exc)
                parser = None
            self._robots[origin] = parser
        return self._robots[origin]

    def allowed(self, url: str) -> bool:
        parser = self._robots_for(url)
        return parser is None or parser.can_fetch(USER_AGENT, url)

    def _crawl_delay(self, url: str) -> float:
        parser = self._robots.get(f"{urlsplit(url).scheme}://{urlsplit(url).netloc}")
        if parser is None:
            return 0.0
        try:
            delay = parser.crawl_delay(USER_AGENT)
        except AttributeError:  # parser without any entry
            delay = None
        return float(delay or 0.0)

    # -- rate limiting ------------------------------------------------------

    def _throttle(self, host: str, extra_delay: float = 0.0) -> None:
        last = self._last_request.get(host)
        if last is not None:
            wanted = max(random.uniform(self.min_delay, self.max_delay), extra_delay)
            elapsed = self._clock() - last
            if elapsed < wanted:
                self._sleep(wanted - elapsed)
        self._last_request[host] = self._clock()

    # -- public API ---------------------------------------------------------

    def get(self, url: str, **kwargs) -> requests.Response:
        if not self.allowed(url):
            raise RobotsDisallowed(f"robots.txt disallows {url}")

        host = urlsplit(url).netloc
        attempt = 0
        while True:
            self._throttle(host, self._crawl_delay(url))
            try:
                resp = self.session.get(url, timeout=self.timeout, **kwargs)
            except requests.RequestException as exc:
                if attempt >= self.max_retries:
                    raise ScrapeError(f"GET {url} failed: {exc}") from exc
                backoff = 2 ** (attempt + 1)
            else:
                if resp.status_code not in RETRYABLE_STATUS:
                    if resp.status_code >= 400:
                        raise ScrapeError(f"GET {url} returned HTTP {resp.status_code}")
                    return resp
                if attempt >= self.max_retries:
                    raise ScrapeError(f"GET {url} returned HTTP {resp.status_code}")
                backoff = _retry_after(resp) or 2 ** (attempt + 1)
            attempt += 1
            log.info("retrying %s in %.0fs (attempt %d)", url, backoff, attempt + 1)
            self._sleep(backoff)

    def get_text(self, url: str, **kwargs) -> str:
        resp = self.get(url, **kwargs)
        if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
            resp.encoding = resp.apparent_encoding
        return resp.text


def _retry_after(resp: requests.Response) -> float | None:
    value = resp.headers.get("Retry-After")
    if value and value.isdigit():
        return min(float(value), 120.0)
    return None
