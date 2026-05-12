export type AddressSuggestion = {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
};

const stateNameToCode: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

function recordValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" ? value.trim() : "";
}

function compact(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(" ");
}

function postalCode(value: string): string {
  return value.split("-")[0]?.trim() ?? value;
}

function stateCode(address: Record<string, unknown>): string {
  const isoCode = recordValue(address, "ISO3166-2-lvl4");
  if (isoCode.startsWith("US-")) {
    return isoCode.slice(3).toUpperCase();
  }
  const state = recordValue(address, "state");
  if (/^[A-Za-z]{2}$/.test(state)) {
    return state.toUpperCase();
  }
  return stateNameToCode[state.toLowerCase()] ?? "";
}

export function normalizeAddressSuggestions(payload: unknown): AddressSuggestion[] {
  const matches = Array.isArray(payload) ? payload : [];

  return matches.slice(0, 5).flatMap((rawMatch, index) => {
    if (!rawMatch || typeof rawMatch !== "object") {
      return [];
    }

    const match = rawMatch as Record<string, unknown>;
    const address =
      match.address && typeof match.address === "object"
        ? (match.address as Record<string, unknown>)
        : {};
    const houseNumber = recordValue(address, "house_number");
    const road =
      recordValue(address, "road") ||
      recordValue(address, "pedestrian") ||
      recordValue(address, "footway");
    const street = compact([houseNumber, road]);
    const city =
      recordValue(address, "city") ||
      recordValue(address, "town") ||
      recordValue(address, "village") ||
      recordValue(address, "municipality");
    const state = stateCode(address);
    const zip = postalCode(recordValue(address, "postcode"));
    const label = recordValue(match, "display_name");
    const placeId = recordValue(match, "place_id") || `${label}-${index}`;

    if (!street || !city || !state || !zip || !label) {
      return [];
    }

    return [
      {
        id: placeId,
        label,
        street,
        city,
        state,
        postalCode: zip,
      },
    ];
  });
}

function parseMatchedAddress(value: string) {
  const [street = "", city = "", state = "", postalCode = ""] = value
    .split(",")
    .map((part) => part.trim());
  return { street, city, state, postalCode };
}

function addressComponents(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function streetFromComponents(components: Record<string, unknown>, fallback: string): string {
  const street = compact([
    recordValue(components, "fromAddress"),
    recordValue(components, "preQualifier"),
    recordValue(components, "preDirection"),
    recordValue(components, "preType"),
    recordValue(components, "streetName"),
    recordValue(components, "suffixType"),
    recordValue(components, "suffixDirection"),
  ]);
  return street || fallback;
}

function suggestionId(match: Record<string, unknown>, label: string, index: number): string {
  const tigerLine =
    match.tigerLine && typeof match.tigerLine === "object"
      ? (match.tigerLine as Record<string, unknown>)
      : null;
  const tigerLineId = tigerLine ? recordValue(tigerLine, "tigerLineId") : "";
  return tigerLineId || `${label}-${index}`;
}

export function normalizeCensusAddressSuggestions(payload: unknown): AddressSuggestion[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const result =
    root.result && typeof root.result === "object"
      ? (root.result as Record<string, unknown>)
      : {};
  const matches = Array.isArray(result.addressMatches) ? result.addressMatches : [];

  return matches.slice(0, 5).flatMap((rawMatch, index) => {
    if (!rawMatch || typeof rawMatch !== "object") {
      return [];
    }

    const match = rawMatch as Record<string, unknown>;
    const label = recordValue(match, "matchedAddress");
    if (!label) {
      return [];
    }

    const parsed = parseMatchedAddress(label);
    const components = addressComponents(match.addressComponents);
    const street = streetFromComponents(components, parsed.street);
    const city = recordValue(components, "city") || parsed.city;
    const state = recordValue(components, "state") || parsed.state;
    const postalCode = recordValue(components, "zip") || parsed.postalCode;

    if (!street || !city || !state || !postalCode) {
      return [];
    }

    return [
      {
        id: suggestionId(match, label, index),
        label,
        street,
        city,
        state,
        postalCode,
      },
    ];
  });
}
