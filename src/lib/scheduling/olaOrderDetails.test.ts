import { describe, expect, it } from "vitest";
import { olaOrderDetailRows, olaResponseMessage } from "./olaOrderDetails";

describe("olaOrderDetailRows", () => {
  it("normalizes common Ola order fields into display rows", () => {
    expect(
      olaOrderDetailRows({
        result: {
          status: "approved",
          order_guid: "order-123",
          service: {
            service_name: "Retatrutide",
          },
          provider: {
            first_name: "Alex",
            last_name: "Provider",
            user_detail: {
              data: {
                title: "MD",
              },
            },
          },
          prescriptions: [{ id: "rx-1" }],
          consult_notes: [{ id: "note-1" }, { id: "note-2" }],
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        { label: "Ola status", value: "approved", cap: true },
        { label: "Service", value: "Retatrutide" },
        { label: "Clinician", value: "Alex Provider" },
        { label: "Clinician title", value: "MD" },
        { label: "Prescriptions", value: "1" },
        { label: "Clinical notes", value: "2" },
        { label: "Ola order", value: "order-123", mono: true },
      ]),
    );
  });
});

describe("olaResponseMessage", () => {
  it("extracts message or error text from Ola responses", () => {
    expect(olaResponseMessage({ message: "No provider found" })).toBe("No provider found");
    expect(olaResponseMessage({ error: "Invalid tenant" })).toBe("Invalid tenant");
    expect(olaResponseMessage(null)).toBeNull();
  });
});
