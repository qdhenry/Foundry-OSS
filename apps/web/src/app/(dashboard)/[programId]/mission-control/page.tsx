import { redirect } from "next/navigation";

export default async function MissionControlRedirect({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  redirect(`/${programId}`);
}
