import { Suspense } from "react";
import { LoadingState } from "@/components/common/LoadingState";
import { NewReviewForm } from "@/components/review/NewReviewForm";

export default function NewReviewPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-[720px] py-12"><LoadingState /></div>}>
      <NewReviewForm />
    </Suspense>
  );
}
