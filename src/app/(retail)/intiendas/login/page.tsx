import { redirect } from "next/navigation";

/** INTIENDAS login retired — PMS tenants use /sign-in; platform owner uses /owner-login. */
export default function IntiendasLoginRetiredPage() {
  redirect("/sign-in");
}
