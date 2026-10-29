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
      <Link className="sb-staff-floating-back" href="/softbloom" aria-label="Back to SoftBloom">
        <span className="sb-staff-back-petal" aria-hidden="true">🌸</span>
        <span>Back to SoftBloom</span>
        <span className="sb-staff-back-petal sb-staff-back-petal-two" aria-hidden="true">🌸</span>
      </Link>
      <StaffManager />
    </div>
  );
}
