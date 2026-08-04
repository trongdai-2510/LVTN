import { ImageResponse } from 'next/og';

export const size = { height: 180, width: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#1e40af",
          borderRadius: 12,
          color: "white",
          display: "flex",
          fontSize: 80,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          width: "100%"
        }}
      >
        ST
      </div>
    ),
    { ...size }
  );
}