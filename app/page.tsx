import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to a demo engagement
  redirect("/chat/demo-engagement-abc123");
}
