import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = {
  params: Promise<{ token: string }>;
};

async function fetchAchievement(token: string) {
  try {
    const base =
      process.env.API_INTERNAL_URL ??
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api`
        : 'http://127.0.0.1:3001/api');
    const response = await fetch(`${base}/v1/department-activities/achievements/${token}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.data ?? payload;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage({ params }: Props) {
  const { token } = await params;
  const data = await fetchAchievement(token);

  const studentName = data?.studentName ?? 'Student achievement';
  const activityTitle = data?.activityTitle ?? 'Department activity';
  const achievement = data?.achievementLabel ?? 'Participation';
  const college = data?.collegeName ?? 'Institution';

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(145deg, #fff7ed 0%, #ffffff 45%, #fef3c7 100%)',
        padding: 64,
        fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{ fontSize: 28, color: '#92400e', letterSpacing: 4, textTransform: 'uppercase' }}
        >
          {college}
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
          {studentName}
        </div>
        <div style={{ fontSize: 34, color: '#334155' }}>{achievement}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 36, fontWeight: 600, color: '#1e293b' }}>{activityTitle}</div>
        <div style={{ fontSize: 24, color: '#64748b' }}>Verified institutional achievement</div>
      </div>
    </div>,
    { ...size },
  );
}
