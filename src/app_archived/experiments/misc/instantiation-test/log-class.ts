export class LogClass {
  constructor(from: "hook" | "zustand-create") {
    console.log(`🔥 LOG FROM ${from}`);
  }
}
