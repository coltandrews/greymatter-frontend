import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ payment?: string }>;
};

export default async function SchedulePage({ searchParams }: Props) {
  const sp = await searchParams;
  redirect(sp.payment === "cancelled" ? "/checkout?payment=cancelled" : "/checkout");
}
