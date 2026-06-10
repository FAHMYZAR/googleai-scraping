import { join } from "path";

const APP_DIR = process.cwd();
const DATA_DIR = join(APP_DIR, "data");

export const AppConfig = {
  APP_NAME: "api-fahmyzzx",
  MOODLE_BASE: "https://elearning.almaata.ac.id",
  DATA_DIR,
  MOODLE_COOKIE_FILE: join(DATA_DIR, "moodle_cookies.json"),
  GAI_COOKIES_PATH: join(DATA_DIR, "cookies.json"),
  PROVIDER_API_KEY: process.env.PROVIDER_API_KEY || "",
  MODEL_ID: process.env.MODEL_ID || "google-ai-mode",
  GAI_TIMEOUT: parseInt(process.env.GAI_TIMEOUT || "90000"),
  GAI_LANG: process.env.GAI_LANG || "id",
};
