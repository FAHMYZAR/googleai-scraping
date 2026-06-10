import { FileStorage } from "../services/fileStorage";

export type ChatMessage = {
  role: string;
  content: any;
};

export function extractTextContent(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const item of content) {
      if (item && typeof item === "object" && item.type === "text") {
        texts.push(item.text || "");
      }
    }
    return texts.filter(Boolean).join("\n");
  }
  return "";
}

export function extractImageContent(content: any): string | null {
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item && typeof item === "object" && item.type === "image_url") {
      const url = item.image_url?.url || "";
      if (url.startsWith("data:image")) {
        return url;
      }
    }
  }
  return null;
}

export function buildPrompt(messages: ChatMessage[]): { prompt: string; imageUrl: string | null } {
  const systemParts: string[] = [];
  const userParts: string[] = [];
  let imageUrl: string | null = null;

  for (const message of messages) {
    const text = extractTextContent(message.content);
    const fileImg = extractImageContent(message.content);
    if (fileImg) {
      imageUrl = fileImg;
    }
    if (!text) continue;
    if (message.role === "system" || message.role === "developer") {
      systemParts.push(text);
    } else if (message.role === "user") {
      userParts.push(text);
    }
  }

  const promptParts: string[] = [];
  if (systemParts.length > 0) {
    promptParts.push("Instruksi sistem:\n" + systemParts.join("\n"));
  }
  if (userParts.length > 0) {
    promptParts.push("Permintaan user:\n" + userParts.join("\n"));
  }

  return {
    prompt: promptParts.join("\n\n"),
    imageUrl,
  };
}

export function appendSources(content: string, sources: any[]): string {
  if (!sources || sources.length === 0) return content;
  const lines = [content.trim(), "", "Sumber:"];
  sources.forEach((source, idx) => {
    const name = source.name || source.title || `Source ${idx + 1}`;
    const url = source.url || source.link || "";
    lines.push(`${idx + 1}. ${name}: ${url}`.trim());
  });
  return lines.join("\n").trim();
}

export async function saveBase64Image(dataUrl: string, storage: FileStorage): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return null;
  try {
    const [header, encoded] = dataUrl.split(",", 2);
    if (!encoded || !header) return null;
    const imgData = Buffer.from(encoded, "base64");
    let suffix = ".png";
    if (header.includes("jpeg") || header.includes("jpg")) {
      suffix = ".jpg";
    }
    return await storage.writeTemp(imgData, suffix);
  } catch {
    return null;
  }
}
