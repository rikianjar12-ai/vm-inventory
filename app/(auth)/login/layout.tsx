import type { ReactNode } from "react";
import { LOGIN_CRITICAL_CSS } from "./critical.css";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_CRITICAL_CSS }} />
      {children}
    </>
  );
}
