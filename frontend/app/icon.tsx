import { ImageResponse } from 'next/og';

export const size = { height: 32, width: 32 };
export const contentType = 'image/x-icon';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#1e40af",
          borderRadius: 6,
          color: "white",
          display: "flex",
          fontSize: 20,
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