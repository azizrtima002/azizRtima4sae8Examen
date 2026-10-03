import pytest
import requests

from stagefinder.http import USER_AGENT, PoliteSession, RobotsDisallowed, ScrapeError


class FakeResponse:
    def __init__(self, status=200, text="", headers=None):
        self.status_code = status
        self.text = text
        self.headers = headers or {}
        self.encoding = "utf-8"
        self.apparent_encoding = "utf-8"


class FakeSession:
    def __init__(self, responses):
        self.responses = responses  # url -> list of responses (consumed in order)
        self.headers = {}
        self.calls = []

    def get(self, url, timeout=None, **kwargs):
        self.calls.append(url)
        queue = self.responses.get(url)
        if not queue:
            return FakeResponse(404)
        item = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(item, Exception):
            raise item
        return item


class FakeClock:
    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds

    def __call__(self):
        return self.now


def make(responses, **kwargs):
    clock = FakeClock()
    http = PoliteSession(session=FakeSession(responses), sleep=clock.sleep, clock=clock, **kwargs)
    return http, clock


ROBOTS_OK = FakeResponse(200, "User-agent: *\nDisallow: /admin\n")


def test_sends_an_identifiable_user_agent():
    http, _ = make({})
    assert http.session.headers["User-Agent"] == USER_AGENT
    assert "StageFinderTN-Bot" in USER_AGENT


def test_respects_robots_txt():
    http, _ = make({"https://site.tn/robots.txt": [ROBOTS_OK]})
    assert http.allowed("https://site.tn/jobs")
    with pytest.raises(RobotsDisallowed):
        http.get("https://site.tn/admin/secret")


def test_forbidden_robots_txt_disallows_everything():
    http, _ = make({"https://site.tn/robots.txt": [FakeResponse(403)]})
    assert not http.allowed("https://site.tn/jobs")


def test_missing_robots_txt_allows_everything():
    http, _ = make({})
    assert http.allowed("https://site.tn/jobs")


def test_waits_two_to_three_seconds_between_requests_to_the_same_host():
    http, clock = make(
        {
            "https://site.tn/robots.txt": [ROBOTS_OK],
            "https://site.tn/a": [FakeResponse(200, "a")],
            "https://site.tn/b": [FakeResponse(200, "b")],
        }
    )
    http.get("https://site.tn/a")
    http.get("https://site.tn/b")
    # robots.txt -> a -> b : two waits, each within the polite window
    assert len(clock.sleeps) == 2
    assert all(2.0 <= s <= 3.0 for s in clock.sleeps)


def test_honours_a_longer_crawl_delay():
    robots = FakeResponse(200, "User-agent: *\nCrawl-delay: 10\n")
    http, clock = make({"https://site.tn/robots.txt": [robots], "https://site.tn/a": [FakeResponse(200)]})
    http.get("https://site.tn/a")
    assert clock.sleeps == [10.0]


def test_retries_transient_errors_then_succeeds():
    http, clock = make(
        {
            "https://site.tn/robots.txt": [ROBOTS_OK],
            "https://site.tn/a": [
                FakeResponse(503),
                FakeResponse(429, headers={"Retry-After": "7"}),
                FakeResponse(200, "ok"),
            ],
        }
    )
    assert http.get("https://site.tn/a").text == "ok"
    assert 2 in clock.sleeps and 7.0 in clock.sleeps


def test_gives_up_after_max_retries():
    http, _ = make(
        {"https://site.tn/robots.txt": [ROBOTS_OK], "https://site.tn/a": [FakeResponse(503)]},
        max_retries=1,
    )
    with pytest.raises(ScrapeError, match="HTTP 503"):
        http.get("https://site.tn/a")


def test_network_errors_become_scrape_errors():
    http, _ = make(
        {
            "https://site.tn/robots.txt": [ROBOTS_OK],
            "https://site.tn/a": [requests.ConnectionError("boom")],
        },
        max_retries=0,
    )
    with pytest.raises(ScrapeError, match="boom"):
        http.get("https://site.tn/a")


def test_client_errors_are_not_retried():
    http, _ = make({"https://site.tn/robots.txt": [ROBOTS_OK], "https://site.tn/a": [FakeResponse(404)]})
    with pytest.raises(ScrapeError, match="HTTP 404"):
        http.get("https://site.tn/a")
    assert http.session.calls.count("https://site.tn/a") == 1
