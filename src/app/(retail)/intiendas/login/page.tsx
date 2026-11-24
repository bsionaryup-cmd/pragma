import { redirect } from "next/navigation";

/** INTIENDAS login retired — PMS uses unified /login. */
export default function IntiendasLoginRedirect() {
  redirect("/login");
}
