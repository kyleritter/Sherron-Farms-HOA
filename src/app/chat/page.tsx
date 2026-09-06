import { redirect } from "next/navigation";

// The chat now lives embedded on /hoa-docs; this route stays only so
// old links/bookmarks to /chat still land somewhere useful.
export default function ChatPage() {
  redirect("/hoa-docs");
}
