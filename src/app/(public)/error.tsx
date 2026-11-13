"use client";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="px-5 pt-40 pb-24">
      <ErrorState text="Не удалось загрузить страницу. Попробуйте ещё раз.">
        <Button onClick={reset} className="mt-2">Повторить</Button>
      </ErrorState>
    </div>
  );
}
