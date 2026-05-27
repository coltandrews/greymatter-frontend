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
          background: "#fdfdfd",
          color: "#171717",
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: 0,
          fontFamily: "Geist, Arial, sans-serif",
        }}
      >
        GM
      </div>
    ),
    size,
  );
}
