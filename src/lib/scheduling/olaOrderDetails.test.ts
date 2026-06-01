import { describe, expect, it } from "vitest";
import {
  olaOrderDetailRows,
  olaOrderPatientSummary,
  olaResponseMessage,
} from "./olaOrderDetails";

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

describe("olaOrderPatientSummary", () => {
  it("extracts patient-friendly order details from an Ola response", () => {
    expect(
      olaOrderPatientSummary({
        result: {
          status: "approved",
          created_at: "2026-06-01T14:00:00.000Z",
          updated_at: "2026-06-01T15:30:00.000Z",
          pharmacy_name: "Test Pharmacy",
          pharmacy_phone: "+1234567890",
          pharmacy_address: "123 Care Street",
          service: {
            service_name: "Retatrutide",
          },
          provider: {
            first_name: "Alex",
            last_name: "Provider",
            user_avatar: "https://example.com/avatar.png",
            user_detail: {
              data: {
                title: "MD",
              },
            },
          },
          prescriptions: [{ id: "rx-1" }, { id: "rx-2" }],
        },
      }),
    ).toMatchObject({
      status: "approved",
      serviceName: "Retatrutide",
      clinicianName: "Alex Provider",
      clinicianTitle: "MD",
      clinicianAvatarUrl: "https://example.com/avatar.png",
      pharmacyName: "Test Pharmacy",
      pharmacyPhone: "+1234567890",
      pharmacyAddress: "123 Care Street",
      prescriptionCount: 2,
    });
  });
});

describe("olaResponseMessage", () => {
  it("extracts message or error text from Ola responses", () => {
    expect(olaResponseMessage({ message: "No provider found" })).toBe("No provider found");
    expect(olaResponseMessage({ error: "Invalid tenant" })).toBe("Invalid tenant");
    expect(olaResponseMessage(null)).toBeNull();
  });
});
