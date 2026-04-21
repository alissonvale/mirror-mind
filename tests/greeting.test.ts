import { describe, it, expect } from "vitest";
import { greetingFor } from "../server/formatters/greeting.js";

function at(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe("greetingFor", () => {
  it("says good morning before noon", () => {
    expect(greetingFor("Alisson", at(8))).toBe("Good morning, Alisson");
    expect(greetingFor("Alisson", at(11))).toBe("Good morning, Alisson");
  });

  it("says good afternoon from noon to 6pm", () => {
    expect(greetingFor("Alisson", at(12))).toBe("Good afternoon, Alisson");
    expect(greetingFor("Alisson", at(17))).toBe("Good afternoon, Alisson");
  });

  it("says good evening from 6pm onward", () => {
    expect(greetingFor("Alisson", at(18))).toBe("Good evening, Alisson");
    expect(greetingFor("Alisson", at(23))).toBe("Good evening, Alisson");
  });

  it("includes the provided name verbatim", () => {
    expect(greetingFor("", at(10))).toBe("Good morning, ");
    expect(greetingFor("Someone Else", at(10))).toBe(
      "Good morning, Someone Else",
    );
  });
});
