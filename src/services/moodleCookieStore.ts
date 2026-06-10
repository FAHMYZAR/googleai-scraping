import { AppConfig } from "../core/config";
import { JsonFileStore } from "./jsonFileStore";

export type MoodleCookies = Record<string, string>;

export class MoodleCookieStore {
  private readonly store = new JsonFileStore<MoodleCookies>(AppConfig.MOODLE_COOKIE_FILE, {});

  read() {
    return this.store.read();
  }

  write(cookies: MoodleCookies) {
    return this.store.write(cookies);
  }
}
