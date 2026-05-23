import { redirect } from "next/navigation";

/** Legacy marketing sandbox removed — send visitors to signup. */
export default function DemoPage() {
  redirect("/sign-up");
}
