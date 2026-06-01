import { describe, expect, it } from "vitest";
import {
  idExtension,
  shippingComplete,
  shippingFromIntake,
  shippingPatch,
  shippingSummary,
  validateIdFile,
} from "./newTreatmentFlow";

describe("new treatment shipping helpers", () => {
  it("prefills shipping from saved intake demographics", () => {
    expect(
      shippingFromIntake({
        street_address: " 123 Main ",
        city: "Austin",
        service_state: "TX",
        zip: "78701",
      }),
    ).toMatchObject({
      street_address: "123 Main",
      city: "Austin",
      address_state: "TX",
      zip: "78701",
    });
  });

  it("validates and summarizes a complete shipping address", () => {
    const form = {
      street_address: "123 Main",
      address_line2: "Apt 4",
      city: "Austin",
      address_state: "TX",
      zip: "78701",
    };

    expect(shippingComplete(form)).toBe(true);
    expect(shippingSummary(form)).toBe("123 Main Apt 4 Austin, TX, 78701");
    expect(shippingPatch(form)).toMatchObject({
      address_state: "TX",
      service_state: "TX",
      country: "US",
    });
  });
});

describe("new treatment ID upload helpers", () => {
  it("accepts supported ID file types", () => {
    const file = new File(["id"], "id.png", { type: "image/png" });
    expect(validateIdFile(file)).toBeNull();
    expect(idExtension(file.type)).toBe("png");
  });

  it("rejects unsupported ID file types", () => {
    const file = new File(["id"], "id.gif", { type: "image/gif" });
    expect(validateIdFile(file)).toBe("Use a JPG, PNG, or PDF for your ID.");
  });
});
