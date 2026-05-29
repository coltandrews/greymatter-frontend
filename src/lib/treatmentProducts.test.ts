import { describe, expect, it } from "vitest";
import { FALLBACK_TREATMENT_PRODUCTS, treatmentProductFromRow } from "./treatmentProducts";

describe("treatment product catalog", () => {
  it("uses the current launch products as the local fallback catalog", () => {
    expect(FALLBACK_TREATMENT_PRODUCTS.map((product) => product.product_key)).toEqual([
      "retatrutide_level_5",
      "cashmere_cream",
      "olympus_troches",
    ]);
  });

  it("accepts Supabase product keys that differ from the question set key", () => {
    expect(
      treatmentProductFromRow({
        id: "product-id",
        product_key: "retatrutide_level_5",
        name: "Retatrutide (Level 5)",
        label: "Advanced metabolic provider review",
        summary: "Provider review",
        description: "Provider review",
        service_key: "Retatrutide (Level 5)",
        service_type: "initial",
        billing_type: "one_time",
        price_id: "price_live",
        consultation_fee_cents: 9900,
        medication_fee_cents: 39900,
        currency: "usd",
        question_set_key: "glp_1",
        sort_order: 10,
      }),
    ).toMatchObject({
      product_key: "retatrutide_level_5",
      question_set_key: "glp_1",
      price_id: "price_live",
    });
  });

  it("rejects rows without a known question set", () => {
    expect(
      treatmentProductFromRow({
        product_key: "unknown_product",
        question_set_key: "unknown_questions",
      }),
    ).toBeNull();
  });
});
