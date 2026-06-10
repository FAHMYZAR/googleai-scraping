import { AppConfig } from "../core/config";
import type { MoodleCookies } from "./moodleCookieStore";
import { MoodleCookieStore } from "./moodleCookieStore";

export class MoodleSessionService {
  private cookies: MoodleCookies = {};
  private readonly store = new MoodleCookieStore();

  async init() {
    this.cookies = await this.store.read();
  }

  private buildCookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  private updateCookiesFromHeaders(headers: Headers) {
    const setCookie = headers.get("set-cookie");
    // VERY BASIC cookie parsing. Assuming commas split different cookies unless inside dates
    // In production we'd use a real set-cookie parser if it was complex, but for Moodle usually 1-2
    // Actually bun fetch exposes `getSetCookie()` or similar
    if (!setCookie) return;
    
    // Bun implements Headers.getSetCookie() in newer versions
    const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [setCookie];
    let changed = false;
    for (const sc of setCookies) {
      if (!sc) continue;
      const firstPart = sc.split(";")[0] || "";
      const parts = firstPart.split("=");
      if (parts.length >= 2) {
        const k = parts[0]?.trim();
        const v = parts.slice(1).join("=").trim();
        if (k && this.cookies) {
          this.cookies[k] = v;
          changed = true;
        }
      }
    }
    if (changed) {
      this.store.write(this.cookies).catch(() => {});
    }
  }

  async get(url: string, init?: RequestInit) {
    return this.request(url, { ...init, method: "GET" });
  }

  async post(url: string, init?: RequestInit) {
    return this.request(url, { ...init, method: "POST" });
  }

  private async request(url: string, init?: RequestInit) {
    const finalUrl = url.startsWith("http") ? url : `${AppConfig.MOODLE_BASE}${url}`;
    const headers = new Headers(init?.headers);
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
    if (Object.keys(this.cookies).length > 0) {
      headers.set("Cookie", this.buildCookieHeader());
    }

    const res = await fetch(finalUrl, { ...init, headers, redirect: "follow" });
    this.updateCookiesFromHeaders(res.headers);
    return res;
  }

  async getSesskey(): Promise<string> {
    const res = await this.get("/my/");
    const finalUrl = res.url.toLowerCase();
    
    if (["login", "/index.php", "forgot_password", "logout"].some(k => finalUrl.includes(k))) {
      throw new Error("Session Moodle invalid atau diarahkan ke login.");
    }
    
    const text = await res.text();
    const match = text.match(/"sesskey":"(\w+)"/) || text.match(/sesskey=(\w+)/);
    
    if (!match) {
      throw new Error("Sesskey not found. Cookie may be expired.");
    }
    
    return match[1] || "";
  }
}
