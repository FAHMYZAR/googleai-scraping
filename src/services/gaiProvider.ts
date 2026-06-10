import { GaiWebviewProvider } from "./gaiWebviewProvider";

export class GaiProviderService {
  constructor(private readonly worker = new GaiWebviewProvider()) {}

  async chat(prompt: string) {
    return this.worker.chat(prompt);
  }

  async reset() {
    return this.worker.reset();
  }
}
