import DashboardClient from "./dashboard-client";
import { getStudyOsHomeData } from "./study-os-model";

export const dynamic = "force-static";

export default function Page() {
  const homeData = getStudyOsHomeData();
  return <DashboardClient {...homeData} />;
}
