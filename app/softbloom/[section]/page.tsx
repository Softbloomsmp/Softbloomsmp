import {notFound} from 'next/navigation';
import Link from 'next/link';
import ContentManager from '@/components/SoftBloomContentManager';
import '../softbloom-info.css';
const sections:Record<string,string>={about:'About SoftBloom',join:'Join SoftBloom SMP',features:'Server Features',worlds:'Explore Our Worlds',info:'Server Information',faq:'Frequently Asked Questions'};
export default async function SectionPage({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!Object.hasOwn(sections,section))notFound();return <div className="sb-info"><Link className="sb-staff-floating-back" href="/softbloom"><span className="sb-staff-back-petal">🌸</span>Back to SoftBloom<span className="sb-staff-back-petal sb-staff-back-petal-two">🌸</span></Link><ContentManager section={section} heading={sections[section]}/></div>}
