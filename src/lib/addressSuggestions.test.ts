import { describe, expect, it } from "vitest";
import {
  normalizeAddressSuggestions,
  normalizeCensusAddressSuggestions,
} from "./addressSuggestions";

describe("normalizeAddressSuggestions", () => {
  it("normalizes address search results into checkout suggestions", () => {
    const suggestions = normalizeAddressSuggestions([
      {
        place_id: 123,
        display_name: "2402 Myrtle Avenue, Sullivans Island, South Carolina, 29482, United States",
        address: {
          house_number: "2402",
          road: "Myrtle Avenue",
          city: "Sullivans Island",
          state: "South Carolina",
          postcode: "29482",
          "ISO3166-2-lvl4": "US-SC",
        },
      },
    ]);

    expect(suggestions).toEqual([
      {
        id: "123",
        label: "2402 Myrtle Avenue, Sullivans Island, South Carolina, 29482, United States",
        street: "2402 Myrtle Avenue",
        city: "Sullivans Island",
        state: "SC",
        postalCode: "29482",
      },
    ]);
  });
});

describe("normalizeCensusAddressSuggestions", () => {
  it("normalizes Census address matches into checkout suggestions", () => {
    const suggestions = normalizeCensusAddressSuggestions({
      result: {
        addressMatches: [
          {
            matchedAddress: "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500",
            tigerLine: { tigerLineId: "76225813" },
            addressComponents: {
              fromAddress: "1600",
              preDirection: "",
              streetName: "PENNSYLVANIA",
              suffixType: "AVE",
              suffixDirection: "NW",
              city: "WASHINGTON",
              state: "DC",
              zip: "20500",
            },
          },
        ],
      },
    });

    expect(suggestions).toEqual([
      {
        id: "76225813",
        label: "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500",
        street: "1600 PENNSYLVANIA AVE NW",
        city: "WASHINGTON",
        state: "DC",
        postalCode: "20500",
      },
    ]);
  });

  it("falls back to the matched address when components are incomplete", () => {
    const suggestions = normalizeCensusAddressSuggestions({
      result: {
        addressMatches: [
          {
            matchedAddress: "2402 MYRTLE AVE, SULLIVANS ISLAND, SC, 29482",
            addressComponents: {},
          },
        ],
      },
    });

    expect(suggestions[0]).toMatchObject({
      street: "2402 MYRTLE AVE",
      city: "SULLIVANS ISLAND",
      state: "SC",
      postalCode: "29482",
    });
  });
});
