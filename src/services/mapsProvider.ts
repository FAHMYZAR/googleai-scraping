import { GaiWebviewProvider } from "./gaiWebviewProvider";

export class MapsProviderService {
  constructor(private readonly worker = new GaiWebviewProvider()) {}

  async getPlace(query: string) {
    return this.worker.place(query);
  }
}
