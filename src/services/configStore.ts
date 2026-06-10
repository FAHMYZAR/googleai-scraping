import { AppConfig } from "../core/config";
import { JsonFileStore } from "./jsonFileStore";

export class ConfigStore {
  private readonly googleCookieStore = new JsonFileStore<unknown>(AppConfig.GAI_COOKIES_PATH, []);

  readGoogleCookies() {
    return this.googleCookieStore.read();
  }

  writeGoogleCookies(cookies: unknown) {
    return this.googleCookieStore.write(cookies);
  }
}
