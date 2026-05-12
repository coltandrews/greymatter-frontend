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
          background: "#121212",
          fontFamily: "Arial, sans-serif",
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
            background: "#181818",
            border: "1px solid #343434",
            boxShadow: "0 30px 90px rgba(0, 0, 0, 0.34)",
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
              <span style={{ color: "#f2f2f2", fontSize: 112, fontWeight: 900 }}>
                GM
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ color: "#aeb4bb", fontSize: 86, fontWeight: 900 }}>
                +
              </span>
              <span style={{ color: "#4d83cf", fontSize: 112, fontWeight: 900 }}>
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
