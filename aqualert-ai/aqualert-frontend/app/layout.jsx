import './globals.css';

export const metadata = {
  title: 'AquaLert — Live Sensor Dashboard',
  description: 'Real-time water level monitoring for SchoolPulse',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
