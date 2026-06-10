import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function parsePickleBase64(base64Str: string): Promise<Record<string, string>> {
  const pythonCode = `
import base64, pickle, json, sys
try:
    data = base64.b64decode(sys.argv[1])
    cookies = pickle.loads(data)
    if not isinstance(cookies, dict):
        raise ValueError("Pickle data is not a dictionary")
    print(json.dumps(cookies))
except Exception as e:
    print(json.dumps({"__error": str(e)}))
`;

  try {
    const { stdout } = await execFileAsync("python", ["-c", pythonCode, base64Str]);
    const result = JSON.parse(stdout.trim());
    if (result && result.__error) {
      throw new Error(result.__error);
    }
    return result;
  } catch (err: any) {
    throw new Error(`Failed to parse pickle: ${err.message}`);
  }
}
