import requests, time, os, warnings
warnings.filterwarnings("ignore")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9"}
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "data", "raw")
os.makedirs(RAW, exist_ok=True)
_last = [0.0]
def get(url, cache=None, binary=False, retries=6, delay=2.5):
    if cache:
        p = os.path.join(RAW, cache)
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return open(p, "rb").read() if binary else open(p, encoding="utf-8").read()
    for i in range(retries + 1):
        w = delay - (time.time() - _last[0])
        if w > 0: time.sleep(w)
        _last[0] = time.time()
        try:
            r = requests.get(url, headers=UA, timeout=30)
        except Exception as e:
            print("ERR", url, e); continue
        if r.status_code == 200:
            if cache:
                p = os.path.join(RAW, cache)
                os.makedirs(os.path.dirname(p), exist_ok=True)
                if binary: open(p, "wb").write(r.content)
                else: open(p, "w", encoding="utf-8").write(r.text)
            return r.content if binary else r.text
        print("HTTP", r.status_code, url, flush=True)
        if r.status_code == 429:
            time.sleep(min(int(r.headers.get("Retry-After", 90)), 180)); continue
        if r.status_code in (403, 404): break
    return None
