// Re-created on client navigation so each page enters gently.
export default function Template({children}:{children:React.ReactNode}) {
  return <div className="softbloom-page-enter">{children}</div>;
}
