import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
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
          color: "#f2f2f2",
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: 0,
          fontFamily: "Arial, sans-serif",
        }}
      >
        GM
      </div>
    ),
    size,
  );
}
