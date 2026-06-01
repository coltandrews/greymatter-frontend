import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "Geist, Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: 378,
            height: 378,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 42,
            background: "#ffffff",
            border: "1px solid rgba(23, 23, 23, 0.14)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              lineHeight: 0.92,
              letterSpacing: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              <span style={{ color: "#171717", fontSize: 112, fontWeight: 900 }}>
                GM
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ color: "#777777", fontSize: 86, fontWeight: 900 }}>
                +
              </span>
              <span style={{ color: "#171717", fontSize: 112, fontWeight: 900 }}>
                MD
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
