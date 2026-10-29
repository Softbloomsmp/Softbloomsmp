import Link from 'next/link';
import StaffManager from '@/components/StaffManager';
import '../softbloom-info.css';

export const metadata = {
  title: 'Staff Team | SoftBloom',
  description: 'Meet the SoftBloom staff team and community leaders.',
};

export default function StaffPage() {
  return (
    <div className="sb-info">
      <header className="sb-info-hero">
        <p className="sb-info-kicker">🌸 SOFTBLOOM COMMUNITY</p>
        <h1>Our Staff Team</h1>
        <p>Meet the people who help our community grow and thrive.</p>
        <div className="sb-info-actions"><Link href="/softbloom">Back to SoftBloom</Link></div>
      </header>
      <StaffManager />
    </div>
  );
}
